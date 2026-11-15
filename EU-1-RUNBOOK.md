# EU-1 runbook: customer data at rest only in the EU

Who does what: the owner runs every live step below. The code is on branch `eu-1` in two repos:
- site (`~/.pg-work/site-eu`): `app/lib/kv.ts` stores on Workers KV, D1 or both (`KV_BACKEND`), schema `db/eu-1-kv.sql`, scripts `scripts/eu-backfill.mjs` and `scripts/eu-verify.mjs`.
- relay (`~/.pg-work/relay-eu`): Durable Objects in the EU jurisdiction, WebSocket Hibernation.

Nothing in this branch has touched the live account.

## How the site reaches D1, and why

The site has always reached KV through the Cloudflare REST API from the edge runtime (`CLOUDFLARE_API_TOKEN` + namespace id). Nothing in the repo sets up Pages bindings: there is no wrangler.toml, no next-on-pages, no getRequestContext. So D1 is reached the same way: `POST /accounts/{id}/d1/database/{D1_DATABASE_ID}/query` with the same token. You don't need a build change or a binding in the Pages dashboard, and `kv.ts` stays the only place that talks to storage. The downside is that REST calls count against the API rate limit (see "Open points").

Modes (`KV_BACKEND`, a Pages env var):

| mode | writes | reads | lists |
|---|---|---|---|
| `kv` (default, also when unset) | KV | KV | KV |
| `dual` | D1 first, then KV; both must succeed or the call fails | KV only | KV only |
| `d1` | D1 | D1 | D1 |

In `dual`, KV stays the one truth: D1 is filled by the writes and the backfill and checked by verify, but never read by the site. So a key deleted in `dual` can never come back from a stale copy (review 2026-11-15: an earlier read-D1-then-KV design could bring back signed-out sessions and used links). A D1 outage in `dual` fails writes (sign-in, heartbeat) but not reads.

Any other value makes every call fail (fail closed, no silent fallback). Expired rows are invisible right away. About 2 % of writes also delete up to 500 expired rows.

## Steps

Keep this open in a terminal:
```sh
cd ~/.pg-work/site-eu
export CLOUDFLARE_ACCOUNT_ID=5f4b3228b678331dd09cf6bfe8514857
```

### 0. Deploy the code in `kv` mode (no behaviour change)
1. Merge `eu-1` into `main` in the site repo and push. Pages builds it. `KV_BACKEND` is unset, so the site behaves exactly as before. The six modules that used to call KV directly now go through `kv.ts`.
2. Live check: sign in (magic link + MFA), `/account` shows the sites with their online status, the admin audit list opens, a controller still heartbeats (its site shows online).
- Rollback: Pages > Deployments > previous deployment > "Rollback to this deployment".

### 1. Create the D1 database in the EU jurisdiction
```sh
npx wrangler@latest d1 create pg-cloud-eu --jurisdiction=eu
```
Or the REST API:
```sh
curl -sX POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"pg-cloud-eu","jurisdiction":"eu"}'
```
- Write down the `uuid` (database id). From here on: `export D1_DATABASE_ID=<uuid>`.
- Check: dashboard > Storage & Databases > D1 > pg-cloud-eu shows jurisdiction **EU**. The jurisdiction can only be set at creation. If it is wrong, delete the database and create it again.
- Rollback: `npx wrangler d1 delete pg-cloud-eu` (nothing depends on it yet).

### 2. Token permissions
The site uses the token in Pages `CLOUDFLARE_API_TOKEN`. Edit that token (My Profile > API Tokens > Edit) and add **Account > D1 > Edit**. Keep its Workers KV permission until step 9. The value stays the same, so Pages needs no change.
The scripts need the same rights (KV read, D1 edit), so you can use the same token. Load it into the shell without echoing it:
```sh
read -rs CLOUDFLARE_API_TOKEN && export CLOUDFLARE_API_TOKEN
read -r CLOUDFLARE_KV_NAMESPACE_ID && export CLOUDFLARE_KV_NAMESPACE_ID   # the id in Pages env, not secret
```
- Rollback: remove the D1 permission.

### 3. Apply the schema
```sh
npx wrangler@latest d1 execute pg-cloud-eu --remote --file=db/eu-1-kv.sql
npx wrangler@latest d1 execute pg-cloud-eu --remote --command "SELECT name FROM sqlite_master ORDER BY name"
```
Expect `kv` and `kv_expires_at`. The schema is idempotent. If wrangler asks for a config file, use REST:
```sh
jq -Rs '{sql: .}' db/eu-1-kv.sql | curl -sX POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database/$D1_DATABASE_ID/query" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' --data @- | jq .success
```
- Rollback: `DROP TABLE kv` (nothing reads it yet).

