# Smart Report security

## Trust boundaries

- Browser calls are same-origin through route handlers. Supabase SSR handles PKCE in HttpOnly cookies. OAuth return paths are fixed and callback state binds the sign-in or link to its browser. Server handlers verify the Supabase user. The database independently reads the Google provider subject from `auth.identities`.
- Smart requests require the canonical production origin and an eligible US region from Netlify's request context. Header claims about country or IP are ignored. Absent context disables Smart. Private beta requires an expiring signed HttpOnly invitation cookie in addition to region and affirmative age/data-use consent. IP geo is approximate and age is self-attested. Private invitation screening and the owner's public eligibility review remain required.
- Only the service role executes the ledger RPC. Customer roles have no table grants. The transaction lock serializes reservations, wallet mutations and global limits across instances. A single pending reservation per identity, five-second cooldown and two-minute lease prevent concurrent overspending. An expired lease is released on a subsequent ledger operation and cannot be completed.
- Guest allocations occur only after the application's Supabase CAPTCHA-protected signup. Guest creation also uses a site-wide cap of 50 CAPTCHA-verified signup attempts per UTC day. Supabase Auth separately rate-limits account creation and rejected challenges. Keyed network hashes change daily and help measure unusual signup concentration. The application does not reject an eligible guest solely because other visitors share their network. Cookie clearing or multiple identities can yield more guest trials. The app cannot identify one human before login.
- Google identity grants are unique by a one-way hash of the stable provider ID. The grant record survives account deletion, so deleting and recreating an account does not issue new credits. The old anonymous and existing Google wallets are never merged during a conflict. If an account is deleted, its unused credits cannot be recovered automatically.

## Free-tier capacity and recovery

The site limits reservation attempts to 30/day, 300/month and 2 concurrent, with only lower overrides allowed. Limits are UTC. Attempts still count globally after failures because upstream may have received a call. A Gemini 429 opens a shared ten-minute provider cooldown. Gemini uses one bounded request with structured JSON and no optional tools or automatic model fallback.

Credits are debited in the transaction that completes a validated report. Failed attempts release the reservation. A completed request cannot debit a second time. A lost HTTP response can be retried with the same session/request key for up to 15 minutes. An encrypted receipt contains only the validated generated bullets and supporting SHAs. The app rebuilds the Basic evidence and checks the SHAs again. Changed GitHub evidence, a lost guest session, or expiration can prevent recovery. Replaying an expired receipt never debits again. Receipts are removed on later ledger activity after expiry. Account owners can purge expired rows periodically if the service is inactive.

## Provider evidence and storage

The provider sees at most 12 non-merge commit SHAs, allowlisted words from titles, coarse file categories/extensions, and numeric change counts. Raw titles, full paths, names, email addresses, code patches and user edits do not go to Gemini. Exact full SHAs are required in output and checked against the request. Model phrasing still needs user review. No complete report is stored server-side.

Monitor Supabase signup counts, bounded attempt counters, and Netlify team credits. Provider/transport errors use safe codes. Review hosting and third-party operational logging and retention in the owner accounts. Keep the Supabase profile/email information out of public displays. For account deletion requests, route them to the repository maintainer privately before sharing any personal information. Use an approved owner-side procedure that removes the account and receipts and retains the minimal one-time Google hash where permitted.
