# 18. Security, Privacy, Audit and Abuse Resistance

**Document Version:** 1.0.0  
**Blueprint Reference:** Point 18 — Security, privacy, audit and abuse resistance  
**Repository:** `navinray12/forgestudio-ai`

---

## 1. Executive Architecture Summary

Point 18 establishes a comprehensive security, privacy, and audit defense architecture: 13-vector threat model mapped to OWASP ASVS v4.0.3, 8-plane trust boundary separation, server-side tenant scoping rejecting ID substitution, non-superuser PostgreSQL RLS contract, strict SSRF/DNS-rebinding quarantine, shared universal redaction, tamper-evident cryptographic audit hash chain with durable denial logging, and 10-quota category abuse resistance preserving committed leads and protected source.

### Core Invariants:
1. **No Client Tenant ID Trust:** Tenant scope is resolved strictly from validated server session tokens; client-supplied header substitutions (`x-tenant-id`) are rejected.
2. **Non-Superuser RLS Defense:** PostgreSQL RLS is defense in depth; queries executed under superuser or table-owner roles fail validation to prevent accidental RLS bypass.
3. **Fail-Closed Custom Code Sandbox:** Untrusted customer scripts are blocked unless executed inside qualified kernel-level container/gVisor boundaries with restricted network egress.
4. **SSRF Quarantine:** Webhooks and crawlers block loopback (`127.0.0.1`), RFC 1918 private subnets, and cloud metadata (`169.254.169.254`). Redirects are rechecked at every hop.
5. **Universal Redaction:** Passwords, tokens, API keys, emails, phone numbers, and credit cards are scrubbed across logs, errors, AI model traces, and exports.
6. **Durable Denial Logging:** Denied authorization requests are recorded to a durable denial ledger that does NOT roll back when transactions fail.
7. **Tamper-Evident Hash Chain:** Critical mutations are linked via SHA-256 cryptographic hash chains verifying audit immutability.
8. **Abuse Response Preserves Source & Leads:** Quota exhaustion pauses expensive operations, but NEVER silently purges protected source history or discards committed leads.

---

## 2. Security Trust Planes

```
┌────────────────────────────────────────────────────────┐
│ 1. Platform Admin Plane (Cross-tenant super-governance)│
├────────────────────────────────────────────────────────┤
│ 2. Tenant Owner / Member Plane (Scoped to tenantId)   │
├────────────────────────────────────────────────────────┤
│ 3. Public Visitor Plane (Read-only published routes)  │
├────────────────────────────────────────────────────────┤
│ 4. Build Worker Plane (Isolated container builds)     │
├────────────────────────────────────────────────────────┤
│ 5. Runtime Worker Plane (Fenced leased jobs)          │
├────────────────────────────────────────────────────────┤
│ 6. Deployment Agent Plane (Staging & CDN probes)      │
├────────────────────────────────────────────────────────┤
│ 7. Provider Service Plane (OAuth credentials)         │
├────────────────────────────────────────────────────────┤
│ 8. External Callback Plane (Signed webhook verifier)  │
└────────────────────────────────────────────────────────┘
```

---

## 3. Services Overview

### 3.1 Threat Model Matrix (`threatModelMatrix.service.ts`)
- Maps 13 threats (account takeover, tenant substitution, sandbox escape, SSRF, malicious uploads, forged callbacks, source corruption, attestation tampering, AI costs, attribution hijacking, chat tool abuse, queue exhaustion, privilege escalation) to OWASP ASVS v4.0.3 controls.

### 3.2 Security Planes & RLS (`securityPlanesAuthorization.service.ts`)
- Enforces server-side tenant scoping and validates non-superuser RLS contracts.

### 3.3 SSRF Network Quarantine (`ssrfNetworkQuarantine.service.ts`)
- Blocks outbound requests to loopback, private IP ranges, and cloud metadata endpoints. Validates redirect chains hop-by-hop.

### 3.4 Data Policy Retention & Redaction (`dataPolicyRetentionRedaction.service.ts`)
- Manages retention classes (`OPERATIONAL_30D`, `LEAD_90D`, `STATUTORY_7Y`, `PERMANENT`) and deeply scrubs PII, secrets, and credentials.

### 3.5 Durable Audit Denial Ledger (`durableAuditDenialLedger.service.ts`)
- Maintains tamper-evident SHA-256 hash chains, out-of-transaction denial logs, and 10-quota category abuse pausing.
