# 13 | Marketing, Analytics and Truthful Conversion Evidence Architecture
## ForgeStudio Execution Blueprint v2.1 — Point 13 Technical Specification

---

## 1. Executive Summary & Purpose

Point 13 governs the collection, attribution, and reporting of visitor analytics and marketing conversion evidence. It separates operational telemetry from optional analytics and authoritative business ledgers, enforces strict consent gates, prevents PII leakage into analytics pipelines, normalizes campaign attribution without fabricating "direct" sources, and ensures growth metrics reflect truthful mathematical definitions.

---

## 2. Three Distinct Data Domains

Implemented in `telemetryAnalyticsBoundary.service.ts`:
1. **Operational Telemetry**: Service health, worker errors, audit trail. Retained 90 days. Does not require visitor consent.
2. **Optional Behavioral Analytics**: Pageviews, CTA clicks, campaign touches, click IDs. Retained 365 days. Strictly gated by opt-in visitor consent. **Invariant**: Analytics refusal or blocking can NEVER prevent a visitor from submitting a form or completing a transaction.
3. **Authoritative Business Ledgers**: Accepted leads, qualification records, transactions. Retained 7 years. Core business processing.

---

## 3. Measurement SDK Contract & PII Sanitization

Implemented in `measurementEventContract.service.ts`:
- **Prohibited Attributes**: Emails, phone numbers, passwords, raw query strings, form contents, chat transcripts, and coordinates are stripped prior to storage and dispatch.
- **Network Payload Inspection**: Serialized outgoing JSON payloads are inspected to ensure SDK enrichment or automatic context capture hasn't reintroduced leaked credentials or PII.

---

## 4. Fail-Closed Consent Engine & Immediate Withdrawal

Implemented in `consentDecisionEngine.service.ts`:
- **States**: `GRANTED`, `REFUSED`, `WITHDRAWN`, `UNKNOWN`, `EXPIRED`, `NOT_APPLICABLE`.
- **Fail-Closed**: If consent state is `UNKNOWN` or `EXPIRED`, event dispatch is blocked locally.
- **Withdrawal**: Immediate cancellation of eligible queued events. Pre-consent history is never backfilled or replayed if consent is granted later.

---

## 5. Browser Exposure Correctness

Implemented in `exposureValidator.service.ts`:
- Rejects automated link crawlers, preview bots, and speculative prefetches.
- Rejects hidden or prerendered tab contexts.
- Requires a minimum continuous visible duration of 1,000ms on the active tab for a verified impression.

---

## 6. Attribution & Campaign Link Builder

Implemented in `attributionEngine.service.ts`:
- Normalizes UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`).
- Preserves click ID provenance (`gclid`, `fbclid`, `msclkid`, `ttclid`).
- Conversion-time attribution snapshot is frozen. Unknown or refused attribution is explicitly recorded as `UNKNOWN` or `REFUSED` and is **never fabricated as "direct"**.

---

## 7. Mathematical Growth Metric Definitions

Implemented in `truthfulMetricsEngine.service.ts`:
- **Binary Measured-Session Conversion Rate**: `(Sessions with >= 1 lead) / (Eligible measured sessions) * 100` (capped at 100%).
- **Leads Per Measured Session (Density)**: `(Total eligible accepted leads) / (Eligible measured sessions) * 100` (can legitimately exceed 100%).
- **Total Authoritative Business Leads**: Total count of all accepted leads committed to Record 5.
- **Cohort Qualification Rate**: `(Qualified leads in mature cohort) / (Total leads in mature cohort) * 100`.

---

## 8. Provider Adapters & Growth Capability Gates

Implemented in `providerAdapters.service.ts` and `growthCapabilityGate.service.ts`:
- Google Enhanced Conversions for Leads and Meta Conversions API (CAPI) adapters normalize payloads with canonical `event_id` deduplication.
- If credentials or OAuth scopes are missing, adapters fail closed with required missing prerequisites. ForgeStudio **never fabricates mock provider delivery receipts**.
- Real growth actions (collection, audience writes, ad spend) are gated on Point 05 capabilities (`CAP-101`, `CAP-105`), operator permissions, and remaining budget limits.
