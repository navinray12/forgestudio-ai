# ForgeStudio Capability Registry Specification
**Document Version:** 2.1.0  
**Blueprint Controlling Point:** Point 05 — Turn the Blueprint into an Executable Capability Contract  
**Controlling Authority:** Website Master Blueprint v1.3 (Final Consolidated Edition, 7 October 2026)  
**Status:** Authoritative Platform Standard  

---

## 1. Executive Summary & Controlling Principles

The Capability Registry serves as the **executable, versioned contract** governing all 120 platform capabilities (`CAP-001` through `CAP-120`).

Every capability is defined with immutable source authority, controlling blueprint clauses, domain boundaries, and explicit dependency mappings. The registry is not a passive list or UI mockup; it directly drives runtime admin navigation, route authorization, recipe provisioning, and pre-publish verification.

---

## 2. Capability Classification Rules

Every capability belongs to one of three strictly enforced source classifications:

| Code | Classification | Description & Operating Rule | Count |
| :---: | :--- | :--- | :---: |
| **F** | **Universal Foundation** | Mandatory foundation capability required for all generated websites. **Cannot be made optional** or omitted simply because a site has not activated it. | **64** |
| **G** | **Growth-Platform Capability** | In-scope platform capability. Stays on the platform engineering roadmap even when not active on a particular site. Never downgraded to optional scope. | **41** |
| **B** | **Conditional Business Module** | Evaluated conditionally against the approved business profile (e.g. Commerce, Bookings, LMS, Forums). **Never automatically provisioned on sites that do not require it.** | **15** |
| | **Total Capabilities** | **Strictly preserved from CAP-001 through CAP-120** | **120** |

---

## 3. Five Independent Status Dimensions

Every capability tracks five orthogonal status dimensions. No dimension may be collapsed or derived from a single boolean flag:

```mermaid
graph TD
    CAP[CAP Record] --> Dim1[1. Specification Status]
    CAP --> Dim2[2. Applicability Status]
    CAP --> Dim3[3. Implementation Status]
    CAP --> Dim4[4. Activation Status]
    CAP --> Dim5[5. Verification Status]

    Dim1 --> D1V[UNREVIEWED | DEFINED | AMBIGUOUS | CONFLICTED | APPROVED]
    Dim2 --> D2V[NOT_EVALUATED | APPLICABLE | NOT_APPLICABLE | CONDITION_UNMET | BLOCKED]
    Dim3 --> D3V[NOT_IMPLEMENTED | PARTIAL | IMPLEMENTED | IMPLEMENTATION_BLOCKED]
    Dim4 --> D4V[DISABLED | PENDING_ACTIVATION | ACTIVE | DEGRADED | DISABLING | DISABLED_WITH_RETAINED_DATA | BLOCKED]
    Dim5 --> D5V[UNVERIFIED | IN_PROGRESS | PASSED | FAILED | STALE | BLOCKED]
```

1. **Specification Status:** Quality of the controlling definition (`UNREVIEWED`, `DEFINED`, `AMBIGUOUS`, `CONFLICTED`, `APPROVED`).
2. **Applicability Status:** Whether the capability is applicable to the selected business profile (`NOT_EVALUATED`, `APPLICABLE`, `NOT_APPLICABLE`, `CONDITION_UNMET`, `BLOCKED`).
3. **Implementation Status:** State of actual codebase assets (`NOT_IMPLEMENTED`, `PARTIAL`, `IMPLEMENTED`, `IMPLEMENTATION_BLOCKED`).
4. **Activation Status:** Runtime enablement state (`DISABLED`, `PENDING_ACTIVATION`, `ACTIVE`, `DEGRADED`, `DISABLING`, `DISABLED_WITH_RETAINED_DATA`, `BLOCKED`).
5. **Verification Status:** Current evidence-backed confidence (`UNVERIFIED`, `IN_PROGRESS`, `PASSED`, `FAILED`, `STALE`, `BLOCKED`).

---

## 4. Authoritative Domain Mapping (CAP-001 through CAP-120)

