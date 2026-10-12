# 12 | Forms, Leads and Business Truth Architecture
## ForgeStudio Execution Blueprint v2.1 — Point 12 Technical Specification

---

## 1. Executive Summary & Purpose

Point 12 establishes ForgeStudio's authoritative intake and customer enquiry infrastructure. It bridges the public visitor boundary with durable business ledgers (Record 5) through an atomic, 12-step transactional submission sequence, database-backed idempotency, quarantined file uploads, layered abuse controls, authoritative lead lifecycle management, transactional outbox delivery, and truthful disaster recovery disclosures.

---

## 2. Typed, Versioned Form Schemas

Implemented in `formSchema.service.ts`:
- **Schema Contracts**: Every form defines an explicit version number, purpose, fields, and conditional blocks.
- **Field Definitions**: Each field specifies `name`, `type`, accessible `label`, `helpText`, `required`, sensitivity (`PUBLIC`, `INTERNAL`, `PII`, `RESTRICTED`), retention class (`STANDARD`, `GDPR_30_DAY`, `GDPR_90_DAY`, `LEGAL_HOLD`), and `collectionRationale`.
- **Server-Side Conditional Evaluation**: Evaluates rules (`show`, `hide`, `require`). Hidden fields are strictly excluded from required validation and sanitized from the payload to prevent hidden field spoofing.
- **Invariants**: Client-only validation is never trusted; abandoned keystrokes or partial inputs are never recorded as submitted leads.

---

## 3. Quarantined File Uploads

Implemented in `quarantinedUpload.service.ts`:
- **Lifecycle States**: `INITIATED` → `QUARANTINED` → `SCANNING` → `VERIFIED_SAFE` | `REJECTED_MALWARE` | `REJECTED_POLICY` → `ATTACHED_SUBMITTED` | `EXPIRED`.
- **Isolation**: Uploads remain in private quarantine with `isPubliclyAccessible = false` and cannot be downloaded publicly.
- **Malware Scanning**: Evaluates file buffers against virus and malware heuristics (e.g. EICAR test signatures).
- **Safe Attachment**: Forms may only attach uploads that belong to the same tenant and website and possess the `VERIFIED_SAFE` status. Arbitrary client URLs are strictly rejected.

---

## 4. 12-Step Atomic Submission Boundary & Idempotency

Implemented in `atomicSubmissionBoundary.service.ts`:

```
[ Inbound Request ]
        │
        ▼
 1. Resolve Target Website & Active Form Schema
 2. Apply Abuse Controls (Honeypot + Client IP Rate Limit)
 3. Server-Side Schema & Conditional Logic Validation
 4. Verify Quarantined Upload Attachments
 5. Compute Canonical Fingerprint & Check Idempotency Registry
        │
        ├── Duplicate Key + Identical Fingerprint ──► Return Original Receipt (Replay)
        ├── Duplicate Key + Tampered Payload     ──► 409 IDEMPOTENCY_CONFLICT
        │
 6. BEGIN DATABASE TRANSACTION
 7. Insert Accepted Submission Record
 8. Create Authoritative Lead Record (Record 5)
 9. Record Consent & Policy Attribution References
10. Record Redacted Security Audit Event
11. Write Transactional Outbox Event
12. COMMIT TRANSACTION ──► Return Accepted Receipt with Stable Event ID
```

### Idempotency Invariants
- Contact email is never used as a universal deduplication key.
- Timeouts around commit can safely retry with the same key to recover the original receipt without duplicating leads.

---

## 5. Authoritative Lead Lifecycle

Implemented in `leadLifecycle.service.ts`:
- **Lifecycle Stages**: `NEW` → `CONTACTED` → `QUALIFIED` → `WON` | `LOST` | `SPAM`.
- **Qualification Evidence**: Advancing to `QUALIFIED` requires explicit recorded qualification evidence.
- **Source Provenance**: Leads preserve immutable provenance (`WEBSITE_FORM`, `NATIVE_IMPORT`, `CHAT_AGENT`, `PARTNER_REFERRAL`). Imported leads never fabricate website sessions.
- **Controlled Merging**: Merging duplicate leads preserves original identifiers, notes, and audit history.

---

## 6. Transactional Outbox Worker & Guarantees

Implemented in `durableOutboxWorker.service.ts`:
- Outbox events are committed in the same database transaction as the lead.
- Workers acquire fenced leases with tokens. Stale workers attempting to commit after lease expiration are rejected with `STALE_WORKER_LEASE`.
- Failed external deliveries (email, CRM) employ bounded exponential backoff with jitter and transition to `DEAD_LETTER` after maximum attempts.
- **Guaranteed Invariant**: External delivery failure never erases or invalidates the accepted lead.

---

## 7. Disaster Recovery Disclosures

Implemented in `disasterRecoveryAudit.service.ts`:
- **Acknowledged Commit Boundary**: Local PostgreSQL WAL fsync prior to HTTP 201 response.
- **RPO**: Explicitly disclosed as 15 minutes under asynchronous replication. ForgeStudio rejects false claims of zero-RPO disaster recovery without synchronous multi-AZ architecture.
- **RTO**: 60 minutes for automated point-in-time recovery restore.
