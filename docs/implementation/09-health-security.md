# Increment 9: remove unsafe diagnostics and false readiness claims

The old health controller exposed migration-history rewriting, host/container
inspection and hardcoded sign-off results. These are not acceptable health probes.

Public liveness now performs no provider calls. Public readiness reports only a
bounded database connectivity result; it is not full feature readiness or a
production certificate. The operations health route uses the same minimal probe.
Operational status and remaining diagnostic metadata require authenticated staff.
Migration status is SELECT-only and excludes raw migration logs. The GET/POST
repair, host-diagnostic and sanitizer-demo endpoints are retired with 410; they
cannot execute SQL mutations or host commands. Sign-off explicitly requires a
real evidence-backed release decision rather than returning fabricated success.

Local source-unit result: 175 passed, 0 failed, including eight new health checks.
The legacy operational administrator role model remains an interim compatibility
boundary, not the planned separately authenticated Control Center. Production
migration repair must occur through a reviewed operator procedure using a backup
and drift analysis. No live migration history or production system was modified.
