import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
const migration = new URL("../../supabase/migrations/202611190001_smart_report_credits.sql", import.meta.url);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key, is_anonymous boolean);
    create table auth.identities(
      provider_id text, provider text, user_id uuid references auth.users on delete cascade,
      created_at timestamptz default now(), unique(provider,provider_id)
    );
  `);
  await db.exec(await readFile(migration, "utf8"));
});
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await db.exec(`truncate public.ai_google_awards, public.ai_global_limits, auth.users cascade`);
});

async function call(action: string, options: {
  user?: string; key?: string; hash?: string; receipt?: string;
  risk?: string; daily?: number; monthly?: number; concurrent?: number;
} = {}) {
  const { rows } = await db.query<{ result: {
    code: string; reservation?: string; guestRemaining?: number; bonusRemaining?: number; receipt?: string;
  } }>(`
    select public.cc_ai($1,$2,$3,$4,'mock-gemini',$5,$6,$7,$8,$9) as result
  `, [
    action, options.user ?? null, options.key ?? null, options.hash ?? null, options.receipt ?? null,
    options.risk ?? null, options.daily ?? 30, options.monthly ?? 300, options.concurrent ?? 2,
  ]);
  return rows[0].result;
}

async function create(anonymous = true, subject?: string) {
  const id = randomUUID();
  await db.query("insert into auth.users values ($1,$2)", [id, anonymous]);
  if (subject) await google(id, subject);
  await call(anonymous ? "guest_consent" : "consent", { user: id });
  return id;
}

async function google(user: string, subject: string) {
  await db.query("update auth.users set is_anonymous=false where id=$1", [user]);
  await db.query("insert into auth.identities(provider_id,provider,user_id) values ($1,'google',$2)", [subject, user]);
}

const input = (user: string, key = randomUUID()) => ({ user, key, hash: "test-fingerprint" });

async function skipCooldown() {
  await db.exec("update public.ai_generations set created_at=now()-interval '7 seconds' where state<>'reserved'");
}

async function spend(user: string) {
  const ticket = input(user);
  const reservation = await call("reserve", ticket);
  expect(reservation.code).toBe("reserved");
  const result = await call("complete", { user, key: reservation.reservation, receipt: "encrypted-fixture" });
  await skipCooldown();
  return { ticket, result, reservation };
}

describe("PostgreSQL credit migration", () => {
  it("spends exactly three guest credits on completed reports and preserves guest use on Google link", async () => {
    const user = await create();
    expect((await call("status", { user })).guestRemaining).toBe(3);
    for (const remaining of [2, 1, 0]) expect((await spend(user)).result.guestRemaining).toBe(remaining);
    expect((await call("reserve", input(user))).code).toBe("no_credits");
    await google(user, "same-google-identity");
    for (let i = 0; i < 2; i++) {
      expect(await call("status", { user })).toMatchObject({ guestRemaining: 0, bonusRemaining: 3 });
    }
    expect((await spend(user)).result.bonusRemaining).toBe(2);
    expect((await call("status", { user })).bonusRemaining).toBe(2);
  });

  it("grants three credits to a Google-first user and never re-awards a deleted identity", async () => {
    const user = await create(false, "stable-google-subject");
    expect(await call("status", { user })).toMatchObject({ guestRemaining: 0, bonusRemaining: 3 });
    await spend(user);
    await db.query("delete from auth.users where id=$1", [user]);
    const recreated = await create(false, "stable-google-subject");
    expect(await call("status", { user: recreated })).toMatchObject({ guestRemaining: 0, bonusRemaining: 0 });
  });

  it("rejects duplicate Google links without granting a different wallet bonus", async () => {
    const first = await create(false, "existing-account");
    const guest = await create();
    await expect(google(guest, "existing-account")).rejects.toThrow();
    expect((await call("status", { user: guest })).code).toBe("auth_required");
    expect((await call("status", { user: first })).bonusRemaining).toBe(3);
  });

  it("serializes two last-credit attempts and replays completion without double charging", async () => {
    const user = await create();
    await spend(user);
    await spend(user);
    const tickets = [input(user), input(user)];
    const results = await Promise.all(tickets.map((ticket) => call("reserve", ticket)));
    expect(results.filter(({ code }) => code === "reserved")).toHaveLength(1);
    const index = results.findIndex(({ code }) => code === "reserved");
    const key = results[index].reservation;
    expect((await call("complete", { user, key, receipt: "encrypted" })).guestRemaining).toBe(0);
    expect((await call("complete", { user, key, receipt: "encrypted" })).code).toBe("not_pending");
    expect(await call("reserve", tickets[index])).toMatchObject({ code: "replay", receipt: "encrypted" });
    expect((await call("reserve", { ...tickets[index], hash: "other" })).code).toBe("request_conflict");
  });

  it("releases failures without awarding wallet credit or refunding provider attempt quotas", async () => {
    const user = await create();
    const ticket = input(user);
    const reserved = await call("reserve", { ...ticket, daily: 1 });
    expect((await call("release", { user, key: reserved.reservation })).guestRemaining).toBe(3);
    expect((await call("release", { user, key: reserved.reservation })).code).toBe("not_pending");
    expect((await call("retry", ticket)).code).toBe("request_failed");
    await skipCooldown();
    expect((await call("reserve", { ...input(await create()), daily: 1 })).code).toBe("global_limit");
  });

  it("opens a durable shared cooldown after a provider 429", async () => {
    const user = await create();
    const reserved = await call("reserve", input(user));
    expect((await call("release_limited", { user, key: reserved.reservation })).guestRemaining).toBe(3);
    const nextUser = await create();
    expect((await call("reserve", input(nextUser))).code).toBe("global_limit");
    await db.exec("update public.ai_global_limits set expires_at=now()-interval '1 second' where bucket='provider:cooldown'");
    expect((await call("reserve", input(nextUser))).code).toBe("reserved");
  });

  it("enforces monthly ceilings, peak concurrency, and stale recovery across users", async () => {
    const first = await create();
    const second = await create();
    expect((await call("reserve", { ...input(first), concurrent: 1 })).code).toBe("reserved");
    expect((await call("reserve", { ...input(second), concurrent: 1 })).code).toBe("global_limit");
    await db.exec("update public.ai_generations set created_at=now()-interval '3 minutes'");
    expect((await call("reserve", { ...input(second), monthly: 1 })).code).toBe("global_limit");
    expect((await call("reserve", { ...input(second), concurrent: 1 })).code).toBe("reserved");
    expect((await call("status", { user: first })).guestRemaining).toBe(3);
  });

  it("does not award credits to direct anonymous auth accounts and limits guest creation", async () => {
    const user = randomUUID();
    await db.query("insert into auth.users values ($1,true)", [user]);
    expect((await call("status", { user })).guestRemaining).toBe(0);
    expect((await call("reserve", input(user))).code).toBe("consent_required");
    for (let i = 0; i < 50; i++) expect((await call("signup", { risk: "a".repeat(64) })).code).toBe("ok");
    expect((await call("signup", { risk: "b".repeat(64) })).code).toBe("signup_limit");
  });

  it("rejects non-service wallet access and write RPCs", async () => {
    await db.exec("set role authenticated");
    try {
      await expect(db.query("select * from public.ai_wallets")).rejects.toThrow(/permission denied/);
      await expect(db.query("select public.cc_ai('signup')")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    try {
      expect((await call("signup", { risk: "b".repeat(64) })).code).toBe("ok");
    } finally {
      await db.exec("reset role");
    }
  });
});
