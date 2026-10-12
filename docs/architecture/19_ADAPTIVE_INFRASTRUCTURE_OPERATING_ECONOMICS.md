# 19. Adaptive Infrastructure and Operating Economics

**Document Version:** 1.0.0  
**Blueprint Reference:** Point 19 — Adaptive infrastructure and operating economics  
**Repository:** `navinray12/forgestudio-ai`

---

## 1. Executive Architecture Summary

Point 19 establishes a unified, versioned infrastructure architecture supporting four baseline profiles: Native Dev, Docker Compose, Managed Container (AWS ECS / GCP Cloud Run), and Enterprise Kubernetes. It enforces preflighted migration plans, strict exit contracts for optional infrastructure (Redis, RabbitMQ, Kafka, Search), owner-facing upgrade workflows, scale-down protection for pending work, and transparent scenario-based cost models that include failed repair attempts and retries.

### Core Invariants:
1. **Semantic Profile Equivalence:** The Native Dev and Docker Compose baselines maintain identical application semantics to managed cloud and Kubernetes profiles.
2. **Preflighted Migration:** Profile switching requires a 10-step migration plan covering capability deltas, connection pool budgets, database WAL synchronization, and in-flight queue draining.
3. **Primary Truth Invariance:** Optional components (Redis, RabbitMQ, Kafka, Search) never replace PostgreSQL as the authoritative business truth. Transactional outboxes remain authoritative.
4. **Scale-Down Pending Work Protection:** Autoscaling engines cannot scale down worker replicas while in-flight worker leases are active.
5. **Truthful Economics:** Scenario cost models (Low, Base, High) account for failed build attempts and AI repair cycles rather than assuming 100% first-pass success.

---

## 2. Infrastructure Profiles Matrix

| Dimension | Native Dev | Docker Compose | Managed Container | Kubernetes |
| :--- | :--- | :--- | :--- | :--- |
| **Status** | Qualified Baseline | Qualified Baseline | Qualified Production | Planned Enterprise |
| **Target Scale** | Local single-tenant | Staging / testing | Production SaaS | Enterprise multisite |
| **DB Pool Ceiling**| 10 connections | 25 connections | 100 connections | 500 connections |
| **Worker Concurrency**| 2 workers | 5 workers | 20 workers | 100 workers |
| **Scaling Model** | Manual | Manual | Container Autoscale | Horizontal Pod Autoscaler |
| **Estimated Base Cost**| $0 / month | $20 / month | $150 / month | $650 / month |

---

## 3. Optional Capabilities & Exit Contracts

### 3.1 Redis Cache
- Cache keys incorporate five isolation dimensions: `tenantId`, `websiteId`, `revisionId`, `authContext`, and `routeSlug`.
- Cache invalidation flushes matching keys on publication or revocation without touching authoritative database records.

### 3.2 RabbitMQ Task Transport
- Sits downstream of the transactional outbox.
- Implements bounded retries (maximum 5 attempts) before routing unresolvable tasks to the Dead-Letter Queue (DLQ).

### 3.3 Kafka Event Streaming
- Enforces versioned event schemas.
- Filters replay requests to prevent replaying events for contacts who subsequently withdrew consent or opted out.

### 3.4 Search Index Service
- Indexes strictly from authorized source records.
- Query-time permission checks hide draft, private, and trashed content from public crawlers.
