# ForgeStudio Execution Blueprint v2.1 — Point 03
## Fair Benchmark Protocol & Methodology Specification

**Protocol Version:** `2.1.0`  
**Status:** Authoritative Protocol Specification  
**Applicability:** ForgeStudio vs Wix Studio, Webflow, Lovable, Framer, WordPress  

---

### 1. Fundamental Principle of Fair Evaluation

To establish genuine competitive authority, every product evaluated under this protocol must be subjected to identical conditions:
1. **Identical Business Brief:** The same scope, page hierarchy, copy, and functional requirements.
2. **Identical Brand & Content Assets:** Pre-cleared vector SVGs, photography, typography tokens, and schema fixtures.
3. **Identical Operator Profile:** Evaluators must be assigned to calibrated experience categories (Novice, Business User, Professional Designer, Software Engineer).
4. **Equalized Budgets:** Fixed active elapsed time budgets (e.g. 45–60 minutes) and transparent accounting of software licensing costs.
5. **No Asymmetric Assistance:** Unlimited vendor engineer coaching or privileged insider workflows are prohibited during competitive runs.

---

### 2. The Hard-Failure Rule: Anti-Masking Policy

> [!CRITICAL]
> **A high composite score must NEVER hide or compensate for a critical outcome failure.**

In traditional synthetic benchmarks, an application that scores 98% on page authoring and styling might receive an "A+" composite grade even if it silently drops visitor leads, corrupts database schemas, or deploys dangerous releases.

Under the ForgeStudio Fair Benchmark Protocol:
1. Any occurrence of a **CRITICAL Defect** immediately flags the benchmark run with `hasCriticalFailure = true`.
2. The `overallOutcome` is **strictly forced** to `CRITICAL_FAILURE`.
3. The provisional composite score (e.g. 88/100) is visibly flagged with:
   `"CRITICAL FAILURE DETECTED: Score is invalid for certification because a critical safety, data loss, or business failure occurred."`

#### Critical Hard-Failure Triggers:
- **Data Loss:** Silent deletion, truncation, or nullification of existing collection records during schema evolution (TASK-04).
- **Silent Lead Loss:** Dropping a customer form lead without local persistence or retry queuing during CRM/third-party downtime (TASK-06).
- **Dangerous Release Deployment:** Allowing a malformed, empty, or unapproved candidate to replace a working live production site (TASK-08).
- **Privileged Runtime Escape:** Executing arbitrary customer or component code inside a privileged shared API process (TASK-05).
- **Permanent Lockout / Unauthorized Takeover:** Complete inability to recover project access after operator loss, or recovery bypassing authentication boundaries (TASK-10).

---

### 3. Defect Classification & Severity Scale

| Severity | Definition | Impact on Scoring |
| :--- | :--- | :--- |
| **CRITICAL** | Severe data loss, silent business failure, uncontained security vulnerability, or production site destruction. | Triggers immediate `CRITICAL_FAILURE` outcome. Composite score invalidated. |
| **HIGH** | Major workflow blocker, broken primary page route, unhandled exception requiring manual reload, or missing core brief requirement. | -10 points penalty per occurrence. |
| **MEDIUM** | Noticeable visual layout overflow, accessibility violation (WCAG AA), sluggish interaction, or missing non-critical styling. | -3 points penalty per occurrence. |
| **LOW** | Minor cosmetic defect, non-blocking typo, subtle spacing inconsistency, or minor warning in telemetry. | -1 point penalty per occurrence. |

---

### 4. Scoring Formulation & Calculation

1. **Task Pass Rate ($R_{pass}$):**
   $$R_{pass} = \frac{N_{passed}}{N_{measured}} \times 100$$
   *(Tasks marked `NOT_YET_MEASURED` are excluded from the denominator to avoid penalizing unexecuted human study protocols).*

2. **Defect Penalty ($P_{defects}$):**
   $$P_{defects} = (N_{high} \times 10) + (N_{medium} \times 3) + (N_{low} \times 1)$$

3. **Provisional Composite Score ($S_{comp}$):**
   $$S_{comp} = \max(0, \operatorname{round}(R_{pass} - P_{defects}))$$

4. **Outcome Mapping:**
   - If `hasCriticalFailure == true` $\longrightarrow$ `CRITICAL_FAILURE`
   - Else if $N_{failed} > 0$ $\longrightarrow$ `FAILED`
   - Else if $N_{high} > 0 \lor N_{medium} > 0$ $\longrightarrow$ `PASS_WITH_DEFECTS`
   - Else $\longrightarrow$ `PASS`

---

### 5. Benchmark Run Data Model

Every run must record and persist:
```json
{
  "runId": "run-1760000000-abcd",
  "createdAt": "2026-10-12T11:00:00Z",
  "config": {
    "protocolVersion": "2.1.0",
    "productName": "ForgeStudio",
    "productVersion": "2.1.0",
    "purchasedPlanOrEntitlement": "Pro Tier ($29/mo)",
    "briefId": "BRIEF-01-SOLARIS-CONSULTING",
    "operatorExperienceLevel": "BUSINESS_USER",
    "enabledIntegrations": ["PostgreSQL", "WordPress Gutenberg Bridge"],
    "startingConditions": "Clean workspace, assets pre-staged in media library",
    "preparedAssetsDescription": "SVGs, 12 article JSONs, 4 photography assets",
    "costAssumptionsDescription": "Single user pro license billed monthly",
    "actualCostUsd": 29.00
  },
  "taskResults": [ ... ],
  "summary": {
    "totalTasks": 10,
    "tasksPassed": 8,
    "tasksFailed": 0,
    "tasksBlocked": 0,
    "tasksNotMeasured": 2,
    "hasCriticalFailure": false,
    "overallOutcome": "PASS",
    "provisionalCompositeScore": 95
  },
  "knownLimitationsAndUncertainty": [ ... ]
}
```
