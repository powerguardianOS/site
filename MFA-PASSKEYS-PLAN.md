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
