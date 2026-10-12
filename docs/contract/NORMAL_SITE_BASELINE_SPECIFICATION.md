# ForgeStudio Normal-Site Baseline Specification
**Document Version:** 2.1.0  
**Blueprint Controlling Point:** Point 04 — What Every Generated Website Must Contain  
**Status:** Canonical Platform Standard  

---

## 1. Baseline Provisioning Architecture

When ForgeStudio provisions a website from an approved business brief, it provisions **only** capabilities justified by verified business facts and supported by the selected website profile.

### Core Baseline Pages:
1. **Home (`/`):**
   - Clear value proposition and audience fit.
   - Primary action with a working destination.
   - Overview of approved services or programmes.
   - Truthful evidence (verified accreditation, real founding date, or truthful absence of claim).
   - Process explanation and factual FAQ where provided.
   - **Prohibition:** Strictly no fake testimonials, fabricated reviews, or false customer counts.
2. **Offering Detail (`/offerings` or `/services`):**
   - Detailed suitability, inclusions, delivery method, and constraints.
   - Approved pricing or an honest enquiry path.
   - Clear next step (e.g. contact form).
   - **Prohibition:** No fake booking engines or mock transaction flows.
3. **About and Trust (`/about`):**
   - Verified organization identity and operating history.
   - Accountable contact information and verified team members (where provided).
   - Verified credentials with citation references.
   - **Prohibition:** No stock photos disguised as executive team or fake industry awards.
4. **Contact and Conversion (`/contact`):**
   - Accessible form fields and real-time input validation.
   - Durable lead capture: submissions persist to the database before CRM webhook delivery.
   - Honest fallback communication channels (email, telephone).
   - **Prohibition:** No premature success banners before database write confirmation.
5. **Utility 404 (`/404`):**
   - Semantic error notice for unrecognized routes.
   - Return navigation to Home and search/contact fallback.
6. **Policy Surfaces (`/privacy`, `/terms`):**
   - Reflects actual activated features (e.g., cookie consent, form collection).
   - Explicit review state (`DRAFT` / `APPROVED_LEGAL`).
   - Clearly disclaims legal advice.

---

## 2. Unused Collection Omission Rules

1. ForgeStudio creates collections **only** when explicitly requested by the business brief (e.g., `BLOG_POSTS`, `CASE_STUDIES`).
2. If a collection is not required (e.g. no blog requested), its routes, navigation links, sitemap entries, and templates are **completely omitted**.
3. Empty collections are never populated with "Lorem ipsum" articles or fake personas to simulate volume.
4. The website navigation adapts cleanly without broken or disabled placeholder tabs.

---

## 3. Core Journeys Offline & Resilience Contract

Critical customer journeys must function seamlessly even when optional enhancement layers are offline or disabled:

| Journey | Supported Without Optional Features |
| :--- | :--- |
| **View Website Content** | Works 100% without animation, video, third-party analytics, or live AI connection. |
| **Navigate Pages** | Semantic links (`<a>`) resolve immediately without requiring JavaScript hydration. |
| **Submit Lead Inquiry** | Standard HTML form POST fallback supported if client JavaScript fails. |
| **Access Contact Details**| Direct `mailto:` and `tel:` links available in footer and contact page. |
| **Manage Cookie Preferences** | Essential consent preferences operate locally via standard storage without external tracker dependency. |
