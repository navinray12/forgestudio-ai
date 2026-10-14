# ForgeStudio Execution Blueprint v2.1 — Point 03
## Visual Quality vs. Customer Task Success Evaluation Matrix

**Document Version:** `2.1.0`  
**Reference Requirement:** Blueprint Point 03, Section 9  

---

### 1. Dual Independent Evaluation Axes

A fundamental flaw of contemporary website builder benchmarks is the conflation of **aesthetic appearance** with **functional operational success**. 

- A website may look stunning in a desktop screenshot but suffer from severe accessibility violations, broken mobile tap targets, or unhandled form submission crashes.
- Conversely, a functional site may capture leads reliably but exhibit amateurish typography, poor visual hierarchy, or uncalibrated color contrast.

ForgeStudio evaluates website benchmarks along two **independent, orthogonal axes**:

```
                       High Visual Quality
                               │
               Quadrant II     │    Quadrant I
               "Broken Art"    │    "Market Benchmark"
            (Aesthetic but     │    (Professional visual
             fails workflows)  │     design + 100% works)
                               │
 ──────────────────────────────┼──────────────────────────────
 Low Task Success              │              High Task Success
                               │
               Quadrant III    │    Quadrant IV
             "Total Failure"   │    "Functional Utility"
            (Ugly & Broken)    │    (Works reliably but
                               │     crude aesthetics)
                               │
                       Low Visual Quality
```

---

### 2. Dimension A: Visual Quality Evaluation (Aesthetic & Polish)

Evaluated across four structured criteria:
1. **Typography & Layout Hierarchy:**
   - Consistent modular scale (H1-H6, body, caption).
   - Line-height proportions (1.2–1.3 for headings, 1.5–1.6 for body).
   - Grid alignment and vertical rhythm consistency.
2. **Color Harmony & Contrast:**
   - Curated HSL color palette with defined primary, secondary, neutral, and accent tones.
   - Compliance with WCAG 2.1 AA contrast ratios ($\ge 4.5:1$ for normal text, $\ge 3:1$ for large text).
3. **Responsive Viewport Polish:**
   - Fluid typography and graceful container downscaling at 375px, 414px, 768px, 1024px, and 1440px.
   - Zero horizontal scrollbars or element collisions on small viewports.
4. **Interactive States & Micro-Interactions:**
   - Smooth hover, active, and focus transitions.
   - Non-jarring layout shifts (Cumulative Layout Shift $< 0.1$).

*Methodological Rule:* Screenshot similarity or automated perceptual hash (pHash) alone **never** establishes visual quality. Visual polish requires inspection of responsive layout reflow and interactive states.

---

### 3. Dimension B: Customer Task Success (Functional Operational Capability)

Evaluated by deterministic execution of real business workflows:
1. **Navigation & Route Integrity:** Every navigation link and breadcrumb resolves with HTTP 200 without broken routes or 404s.
2. **Dynamic Content & CMS Fidelity:** Collections render cards, detail pages, and dynamic pagination with accurate data binding.
3. **Business Workflow Execution:** Form submissions validate inputs, persist leads durably in PostgreSQL, and survive third-party outages (TASK-06).
4. **Release Gating & State Integrity:** Releases are verifiable and dangerous candidates are blocked from live production traffic (TASK-08).
5. **Portability & Independent Operation:** Exported code can be installed and operated in an isolated target environment without origin dependencies (TASK-09).

---

### 4. Methodological Safeguard

> [!WARNING]
> Visual quality evaluations that involve subjective styling assessments must be explicitly labeled as **SUBJECTIVE EVALUATIONS WITH CONFIDENCE BOUNDS**, never reported as indisputable objective facts. Functional task success metrics (HTTP codes, database records, latency ms) must remain separated from aesthetic scores.
