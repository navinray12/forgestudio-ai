# ForgeStudio Execution Blueprint v2.1 — Point 03
## Benchmark Task Registry & Heterogeneous Business Briefs

**Document Version:** `2.1.0`  
**Scope:** Ten Benchmark Tasks (TASK-01 to TASK-10) and Ten Heterogeneous Business Briefs (BRIEF-01 to BRIEF-10)  

---

### 1. The Ten Required Benchmark Tasks

| Task ID | Task Name | Category | Hard Failure? | Primary Focus |
| :--- | :--- | :--- | :---: | :--- |
| **`TASK-01-CREATE-WEBSITE`** | Create a Website | Core Authoring | No | Complete site creation from brief, asset kit, navigation, and pages within 45 min. |
| **`TASK-02-MOBILE-A11Y`** | Mobile Accessibility | Experience & A11y | No | Viewport responsiveness (375px/414px), touch targets $\ge$ 44px, WCAG AA contrast. |
| **`TASK-03-PUBLISH-ARTICLE`** | Add & Publish Article | CMS Dynamic | No | Editorial post creation, draft saving, release publish, and HTTP 200 public route verification. |
| **`TASK-04-SCHEMA-EVOLUTION`** | Change Used Collection Field | CMS Dynamic | **YES** | Schema field modification without silent record truncation or template rendering crash. |
| **`TASK-05-STATEFUL-COMPONENT`** | Reuse Stateful Component | Custom Components | **YES** | Interactive React calculator integration without privileged execution in host process. |
| **`TASK-06-CRM-OUTAGE-LEAD`** | Collect Synthetic Lead During Outage | Business & CRM | **YES** | Simulated 503 destination failure; lead must persist locally and queue for retry. |
| **`TASK-07-INTERRUPTED-EDIT-RECOVERY`** | Recover Interrupted Edit | Recovery & Safety | No | Browser crash/disconnect simulation; $\ge$ 90% uncommitted edits restored via draft journal. |
| **`TASK-08-REJECT-DANGEROUS-RELEASE`** | Reject Dangerous Release | Recovery & Safety | **YES** | Malformed release candidate blocked by validator; live site continues running with 0 downtime. |
| **`TASK-09-PORTABLE-HOSTING-PUBLISH`** | Move to Fresh Hosting & Publish | Portability | No | Export site, install in clean isolated container, verify pages and standalone publishing. |
| **`TASK-10-OPERATOR-ACCOUNT-RECOVERY`** | Recover Operator Account Loss | Governance & Auth | **YES** | Primary operator lockout simulation; audited recovery without weakening authentication. |

---

### 2. The Ten Heterogeneous Synthetic Business Briefs

Each scenario represents a genuinely distinct architectural structure, workflow, and lifecycle requirement:

#### 1. `BRIEF-01-SOLARIS-CONSULTING` — Strategic Advisory
- **Archetype:** Content-Led Business Website (B2B Consulting)
- **Key Architecture:** 5 pages (Home, Practices, Insights, Case Studies, Contact). Dynamic insights collection with taxonomy filtering and executive RFP form.
- **Portability Profile:** Static HTML/JS export capable of running on AWS S3 / CloudFront.

#### 2. `BRIEF-02-VANGUARD-LEGAL` — Corporate Law Firm
- **Archetype:** Professional Services Firm (Legal & Compliance)
- **Key Architecture:** Attorney bios directory with practice area multi-select, dynamic attorney detail pages, and conflict-of-interest disclaimer intake form.
- **Portability Profile:** Node.js target host with preserved server-side form handling.

#### 3. `BRIEF-03-APEX-ACADEMY` — Executive Education Institute
- **Archetype:** Training Program Catalogue (Non-LMS)
- **Key Architecture:** Program brochure catalogue, cohort date dropdowns, expandable syllabus curriculum modules. Explicitly excludes LMS video players/quizzes.
- **Portability Profile:** Netlify static bundle with serverless form routing.

#### 4. `BRIEF-04-CHRONICLE-DIGITAL` — Urbanist Architecture Journal
- **Archetype:** Editorial & Resource Publication (High-Volume Content)
- **Key Architecture:** Long-form photo essays, article archives with topic/year filtering, reading progress bar, pull quotes, and research report gated download.
- **Portability Profile:** WordPress REST API / Gutenberg block cross-compatibility.

#### 5. `BRIEF-05-NEXUS-TALENT` — Creative Talent Agency
- **Archetype:** Collection-Driven Directory
- **Key Architecture:** Talent roster with hover image preview, responsive portfolio lightbox gallery, and pre-selected booking inquiry modal.
- **Portability Profile:** Full Next.js developer workspace export with image optimization.

#### 6. `BRIEF-06-PULSE-FITNESS` — High-Performance Athletic Facility
- **Archetype:** Lead-Generation Website
- **Key Architecture:** Multi-step free trial pass application form, interactive weekly schedule day selector, and high-priority lead resilience during CRM downtime (TASK-06).
- **Portability Profile:** Docker container runtime with PostgreSQL/SQLite fallback.

#### 7. `BRIEF-07-CALC-FINANCIAL` — Mortgage & Lending Advisory
- **Archetype:** Stateful Custom Component Tool
- **Key Architecture:** Interactive React mortgage calculator with live slider calculation, principal/interest breakdown, and pre-approval questionnaire (TASK-05).
- **Portability Profile:** Bridged React/TypeScript source code export with preserved props.

#### 8. `BRIEF-08-AURA-PROPERTIES` — Luxury Real Estate Brokerage
- **Archetype:** Dynamic Inventory with Schema Evolution
- **Key Architecture:** Property listing filters, architectural spec matrices, and schema evolution scenario adding fields without deleting existing records (TASK-04).
- **Portability Profile:** Full relational database export with media path preservation.

#### 9. `BRIEF-09-BEACON-NONPROFIT` — Conservation Community Trust
- **Archetype:** Portable Self-Hosted Community Site
- **Key Architecture:** Zero proprietary SaaS lock-in, impact counter, volunteer application, and standalone independent publishing on target host outside cloud (TASK-09).
- **Portability Profile:** Completely self-contained offline container export with local SQLite.

#### 10. `BRIEF-10-HORIZON-HEALTH` — Regional Healthcare System
- **Archetype:** Multi-Operator Governance & Safe Release Site
- **Key Architecture:** Emergency alert banner, clinical locations directory, HIPAA-aware scheduling intake, dangerous release rejection (TASK-08), and operator succession (TASK-10).
- **Portability Profile:** Hardened enterprise container with health probe endpoint.
