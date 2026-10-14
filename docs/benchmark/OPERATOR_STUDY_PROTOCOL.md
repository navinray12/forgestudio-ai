# ForgeStudio Execution Blueprint v2.1 — Point 03
## Representative Operator Study Protocol & Evidence Integrity

**Protocol Version:** `2.1.0`  
**Current Execution Status:** `FRAMEWORK IMPLEMENTED / HUMAN STUDY NOT YET MEASURED`  
**Reference Requirement:** Blueprint Point 03, Section 8  

---

### 1. Distinction of Separate Operational Statuses

To maintain complete scientific and evidentiary integrity, ForgeStudio strictly separates five distinct statuses:

1. **Benchmark Framework Implementation:** `COMPLETE` (Schemas, task definitions, briefs, APIs, and scoring engine are fully implemented).
2. **Automated Technical Qualification:** `VERIFIED` (Automated checks for release gating, schema evolution, and lead preservation have been executed and verified).
3. **Actual Competitive Benchmark Execution:** `NOT YET MEASURED` (Multi-vendor side-by-side execution has not yet been conducted under controlled lab conditions).
4. **Human Operator-Study Completion:** `NOT YET MEASURED` (No human participant study has been conducted to date; results must be marked `NOT YET MEASURED`).
5. **Published Marketing Claims:** `PROHIBITED` (No public claims of competitive superiority may be made until statuses 3 and 4 are certified).

---

### 2. Participant Recruitment & Experience Categories

Participants must be screened and assigned to one of four calibrated categories:
1. **`NOVICE`**: No prior website building or CMS experience; general computer literacy only.
2. **`BUSINESS_USER`**: Marketing, product, or business operations background; experience with basic office tools and form builders.
3. **`PROFESSIONAL_DESIGNER`**: Professional experience with visual design tools (Figma, Adobe XD) and visual web builders (Webflow, Squarespace, Wix).
4. **`SOFTWARE_ENGINEER`**: Professional full-stack or frontend development experience (React, TypeScript, Next.js, databases).

Minimum sample size for statistically significant qualification: $N \ge 12$ participants per category ($N_{total} \ge 48$).

---

### 3. Standardized Study Protocol

1. **Briefing:**
   - Standardized 5-minute briefing explaining task objectives without giving product tutorials.
   - The same synthetic business brief and pre-cleared asset directory are provided on a clean test workstation.

2. **Starting Conditions:**
   - Fresh browser session in incognito mode.
   - Zero pre-built templates or pre-staged site designs in the user account.
   - Screen recording and telemetry logging activated.

3. **Order Balancing:**
   - Counterbalanced Latin square ordering to eliminate task fatigue or familiarity bias when evaluating multiple platforms.

4. **Assistance Rules:**
   - **Allowed:** Answering clarifying questions about the business brief requirements (e.g., "Does the contact form need a phone field?").
   - **Prohibited:** Guiding the participant on which UI buttons to press, how to write CSS/code, or troubleshooting vendor errors.
   - Any verbal prompt by the proctor is recorded as an `assistanceIntervention`.

5. **Timing Rules:**
   - **Active Elapsed Time:** Stopwatch running only while the participant is actively interacting with the product interface.
   - **Total Elapsed Time:** Wall-clock time including platform loading, deployment waits, and breaks.

6. **Abandonment & Task Failure Rules:**
   - If a participant spends > 60 minutes on a task without completion, the task is terminated and recorded as `ABANDONED / FAILED`.
   - If an unhandled software exception blocks further progress, the task is recorded as `BLOCKED`.

---

### 4. Consent, Privacy & Data Minimization

1. **Informed Consent:** Participants must sign a research consent agreement authorizing audio/screen recording for benchmarking purposes.
2. **Data Minimization:** No personal data, real credit cards, or production client credentials may be used in study tasks.
3. **Access Controls:** Raw operator telemetry and recordings are restricted to authorized research engineers and purged after 90 days.
