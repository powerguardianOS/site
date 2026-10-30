# CLOUD-1: walk the whole licence chain once, with a test controller (not the HP)

Chain: admin signs in -> creates a licence -> controller links (claims) it -> heartbeat -> signed lease -> relay tunnel -> revoke.
Everything below runs on 127.0.0.1. Nothing here deploys or touches the live site, live KV, live Brevo or PayPal.

## A. Automated part (done, 23/23 green on 2026-10-30)

    cd ~/.pg-work/site-cloud
    PATH=~/dev/.tools/node/bin:$PATH node scripts/cloud-chain.mjs     # run twice if the very first request fails: Next prints a one-time upgrade reminder and aborts that request

What it does: starts a fake Cloudflare KV + fake Brevo on 127.0.0.1:8788 and `next dev` on 127.0.0.1:3100 against them
(env `CLOUDFLARE_API_BASE`, `BREVO_API_BASE`; both unset in production), then drives the HTTP API exactly as the controller does.

| Step | Call | Checked |
|---|---|---|
| 1 admin login | POST /api/auth/magic (ADMIN_EMAIL) -> link from fake mailbox -> GET /api/auth/verify | session cookie, link single-use, anonymous admin call = 401 |
| 2 create licence | POST /api/admin/licenses (cookie + Origin) | 201, licence id |
| 3 controller links | POST /api/license/send-code -> verify-code (hardware id) -> POST /api/license/claim | ticket first, token only after claim, lease signature verifies against the public key |
| 4 heartbeat + lease | POST /api/cloud/heartbeat (Bearer token) | licensed + fresh lease, wrong token 401, throttle 429, second hardware id = unconfirmed_copy |
| 5 relay validate | POST /api/relay/validate (X-Mint-Secret) | token -> licence id, no secret = 401 |
| 6 revoke | PATCH /api/admin/licenses/{id} status=revoked | relay validate false, heartbeat 403 revoked, legacy verify invalid |

Unit suites (also local): site `for t in tests/*.test.mts; do npx tsx $t; done` (106 checks), relay `npm test` (14 tests).

## B. Real test controller from ~/.pg-work/ctl against the local site (manual, 15 min)

The controller reads `PG_CLOUD_URL` (license_validate.go `cloudBaseURL()`), so heartbeat, send-code, verify-code and claim can point at the local site.

1. Terminal 1: run section A's fake KV + site only: `node scripts/cloud-chain.mjs` stops itself; for a long-lived setup copy its top half into `scripts/cloud-dev.mjs` (same env, no steps) - not written yet.
2. Terminal 2: `cd ~/.pg-work/ctl && PG_CLOUD_URL=http://127.0.0.1:3100 go run ./controller -addr 127.0.0.1:19090 <data-dir flags of the test run, see ctl/e2e>` (never on the LAN, never the HP).
3. In the controller UI (127.0.0.1:19090): Settings > License > e-mail of the licence > code (read it from the fake mailbox, `mails` array / dev log) > choose the free site > Claim.
4. Watch `POST /api/cloud/heartbeat 200` every 60 s in the `next dev` log; portal /account shows the site online.
5. Admin revokes in /admin: next heartbeat returns 403 `revoked`; the controller must show locked/expired state after the lease runs out (lease is 30 days - shorten via `LEASE_DAYS` in app/lib/lease.ts for the test only, do not commit).

Gap found: the controller hard-codes `wss://relay.powerguardian.cloud` (cloud_relay.go:75). For step C it needs a `PG_RELAY_URL` override (small ctl change, not made here).

## C. Relay tunnel locally (needs `npm i -D wrangler` in ~/.pg-work/relay-cloud: network, not done)

    cd ~/.pg-work/relay-cloud && npm i -D wrangler
    npx wrangler dev --ip 127.0.0.1 --port 8787 --var CLOUD_BASE:http://127.0.0.1:3100 --var MINT_SECRET:local-mint-secret
    # token = the licence token from step 3 (claim response)
    1. reject:   curl -i -H 'Upgrade: websocket' -H 'Connection: Upgrade' -H 'Sec-WebSocket-Key: x' -H 'Sec-WebSocket-Version: 13' \
                   "http://127.0.0.1:8787/connect/$(printf 'a%.0s' {1..32})?type=controller"        # expect 401
    2. accept:   controller with PG_RELAY_URL=ws://127.0.0.1:8787 (see gap) or: npx wscat -c "ws://127.0.0.1:8787/connect/$TOKEN?type=controller"   # stays open
    3. newest wins: open a second wscat with the same token -> first closes with code 4000
    4. browser:  POST site /api/account/relay-session (account cookie, license_id) with RELAY_MINT_SECRET=local-mint-secret and the mint URL pointed at 127.0.0.1:8787
                 (the URL is hard-coded to relay.powerguardian.cloud in app/api/account/relay-session/route.ts: add an env override for this test)
                 then open /console/<sub-token>/ (this is the "dashboard under /console/" check of CLOUD-3)
    5. revoke:   admin revokes -> within 10 min the alarm closes the tunnel with 4001 (for the test: temporarily set REVALIDATE_MS to 5000 in src/relay-do.js)

## D. Steps that need the live site / founder

| Step | Why live |
|---|---|
| Secrets on Pages: `RELAY_MINT_SECRET`, `PAYPAL_WEBHOOK_ID`; on the worker: `MINT_SECRET` (same value as RELAY_MINT_SECRET) | real values, only the founder has them |
| Mail: ADMIN-LOGIN, BREVO key as Secret, deliverability (Strato -> Gmail SPF) | real mailbox, real Brevo account |
| PayPal: register the webhook URL https://powerguardian.cloud/api/paypal/webhook in the PayPal dashboard, copy the webhook id | PayPal account; buying stays switched off |
| Real Cloudflare KV + Access-PIN | the fake KV cannot prove REST-API quirks (eventual consistency, 1 write/s per key) |
| `LEASE_PRIVATE_KEY` active after deploy (LINK-E2E) and its public key inside the controller image | key lives in Pages env |
| Link prefetch by mail apps burning the magic token (MAGIC-REAL) | needs a real phone/mail app |
| Final pass: repeat section A's steps by hand against https://powerguardian.cloud with a throw-away licence for a founder address, then revoke it | the only proof that the deployed edge build behaves like `next dev` |