| Domain | Range | Focus Area | Foundation (F) | Growth (G) | Business (B) |
| :--- | :---: | :--- | :---: | :---: | :---: |
| 1. Core Architecture | CAP-001–005 | Express 5.x Host, Document Policy, Modular Core | 5 | 0 | 0 |
| 2. Identity & Tenancy | CAP-006–010 | Multi-Tenancy, Auth, RBAC, Audit Logging | 5 | 0 | 0 |
| 3. Website Lifecycle | CAP-011–015 | CRUD, Soft Delete/Restore, Revisions, Operating Contract | 5 | 0 | 0 |
| 4. Visual Canvas | CAP-016–020 | Drag & Drop, Breakpoints, Containers, Positioning | 4 | 1 | 0 |
| 5. Design System | CAP-021–025 | Global Tokens, Web Fonts, Atomic Classes, Theme Parts | 3 | 2 | 0 |
| 6. Core Widgets | CAP-026–030 | Typography, Media, Buttons, Dividers, HTML Embeds | 5 | 0 | 0 |
| 7. Pro Widgets | CAP-031–035 | Carousels, Pricing Cards, Accordions, Countdowns | 0 | 5 | 0 |
| 8. Navigation | CAP-036–040 | Responsive Menus, Off-Canvas Drawer, Mega Menus | 3 | 2 | 0 |
| 9. Forms & Leads | CAP-041–045 | Accessible Forms, Validation, Durable Leads, CSV | 4 | 1 | 0 |
| 10. Content Truthfulness | CAP-046–050 | Truthful Claims, Evidence Links, Review States, Release Gate | 4 | 1 | 0 |
| 11. Dynamic Content & CMS | CAP-051–055 | Custom Post Types, Fields, Loop Grids, Collection Omission | 1 | 4 | 0 |
| 12. SEO & Metadata | CAP-056–060 | Semantic Meta, Canonical URLs, Sitemaps, OpenGraph, JSON-LD | 3 | 2 | 0 |
| 13. Media Storage | CAP-061–065 | Uploads, Responsive Srcset, WebP, Signed URLs, SVG Guard | 3 | 2 | 0 |
| 14. Accessibility | CAP-066–070 | WCAG 2.1 AA Landmarks, Focus Rings, Skip Links, Scanner | 4 | 1 | 0 |
| 15. Utility Surfaces | CAP-071–075 | Semantic 404, Cookie Consent, Privacy/Terms, Search | 4 | 1 | 0 |
| 16. Action Resolution | CAP-076–080 | Action Router, Dead Link Interceptor, State Machine | 4 | 1 | 0 |
| 17. Resilience | CAP-081–085 | Zero-AI, Zero-Chat, Zero-Tracking, Zero-Motion, SSR | 5 | 0 | 0 |
| 18. WordPress Bridge | CAP-086–090 | WP Auth, Diagnostics, Gutenberg Blocks, Menus, CSS Bridge | 0 | 5 | 0 |
| 19. Publishing Engine | CAP-091–095 | Static Compiler, Scoped CSS, Release Hashing, Rollbacks, ZIP | 4 | 1 | 0 |
| 20. Hosting Destinations | CAP-096–100 | Edge CDN, SFTP Publisher, Custom Domains, SSL, Health Probe | 2 | 3 | 0 |
| 21. Business: Commerce | CAP-101–105 | Product Catalogue, Cart, Stripe, Appointments, Orders | 0 | 0 | 5 |
| 22. Business: Education | CAP-106–110 | LMS Courses, Progress, Discussion Forum, Members, Helpdesk | 0 | 0 | 5 |
| 23. Localization & Tools | CAP-111–115 | Multi-Locale, Translations, Multi-Site, Whitelabel, API Keys | 0 | 5 | 0 |
| 24. Governance | CAP-116–120 | Manifest, Governed Activation, Governed Disable, Release Gate | 5 | 0 | 0 |
| **Total** | **CAP-001–120** | **Comprehensive Platform Scope** | **64 (F)** | **41 (G)** | **15 (B)** |
