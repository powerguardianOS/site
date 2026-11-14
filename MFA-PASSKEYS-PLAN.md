# CLOUD-MFA follow-up: passkeys (Face ID / Touch ID / Android)

Two-step sign-in with an authenticator app (TOTP) and recovery codes is built (app/lib/mfa.ts, /login/mfa,
/api/account/mfa, the "Two-step sign-in" card). Passkeys are the next step; they were left out of the first round on
purpose because they need client JS on the sign-in pages, a CBOR/COSE parser and a second store, and the TOTP flow had
to ship whole first.

## What it adds
- A second way to pass the two-step page: "Use Face ID / passkey" next to the 6-digit code.
- On the card: "Add a passkey" (several allowed, each with a name and last-used date, removable with a current code).
- A passkey counts as two-step: the session gets `mfa: true`, so the SSO statement carries `mfa: true` as for TOTP.
- Enforcement stays "two-step required for accounts with sites": either a passkey or the app satisfies it. Recovery
  codes stay the fallback for both.

## Build (edge runtime, no heavy dependencies)
1. `app/lib/webauthn.ts` (~250 lines, WebCrypto only):
   - minimal CBOR decoder (maps, byte/text strings, ints, arrays) for `attestationObject` and the COSE key;
   - registration: `fmt: "none"` only (no attestation chain), check `clientDataJSON.type/challenge/origin`
     (`https://powerguardian.cloud`), `rpIdHash = SHA-256("powerguardian.cloud")`, flags UP+UV, take credential id +
     COSE key (ES256 / -7 required, EdDSA / -8 optional);
   - assertion: same clientData checks, `rpIdHash`, UP+UV, signature over `authData || SHA-256(clientDataJSON)`
     with `crypto.subtle.verify` (ECDSA P-256: convert the DER signature to raw r||s), sign counter must grow
     (or stay 0 for authenticators that do not count).
2. KV: `passkeys:<email>` = [{ id, public_key (COSE → JWK), alg, name, created_at, last_used_at, counter }];
   `webauthn:challenge:<random>` (2 minutes, single use, bound to the pending sign-in id or the session).
3. Endpoints: `POST /api/account/passkeys/options|register|remove` (ownerGuard), and on `/login/mfa`
   `POST ?passkey=options` / `POST ?passkey=verify` (same-origin, pending sign-in cookie, same 5-try / per-account limits).
4. Client JS: the sign-in pages are server-rendered with `default-src 'none'`; add one small static script
   (`/mfa-passkey.js`, `script-src 'self'`) that calls `navigator.credentials.get/create` and posts the result. The card
   (React) calls the same APIs directly. Show the passkey button only when `PublicKeyCredential` exists.
5. Tests: unit tests with fixed registration/assertion vectors (made once with a software authenticator), plus a
   WebKit/Chromium run with Playwright's virtual authenticator (CDP `WebAuthn.addVirtualAuthenticator`, Chromium;
   WebKit has no virtual authenticator, so iPhone layout is checked without the ceremony).

## Open questions for Roy
- Allow passkey-only (no authenticator app) for accounts with sites? Proposal: yes, with recovery codes required.
- Should a passkey also replace the email link (passwordless sign-in)? Proposal: later; keep the link as step one.

## Built (PASSKEYS-1, branch passkeys-1)
Decisions from Roy: passkey = passwordless sign-in AND two-step (UV required → session mfa:true, SSO mfa:true); either
the app or a passkey satisfies "two-step required for accounts with sites"; recovery codes always (made with the first
passkey). Code: app/lib/webauthn.ts (verifier), app/lib/passkeys.ts (records, challenges, policy), app/lib/remember.ts,
/api/auth/passkey/options|verify (passwordless), /login/mfa?passkey=… (two-step verify + setup), /api/account/passkeys
(add, list, remove with fresh confirmation), public/mfa-passkey.js, app/account/components/PasskeysCard.tsx.
- Relying party: powerguardian.cloud / https://powerguardian.cloud; only a localhost/127.0.0.1 test setup may differ.
- Challenge: 32 random bytes, KV 120 s, deleted on first use, bound to the browser cookie (passwordless), the pending
  sign-in (two-step page) or the session + e-mail (account page). The client's clientDataJSON names the challenge.
- Counter must grow (0 → 0 allowed for synced passkeys). User handle = 32 random bytes (never the e-mail).
- Limits: options 60/15 min per IP; passwordless verify 20/15 min per IP + the account's code limit (10/15 min); the
  two-step page keeps its 5 tries per pending sign-in.
- Audit (app/lib/audit.ts): passkey.add, passkey.remove, signin.passkey, signin.passkey_refused.
- Remembered account (/login "Continue as r***@gmail.com"): localStorage holds { masked e-mail, random handle,
  passkey yes/no } only. The e-mail itself is not stored on the device: the passkey needs no hint (the browser lists the
  site's passkeys), and for the link/code the server maps sha256(handle) → e-mail (400 days). The handle cannot sign in;
  it can only ask for a mail to the account's own address, under the same limits. "Forget" deletes both halves.
- Deleting a tenant deletes its passkeys and their index.
Tests: tests/passkeys.test.mts (fixed vectors in tests/fixtures/webauthn-vectors.json + flows),
tests/e2e/passkeys.e2e.mjs (Chromium virtual authenticator + WebKit iPhone layout), scripts/isolation-e2e.mjs A2.
