# Point 28 — Decision Register and Risk Controls

**Authoritative Reference:** Blueprint Point 28  
**Status:** `IMPLEMENTED — UNVERIFIED` (Host subprocess sandbox restriction blocks live test execution)  
**Verification Date:** 2026-10-12  

---

## 1. Master Architectural Decision Register (D-01 to D-12)

| Decision ID | Title | Owner Role | Status | Expiry / Review Date | Residual Risk / Control |
|---|---|---|---|---|---|
| **D-01** | First Commercial Segment & Buyer | Principal Product Manager | `PROPOSED_UNRESOLVED` | 2026-12-31 | Buyer willingness to pay unverified; pilot interviews required. |
| **D-02** | Supported Targets and Versions | Platform Architect | `DECIDED_QUALIFIED` | 2027-06-30 | Pin Node 22, Docker Compose v2.29+, Debian 12, Chromium 128. |
| **D-03** | Express-to-Nest Migration Stance | Core Platform Lead | `DECIDED_QUALIFIED` | 2027-01-01 | Express 5.x platform host retained; no speculative framework rewrites. |
| **D-04** | Tenant Isolation Hosting Policy | Security Officer | `DECIDED_QUALIFIED` | 2026-11-30 | Server-side tenant scoping enforced; untrusted code fails closed. |
| **D-05** | CMS / Source Deletion Semantics | Content Systems Lead | `DECIDED_QUALIFIED` | 2027-10-01 | Hard `deleteMany` eliminated; non-destructive upsert & soft-deletes only. |
| **D-06** | Arbitrary Source Execution | Security Officer | `DECIDED_QUALIFIED` | 2026-12-31 | Fails closed until kernel cgroups/gVisor container isolation qualified. |
| **D-07** | Required Business Facts & Legal Copy | Legal Counsel | `DECIDED_QUALIFIED` | 2027-03-31 | Missing factual evidence blocks publish; no AI invention. |
| **D-08** | Provider Accounts, Scopes & Rules | Integration Lead | `DECIDED_QUALIFIED` | 2027-06-30 | Confirmed scopes, callbacks, and receipt logs required. |
| **D-09** | Durability, RPO/RTO & On-Call | SRE Lead | `ACCEPTED_RISK_ACTIVE` | 2026-12-15 | RPO ≤ 15m / RTO ≤ 4h proposed; failover requires live cluster test. |
| **D-10** | Comprehensive v1.3 Scope vs. Pilot | Head of Product | `DECIDED_QUALIFIED` | 2027-10-01 | Pilot intentionally restricts scope; roadmap retains full v1.3. |
| **D-11** | Portability & Media Rights | Legal Counsel | `DECIDED_QUALIFIED` | 2027-04-30 | Exported packages scrub proprietary metadata; open-source licensing. |
| **D-12** | Competitor / Marketing Truthfulness | Product Marketing Director | `DECIDED_QUALIFIED` | 2027-05-31 | No competitive claims without published reproducible benchmarks. |

---

## 2. 10 Release-Blocking Launch Risks

Release promotion MUST halt immediately if any of these conditions are present:

1. **Critical unauthorized access or tenant mixing** detected.
2. **Prohibited data collection or unauthorized disclosure** detected.
3. **Known source or content loss** detected.
4. **False accepted-lead state** detected (unpersisted submission acknowledged).
5. **Unverifiable release identity or corrupted candidate artifact** (hash mismatch).
6. **Failed mandatory security/privacy release gate**.
7. **Unqualified untrusted custom code execution** attempted.
8. **Unapproved destructive schema or content migration** detected.
9. **Unsupported feature falsely advertised as working** in release profile.
10. **Required test evidence missing** for advertised portable profile.

---

## 3. Authoritative Release Promotion Integration

In `IntegratedPublishingReleaseService.coordinatePromotion()`, evaluation of the 10 release-blocking risks is executed directly before atomic Compare-And-Swap release promotion. If any risk condition is violated, promotion throws an `AppError` with code `RELEASE_BLOCKING_RISK_TRIGGERED` and aborts.

---

## 4. Verification & Acceptance Tests

- Test suite: `backend/src/tests/point28-decision-register-risks.test.ts`.
- Validates: complete D-01..D-12 register, role-based accountability, decision freshness/expiry checks, 10 release-blocking launch risk triggers, and release promotion abortion upon launch risk.