### 4. Switch to `dual`
1. Pages > powerguardian site > Settings > Environment variables (Production): add `D1_DATABASE_ID=<uuid>` and `KV_BACKEND=dual`.
2. Redeploy: Deployments > latest production > "Retry deployment". Env changes only apply to a new deployment.
3. Live check:
   - Sign in and open `/account`.
   - Wait 2 minutes for heartbeats.
   - `npx wrangler d1 execute pg-cloud-eu --remote --command "SELECT count(*) FROM kv WHERE key LIKE 'sitestatus:%'"` shows one row per online controller.
   - Dashboard D1 > pg-cloud-eu > Metrics shows writes coming in.
- Rollback: set `KV_BACKEND=kv` (or delete it) and redeploy. KV is still complete, because `dual` wrote everything there too.
- If D1 fails while in `dual`, the site refuses the write (500s on sign-in or heartbeat) instead of half-writing. Roll back and look at the D1 metrics.

### 5. Backfill (copy everything already in KV)
```sh
node scripts/eu-backfill.mjs --dry-run   # read only: counts per prefix (kv, already in D1, expired, would_copy)
node scripts/eu-backfill.mjs             # copies; prints counts per prefix only, never values or key names
```
- Throttled to 1 API request/s by default (`--rps=N`), because the live site shares the API rate limit (1,200 per 5 min; in `dual` every write costs 2). Expect about 1 request per key, so 3,000 keys take about 50 min; raise `--rps` only at night. An expired D1 row never blocks a copy.
- Idempotent. A second run reports `copied 0`. An existing D1 row is never overwritten (in `dual`, D1 is never older than KV) unless you pass `--overwrite`.
- Exit 1 with `too_large` means a value over 1.9 MB, which D1 cannot hold. Not expected; report it before going on.
- Rollback: not needed (D1 only). To start over: `DELETE FROM kv`, then run it again.

### 6. Verify
```sh
node scripts/eu-verify.mjs                # presence + SHA-256 of every value + expiry, per prefix; exit 0 = identical
node scripts/eu-verify.mjs --counts-only  # quick: key counts per prefix only
```
- If it reports differences: run `node scripts/eu-backfill.mjs --overwrite`, then verify again. Differences are listed as `prefix#<hash of the key name>`, never the name or value.
- Run it once more after about an hour of live `dual` traffic. It must be clean again.

### 7. Switch to `d1`
1. Pages env: `KV_BACKEND=d1`, then redeploy.
2. Live check:
   - Magic-link sign-in and MFA.
   - `/account` sites online, renaming a site.
   - Open console (relay mint).
   - Admin: licences and audit list.
   - Dashboard Workers KV > namespace > Metrics: reads and writes drop to about zero. D1 metrics keep moving.
- Rollback: none once live traffic ran on `d1`: fix forward. Going back to `dual` or `kv` would read the old KV snapshot, so keys deleted or used up during `d1` (sessions, links, tickets) would come back, and writes made on `d1` would be missing. Only right after the switch, before any sign-in or heartbeat on `d1`, is `KV_BACKEND=dual` still safe.

### 8. Deploy the relay
```sh
cd ~/.pg-work/relay-eu && npx wrangler deploy
```
- No new migration (same class) and no new vars. It doesn't depend on the D1 steps, so it can also go before them.
- What happens: every object restarts, controllers reconnect within 5-30 s, each to its EU object (`jurisdiction('eu').idFromName(licence)`). An old global object refuses a tunnel (409), so an old Worker version still in flight cannot pin a controller there.
- Live check:
  - DEPLOY.md smoke checks 1-3.
  - A real controller shows connected (`/status`, or the portal shows it online and Open Console works).
  - Grant support access from a controller, then revoke it: the console link then gets 401.
  - Workers & Pages > pg-relay > Durable Objects metrics: wall-clock duration drops to almost nothing (hibernation).
- Sub-tokens from before the deploy (at most 1 h) keep working. Their revocations are also checked in the old object.
- 2 h after an EU object's first tunnel, its alarm wipes its old global twin once (revoked jti list + alarm). There is nothing to do for this.
- Old global objects of controllers that never reconnect keep their revocation list (random ids only, no personal data) until a one-off sweep; the EU object wipes its global twin 2 h after its first tunnel.
- Rollback: `npx wrangler rollback` (previous version). Controllers reconnect to their old global objects. If those were already wiped, only revocations of long-expired tokens are gone, which is harmless.

