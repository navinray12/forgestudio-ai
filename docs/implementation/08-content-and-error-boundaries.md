# Increment 8: content execution and error boundaries

CodeInjectionRuntime no longer treats same-origin srcDoc with scripts and
allow-same-origin as isolation. Active HTML/CSS/JS snippets are blocked unless
both VITE_STUDIO_ORIGIN and VITE_CONTENT_RUNTIME_ORIGIN explicitly identify
separate HTTPS origins, on different hosts, and the current page is the content
origin. Missing configuration remains blocked with a visible explanation.

Do not configure these values merely to hide the warning. The content deployment
must use a cookie-free boundary, preferably a separate registrable domain, with
reviewed CSP/routing and no privileged SaaS tokens. No content host or certificate
was provisioned by this commit. Ordinary local Studio preview no longer executes
custom snippets. Custom scripts that require network or parent-DOM access remain
unsupported by this restricted opaque sandbox until separately reviewed.

Within the eligible runtime, script frames omit allow-same-origin and use a fixed
CSP; closing script tags cannot rewrite the CSP. HTML sanitization additionally
blocks active container/control tags. This scoped component change does not
certify every widget/export/custom-content path in the repository; full browser
isolation and destination reviews remain open.

The central error middleware now returns RFC 9457 fields alongside legacy error
fields, a correlation ID and no-store headers. Unknown ORM/provider errors are
not reflected in responses or default logs. Body-parser and known connection
failures receive stable safe codes. Existing controllers that serialize their own
errors must still be migrated to this central path.

Local source-unit evidence: 153 checks passed (13 new runtime-policy and 10 error
checks). Builds and real PostgreSQL/HTTP qualification are tracked separately by
GitHub Actions. No production deployment or credential rotation was performed.
