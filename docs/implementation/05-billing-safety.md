# Increment 5: fail-closed subscription authority

The plan-selection endpoint no longer turns a chosen paid plan into an ACTIVE
subscription, license and PAID invoice. Paid selection returns
PAYMENT_VERIFICATION_REQUIRED. Paid cancellation/downgrade requires a verified
provider operation and currently returns BILLING_PROVIDER_REQUIRED. This is an
intentional security restriction, NOT a completed checkout integration. No test
flag, environment bypass or client-supplied payment proof grants paid access.

Subscription reads are read-only. Missing provisioning is explicit; database
errors no longer become synthetic ACTIVE access. Explicit free onboarding is
idempotent, uses a serializable transaction with mandatory audit, and never
replaces an existing subscription. Free cancellation is audited. Website-limit
preflight reads the authoritative count, honors zero, and rejects inactive or
expired subscriptions. Strict count-plus-insert enforcement still belongs in the
website creation transaction and is not established by preflight alone.

The existing user-scoped billing model is retained during migration. Organization
billing, provider checkout/webhook reconciliation, usage reservations and historic
paid-record reconciliation remain open. Existing historical records are not
silently revoked, fabricated or rewritten. Legacy tests that used paid selection
as fixture setup must move to explicitly isolated test fixtures; production code
will not retain that bypass to satisfy an insecure assertion.

Local source-unit evidence: 62 passed, 0 failed (16 new billing cases). Command:
`node --experimental-vm-modules --test tests/hardening/*.test.mjs`.
The doubles do not establish real-database contention, provider or deployment
qualification. Free-onboarding recovery for pre-existing partially provisioned
accounts remains an explicit lifecycle task.