### 9. Close out KV (after about 2 weeks on `d1` without problems)
Until this step, a stale copy of the customer data is still at rest in global KV. Only claim "EU only" on the privacy page after it.
1. Optional backup first: `npx wrangler kv key list --namespace-id $CLOUDFLARE_KV_NAMESPACE_ID --remote | jq length` for the count. D1 Time Travel (30 days, in the EU) is the restore path from here on.
2. Delete the namespace: `npx wrangler kv namespace delete --namespace-id $CLOUDFLARE_KV_NAMESPACE_ID`.
3. Pages env: remove `CLOUDFLARE_KV_NAMESPACE_ID`. Keep `KV_BACKEND=d1`. Remove the KV permission from the token.
- Rollback: none. That is why this step comes last.

## What stays outside the EU (for the privacy page, in plain words)

- **Stored data**: accounts, licences, sites and their status, sessions, sign-in and MFA data, shares and the audit log are kept in one Cloudflare database in the EU (D1, EU jurisdiction). The relay's own small state per site (which console links were revoked, the re-check timer) is also kept in the EU (Durable Objects, EU jurisdiction). Cloudflare's backups of that database (Time Travel) stay in the EU too.
- **Processing in transit**: requests are handled by Cloudflare's network at the location nearest to the visitor or the controller. That can be outside the EU, for example when you open the dashboard while travelling. The data passes through encrypted and is not stored there.
- **The live console connection**: the tunnel between your controller and the relay is held open in memory by Cloudflare's network. Pages pass through it and are not stored.
- **The website itself**: the site's code and its public pages and images are built and served by Cloudflare worldwide. They contain no customer data.
- **Software updates**: controller update files are public downloads in Cloudflare R2. They contain no customer data.
- **E-mail and payments**: sign-in and notification e-mails are sent through Brevo, and payments go through PayPal. Each keeps its own records under its own privacy terms (check their data-location statements before publishing).
- **Cloudflare account data**: Cloudflare keeps its own operational logs and analytics (request counts, errors) under its own policy. Workers Logs is off for the relay.

## Cost per controller (after hibernation)

Assumptions: Workers Paid ($5/month base), a heartbeat every 60 s (43,200/month), relay re-check every 10 min (4,320/month), controller keep-alive every 25 s (103,680/month). Browser console use comes on top and depends on how much it is used: each page request is 1 Worker request plus 2-3 DO requests.

| Item | Per controller / month | Included in Paid | Beyond that |
|---|---|---|---|
| Pages Functions requests (heartbeat + relay re-check) | ~47,500 | 10 M (shared with Workers) | $0.30 / M → $0.014 |
| D1 rows written (status upsert: row + index) | ~86,400 | 50 M | $1.00 / M → $0.086 |
| D1 rows read (3 per beat + 2 per re-check) | ~140,000 | 25 B | $0.001 / M → ~$0.0001 |
| DO requests (alarms 4,320 + keep-alives 103,680 / 20 = 5,184, worst case) | ~9,500 | 1 M | $0.15 / M → $0.0014 |
| DO duration (only alarms, ~0.3 s × 128 MB) | ~160 GB-s | 400,000 GB-s | $12.50 / M → $0.002 |
| DO SQLite rows written (setAlarm = 1 row) | ~4,400 | 50 M | $1.00 / M → $0.004 |
| **Total beyond included** | | | **~$0.11** |

- Inside the $5 plan, the included amounts cover roughly 100 controllers before any of this costs anything. DO requests are the first to run out, and that costs cents.
- Before hibernation, every tunnel kept its object in memory: ~324,000 GB-s per controller per month, or ~$4 per controller beyond the first. That is now ~160 GB-s.
- Whether keep-alive auto-responses count as requests is not stated in Cloudflare's docs (they are not billed as duration). The table counts them as requests (20:1), the worst case.
- Free plan instead of Paid: D1 allows 100,000 rows written/day, about 34 controllers.

## Open points

1. **API rate limit (exists today with KV, unchanged by EU-1)**: the Cloudflare API allows 1,200 requests per 5 minutes per user. Each heartbeat makes 4 REST calls (3 reads, 1 write), so about 55 controllers would use the whole budget, with nothing left for sign-ins, the dashboard or the scripts. A D1 binding (Pages Functions binding through next-on-pages/OpenNext `getRequestContext`) has no such limit. Only `d1Query` in `kv.ts` would change. Proposed as the next step. It needs to know how the Pages build is set up (the build command is in the dashboard, not in the repo).
2. Plan: the cost table assumes Workers Paid. Please confirm.
3. After step 9, Workers KV is no longer used by the site, and the relay never used it.
