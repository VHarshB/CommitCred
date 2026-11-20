begin;

create table public.ai_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  guest_allocated boolean not null default false,
  guest_used smallint not null default 0 check (guest_used between 0 and 3),
  google_bonus_used smallint not null default 0 check (google_bonus_used between 0 and 3),
  bonus_granted_at timestamptz,
  consent_at timestamptz,
  consent_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ai_google_awards (
  identity_hash text primary key,
  user_id uuid unique references auth.users(id) on delete set null,
  awarded_at timestamptz not null default now()
);
create table public.ai_generations (
  request_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  input_hash text not null,
  tier text not null check (tier in ('guest','google')),
  state text not null check (state in ('reserved','completed','released')),
  model text not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  error_type text,
  unique (user_id, idempotency_key)
);
create unique index ai_one_pending_per_user on public.ai_generations(user_id) where state = 'reserved';
create index ai_pending_time on public.ai_generations(created_at) where state = 'reserved';
create index ai_generations_user_time on public.ai_generations(user_id, created_at desc);

create table public.ai_receipts (
  request_id uuid primary key references public.ai_generations(request_id) on delete cascade,
  ciphertext text not null check (length(ciphertext) <= 24000),
  expires_at timestamptz not null
);
create table public.ai_global_limits (
  bucket text primary key,
  used integer not null check (used > 0),
  expires_at timestamptz not null
);

alter table public.ai_wallets enable row level security;
alter table public.ai_google_awards enable row level security;
alter table public.ai_generations enable row level security;
alter table public.ai_receipts enable row level security;
alter table public.ai_global_limits enable row level security;
revoke all on public.ai_wallets, public.ai_google_awards, public.ai_generations, public.ai_receipts,
  public.ai_global_limits from public, anon, authenticated, service_role;

