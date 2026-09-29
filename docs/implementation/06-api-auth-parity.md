# Increment 6: public API authentication parity

The public API had a separate session implementation that omitted account status
checks and disclosed caught error messages. Browser and public API sessions now
share one session-authentication service. API keys also require an ACTIVE owning
account. Explicit invalid Bearer credentials cannot select an unrelated cookie
principal. Scope middleware rejects missing/unknown authentication context and
missing key scopes rather than assuming a session.

The literal EDIT_ANALYTICS action already exposed by the WordPress routes is now
in the registered capability vocabulary, preserving owner behavior without
allowing arbitrary new capability names.

Local evidence: 75 source-unit checks passed, including 13 new API tests. Real
HTTP/session-cookie, CSRF, OIDC migration, API-key expiry/rotation, real database
revocation races and the full endpoint inventory remain distinct release gates.
No production session or API key was revoked by this source commit.
