# Identity increment threat model

| Threat | Implemented boundary | Evidence | Remaining limit |
| --- | --- | --- | --- |
| User-ID-only verification/password takeover | Browser-secret challenge, password proof, epoch, retired password setup | identity-security.test.ts | Older deployed code remains unsafe until changed |
| Replayed or concurrent OTP | Row locks, one-use state, committed attempts | identity-security.test.ts | Local-only credential flow; live mail not qualified |
| Database exposure of short codes | HMAC bound to high-entropy browser secret not retained in DB | identity-policy.test.mjs | Browser/session theft remains a separate threat |
| Fake security mail success | Confirmed receiver acceptance, TLS, strict time/socket limits | smtp-delivery.test.ts | Existing dependency advisories block production |
| OIDC login CSRF/code swap | Exact browser origin, state, cookie, nonce, S256 | identity-security.test.ts, oidc-adapter.test.ts | Live IdP configuration needs qualification |
| Unsigned/wrong-issuer/wrong-audience claims | Pinned SDK, independent signed ID-token verification | oidc-adapter.test.ts | Vendor key rotation/recovery/deprovision integration is not operationally qualified |
| Accidental email-based identity linking | Exact issuer/subject binding, existing-email rejection, dual authenticated link | identity-security.test.ts | Bulk existing-account cutover remains blocked |
| Weak privileged proof | Approved ACR mapping and fresh MFA/strong staff gates | identity-security.test.ts, identity-policy.test.mjs | Other legacy entry points and Control Center still need migration |
| Support-token impersonation | Retired unscoped routes and constructors | identity-security.test.ts | Scoped support-grant workflow not implemented |
| Session revocation races | Actor-locked account epoch and mandatory transactional audit | identity-security.test.ts | Provider-side deprovision propagation remains unqualified |
| Forged presence identity / sibling room access | Cookie-authenticated upgrade and fresh shared authorization | presence-security.test.ts | Single-process gateway, not distributed fan-out |
| Socket/mailer exhaustion | Admission/frame/body/queue/time budgets and connection destruction | presence-security.test.ts, smtp-delivery.test.ts | No reference-load/reconnect-storm qualification |

Assets: global identity bindings, session locators, short-lived proof, audit records.
Trust boundaries: browser/API, provider/API, database/application, realtime gateway.
There is no production OTP bypass, mock-provider switch, generated support token,
automatic email link, or authentication-disable state. Tests use dedicated fixture
entry points and explicitly named local databases, not production runtime flags.

These controls address the increment's threats; they are not an ASVS certification
or a substitute for the repository-wide threat model, secret scans, supply-chain
remediation, whole-tenant isolation testing and operational sign-off.