-- All operations run under one transaction lock. At the intended small free-tier
-- limits this keeps quota, wallet, idempotency, and maintenance decisions linear.
create function public.cc_ai(
  p_action text, p_user uuid default null, p_key uuid default null,
  p_input_hash text default null, p_model text default null, p_receipt text default null,
  p_risk text default null, p_daily integer default 30, p_monthly integer default 300,
  p_concurrent integer default 2
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  t timestamptz;
  utc_day timestamp;
  utc_month timestamp;
  d text;
  m text;
  g text;
  r text;
  w public.ai_wallets%rowtype;
  entry public.ai_generations%rowtype;
  anonymous boolean;
  google_hash text;
  eligible_google boolean;
  guest integer;
  bonus integer;
  balance jsonb;
  receipt text;
begin
  perform pg_advisory_xact_lock(945031827);
  t := clock_timestamp();
  utc_day := date_trunc('day', t at time zone 'UTC');
  utc_month := date_trunc('month', t at time zone 'UTC');
  d := 'generation:day:' || utc_day::date::text;
  m := 'generation:month:' || utc_month::date::text;
  g := 'signup:day:' || utc_day::date::text;
  r := g || ':' || p_risk;
  delete from public.ai_global_limits where expires_at <= t;
  delete from public.ai_receipts where expires_at <= t;
  update public.ai_generations set state='released', finished_at=t, error_type='expired'
    where state='reserved' and created_at < t - interval '2 minutes';

  if p_action = 'signup' then
    if p_risk is null or p_risk !~ '^[a-f0-9]{64}$' or exists (
      select 1 from public.ai_global_limits where bucket=g and used>=50
    ) then return jsonb_build_object('code','signup_limit'); end if;
    insert into public.ai_global_limits values
      (g,1,(utc_day + interval '1 day') at time zone 'UTC'),
      (r,1,(utc_day + interval '1 day') at time zone 'UTC')
      on conflict (bucket) do update set used=public.ai_global_limits.used+1;
    return jsonb_build_object('code','ok');
  end if;

  select u.is_anonymous into anonymous from auth.users u where u.id=p_user;
  if not found then return jsonb_build_object('code','auth_required'); end if;
  select encode(sha256(convert_to(i.provider_id,'UTF8')),'hex') into google_hash
    from auth.identities i where i.user_id=p_user and i.provider='google' and i.provider_id <> ''
    order by i.created_at, i.provider_id limit 1;
  if not coalesce(anonymous,false) and google_hash is null then
    return jsonb_build_object('code','auth_required');
  end if;

  insert into public.ai_wallets(user_id) values (p_user) on conflict do nothing;
  if p_action='guest_consent' and anonymous then
    update public.ai_wallets set guest_allocated=true, consent_at=t, consent_version=1, updated_at=t where user_id=p_user;
  elsif p_action='consent' then
    update public.ai_wallets set consent_at=t, consent_version=1, updated_at=t where user_id=p_user;
  end if;

  if google_hash is not null then
    insert into public.ai_google_awards(identity_hash,user_id) values (google_hash,p_user) on conflict do nothing;
    update public.ai_wallets set bonus_granted_at=t, updated_at=t
      where user_id=p_user and bonus_granted_at is null and exists (
        select 1 from public.ai_google_awards where user_id=p_user and identity_hash=google_hash
      );
  end if;

  eligible_google := google_hash is not null and exists (
    select 1 from public.ai_google_awards where user_id=p_user and identity_hash=google_hash
  );
  select * into w from public.ai_wallets where user_id=p_user;

  if p_action in ('complete','release','release_limited') then
    select * into entry from public.ai_generations where request_id=p_key and user_id=p_user;
    if not found or entry.state <> 'reserved' then return jsonb_build_object('code','not_pending'); end if;
    if p_action='complete' then
      if p_receipt is null then return jsonb_build_object('code','missing_receipt'); end if;
      update public.ai_wallets set guest_used=guest_used+(entry.tier='guest')::int,
        google_bonus_used=google_bonus_used+(entry.tier='google')::int, updated_at=t
        where user_id=p_user returning * into w;
      update public.ai_generations set state='completed',finished_at=t where request_id=p_key;
      insert into public.ai_receipts values (p_key,p_receipt,t + interval '15 minutes');
    else
      update public.ai_generations set state='released',finished_at=t,
        error_type=case when p_action='release_limited' then 'provider_limit' else 'generation_failed' end
        where request_id=p_key;
      if p_action='release_limited' then
        insert into public.ai_global_limits values ('provider:cooldown',1,t + interval '10 minutes')
          on conflict (bucket) do update set expires_at=excluded.expires_at;
      end if;
    end if;
  end if;

  guest := case when w.guest_allocated and (anonymous or eligible_google) then 3-w.guest_used else 0 end;
  bonus := case when eligible_google and w.bonus_granted_at is not null then 3-w.google_bonus_used else 0 end;
  balance := jsonb_build_object('guestRemaining',guest,'bonusRemaining',bonus,
    'totalRemaining',guest+bonus,'google',google_hash is not null,'consented',coalesce(w.consent_version=1,false),
    'usedAllSix',w.guest_used=3 and w.google_bonus_used=3);

  if p_action in ('status','consent','guest_consent','complete','release','release_limited') then
    return balance || jsonb_build_object('code','ok');
  end if;

  if p_action not in ('reserve','retry') or p_key is null or p_input_hash is null then return jsonb_build_object('code','invalid'); end if;
  select * into entry from public.ai_generations where user_id=p_user and idempotency_key=p_key;
  if found then
    if entry.input_hash<>p_input_hash then return jsonb_build_object('code','request_conflict'); end if;
    if entry.state='completed' then
      select ciphertext into receipt from public.ai_receipts where request_id=entry.request_id;
      return balance || jsonb_build_object('code',case when receipt is null then 'request_finished' else 'replay' end,'receipt',receipt);
    end if;
    return balance || jsonb_build_object('code',case when entry.state='reserved' then 'in_flight' else 'request_failed' end);
  end if;
  if p_action='retry' then return jsonb_build_object('code','missing'); end if;
  if w.consent_version is distinct from 1 then return jsonb_build_object('code','consent_required'); end if;
  if guest+bonus=0 then return balance || jsonb_build_object('code','no_credits'); end if;
  if exists (select 1 from public.ai_generations where user_id=p_user and state='reserved') then
    return jsonb_build_object('code','in_flight');
  end if;
  if exists (select 1 from public.ai_generations where user_id=p_user and created_at > t - interval '5 seconds') then
    return jsonb_build_object('code','cooldown');
  end if;
  if p_daily is null or p_monthly is null or p_concurrent is null or
     p_daily not between 1 and 30 or p_monthly not between 1 and 300 or p_concurrent not between 1 and 2 or
     exists (select 1 from public.ai_global_limits where (bucket=d and used>=p_daily) or (bucket=m and used>=p_monthly) or bucket='provider:cooldown') or
     (select count(*) from public.ai_generations where state='reserved') >= p_concurrent then
    return jsonb_build_object('code','global_limit');
  end if;
  insert into public.ai_global_limits values
    (d,1,(utc_day + interval '1 day') at time zone 'UTC'),
    (m,1,(utc_month + interval '1 month') at time zone 'UTC')
    on conflict (bucket) do update set used=public.ai_global_limits.used+1;
  insert into public.ai_generations(user_id,idempotency_key,input_hash,tier,state,model)
    values(p_user,p_key,p_input_hash,case when guest>0 then 'guest' else 'google' end,'reserved',p_model)
    returning * into entry;
  return balance || jsonb_build_object('code','reserved','reservation',entry.request_id);
end;
$$;

revoke all on function public.cc_ai(text,uuid,uuid,text,text,text,text,integer,integer,integer)
  from public, anon, authenticated;
grant execute on function public.cc_ai(text,uuid,uuid,text,text,text,text,integer,integer,integer)
  to service_role;
commit;
