# SHARE-1: share one site with a colleague (design)

Status: data model and negative tests only (`app/lib/shares.ts`, `tests/share.test.mts`). No route, page or controller
change yet; live behaviour is unchanged.

## Rule
A share covers exactly one site licence and one e-mail address. Sharing "Acer" never gives "HP" of the same owner, never
the licences, billing, moving or releasing a controller, account settings, or the right to share further.

## Roles
| Role | Portal | Remote console | Controller |
|------|--------|----------------|------------|
| owner (licence e-mail) | everything for own sites | yes | admin (CLOUD-SSO) |
| admin (share) | that site's status card | yes, that site only | admin, that controller only |
| viewer (share) | that site's status card | yes, that site only | viewer (read-only) |

## Flow
1. Owner: Site → Share → e-mail + role (+ optional end date). Cloud stores `share:<site>:<email>` (`invited`) with the
   invite token hashed, and mails the link. The link expires after 7 days and works once.
2. Invitee signs in to PG Cloud with that exact address (MFA rules as for owners) and accepts. A different signed-in
   address, another site, a used, wrong or expired token: refused.
3. Revoke (owner only): the share is `revoked` at once; the cloud stops minting console links for it and future SSO
   statements no longer name it. Already-open console tokens end within their 10-minute life.
4. When the licence changes owner, is revoked, or the site is deleted, its shares stop counting (checked on every decision).

## One decision
`siteAccess(email, siteId)` answers `owner | admin | viewer | null` for one site. Every route that acts on a site asks it:
relay-session (Open Console), `/sso/authorize`, the portal site card, and later a "Shared with me" list
(`sharedSites`). `canManageLicence` (owner only) guards licences, billing, site actions and sharing. Owner-only actions
(`app/lib/site-actions.ts` `mine()`) stay owner-only.

## Wiring later (not in this branch)
- `/api/account/relay-session`: allow `siteAccess(...) !== null`; mint with `actor` = the person, log `console.open`.
- `/sso/authorize`: `ssoSiteFor` also accepts a share; the statement carries `role: admin|viewer`, and the controller
  maps the role (today it only accepts `admin`; `controller/sso.go` has the TODO). Controller-side users made through a
  share are linked by `sub`, like now.
- Controller site switcher: `/api/cloud/sites` keeps listing the owner's sites only to an admin/owner of that controller
  (ISO-1); a shared admin of Acer sees Acer only.
- Portal UI: "Shared with" list per site (who, role, since, last console opening, revoke) and "Shared with me".

## Audit
Every console opening is written per site (`console.open`: who, via portal / switcher / share, when) next to
`share.invite`, `share.accept`, `share.revoke`. The owner sees the log of his site; the admin sees all.

## Organisations (later)
Today one e-mail is one account. Organisations would own licences instead of an e-mail, with members and roles; a share
then becomes "a member of org B gets site X of org A". The same `siteAccess` stays the single decision, so isolation tests
keep working unchanged.
