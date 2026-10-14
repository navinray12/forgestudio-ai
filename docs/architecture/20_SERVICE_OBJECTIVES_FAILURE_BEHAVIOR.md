# 20. Service Objectives and Failure Behavior

**Document Version:** 1.0.0  
**Blueprint Reference:** Point 20 — Service objectives and failure behavior  
**Repository:** `navinray12/forgestudio-ai`

---

## 1. Executive Architecture Summary

Point 20 formalizes the Service Level Objective (SLO) register, SLI instrumentation rules, failure-isolation behavior across 8 critical infrastructure fault modes, and error-budget enforcement that halts risky production promotions when reliability drops.

### Core Invariants:
1. **Proposed Targets, Not Contractual Promises:** Every target is explicitly classified as `PROPOSED_STARTING_TARGET`. Production commitments require statistically significant field telemetry over sustained periods.
2. **Missing Telemetry Rule:** Lack of telemetry or missing metrics is never counted as healthy service behavior.
3. **Decoupled Business Resilience:** External outages (CRM, email, AI gateway, behavioral analytics) must not drop, fail, or misreport accepted visitor leads committed to Authoritative Record 5.
4. **Draft Privacy Under Outage:** Content service outages serve cached public pages only; drafts, private records, and trashed revisions can never leak.
5. **Error Budget Enforcement:** When the monthly error budget falls below 10%, automated and manual promotions of risky release candidates are frozen until reliability recovers.

---

## 2. Proposed Starting Targets Register

| Identifier | Service Dimension | Proposed Starting Target | SLI Formula Source | Accountable Role |
| :--- | :--- | :--- | :--- | :--- |
| **SLO_PAGE_EXPERIENCE** | Public Web Experience | p75 LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 | Browser field performance beacon | Frontend Platform Lead |
| **SLO_LEAD_ACCEPTANCE** | Atomic Lead Acceptance | p95 ≤ 800ms; 0 false acknowledgements | Server submission boundary timer | Backend Core Lead |
| **SLO_CONTENT_PROPAGATION**| Managed Publishing | p95 ≤ 60 seconds to edge CDN | Pipeline edge probe roundtrip | SRE Deployment Lead |
| **SLO_CORE_AVAILABILITY** | Core Public & API | 99.9% monthly availability | Multi-region synthetic probes | Platform Infrastructure Owner |
| **SLO_DISASTER_RECOVERY** | Durability & Recovery | RPO ≤ 15 min, RTO ≤ 4 hours | Disposable DB restore rehearsals | Database Admin Role |
| **SLO_OWNER_USABILITY** | Owner Journey Success | Pilot target ≥ 90% unassisted | 10 standard acceptance journeys | Product UX Lead |
| **SLO_PORTABILITY** | Portable Full Stack | 100% pass fresh install & restore | Gate 12 export verification runner | QA Automation Lead |
| **SLO_SECURITY_PRIVACY** | Zero Critical Defect Floor | 0 unresolved critical vulnerabilities | Gate 06 Auth & Tenant test suite | Security Officer Role |

---

## 3. Failure Isolation Contracts (8 Scenarios)

1. **AI Provider Outage:** Deterministic AST generation, local templates, and publishing remain 100% operational; AI shows an honest unavailable badge.
2. **CRM / Mail Webhook Outage:** Lead is durably committed to PostgreSQL / Record 5 immediately; external delivery is safely deferred to the transactional outbox worker.
3. **Analytics Outage:** Visitor submissions proceed unblocked; missing analytics are recorded as uncollected rather than fabricating synthetic metrics.
4. **Content Service Outage:** Edge CDN serves immutable cached published pages; new draft modifications fail cleanly with informative errors.
5. **Consent Policy Uncertainty:** Fails closed for optional behavioral tracking while allowing essential form submissions.
6. **Build Failure:** Failed release candidates are marked `FAILED`; the active live release pointer is preserved without interruption.
7. **Local Audit Persistence Failure:** Mutations requiring audit logs fail safely and roll back if evidence cannot be written to disk.
8. **Corrupted Artifact Digest:** Candidates with digest mismatches are rejected before reaching staging or production.
