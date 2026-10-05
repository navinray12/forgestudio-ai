# ForgeStudio Support Ticket System — Architecture & Documentation

## Overview

The **ForgeStudio Support Ticket System** is a production-grade, multi-tenant customer support and issue resolution system embedded directly into the ForgeStudio ecosystem. It enables seamless ticket creation, support agent routing, internal collaboration, SLA compliance tracking, secure attachment handling, and audit logging while maintaining workspace multi-tenancy and RBAC isolation.

---

## 1. Database Schema & Data Models

The system is defined in `backend/prisma/schema.prisma`:

### Enums
- **`SupportTicketStatus`**: `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_CUSTOMER`, `CUSTOMER_REPLIED`, `RESOLVED`, `CLOSED`, `REOPENED`
- **`SupportTicketPriority`**: `LOW`, `NORMAL`, `HIGH`, `URGENT`
- **`SupportTicketSource`**: `WEB`, `EMAIL`, `API`, `SYSTEM`
- **`SupportTicketMessageType`**: `PUBLIC_REPLY`, `INTERNAL_NOTE`, `SYSTEM_EVENT`

### Core Models
1. **`SupportCategory`**: Hierarchical issue categories with ordering and active flags.
2. **`SupportTeam` & `SupportTeamMember`**: Multi-agent support teams for queue assignment.
3. **`SupportSlaPolicy`**: Configurable response and resolution time targets per priority.
4. **`SupportTicket`**: Core ticket record associated with `User`, `Workspace`, `Website`, `SupportCategory`, and `SupportTeam`. Generates unique human-readable ticket numbers (`FS-1001`).
5. **`SupportTicketMessage`**: Ticket conversation messages (public replies vs staff internal notes).
6. **`SupportTicketAttachment`**: File attachments bound to tickets/messages with strict MIME and extension validation.
7. **`SupportTicketEvent`**: Immutable event audit log tracking field changes and lifecycle transitions.

---

## 2. Security & RBAC Enforcement

RBAC is enforced by `backend/src/middlewares/supportAuthorization.middleware.ts`:

| Permission Role | Allowed Actions |
|---|---|
| **`USER`** | Create ticket, view own tickets/attachments, post public replies, resolve/reopen own tickets |
| **`SUPPORT_AGENT`** | View workspace tickets, assign tickets, update status/priority, post **Internal Notes**, view SLA |
| **`SUPPORT_MANAGER`** | Manage support teams, categories, SLA policies, reassign tickets, view analytics |
| **`SUPPORT_ADMIN` / `ADMIN` / `SUPER_ADMIN`** | Full access across all support features, system configuration, audit logs |

### Security Measures
- **IDOR Protection**: Customers can ONLY view tickets where `userId === req.user.id` or `workspaceId` matches.
- **Internal Note Isolation**: DTO transformers sanitize ticket responses for regular customers, guaranteeing `INTERNAL_NOTE` content is NEVER exposed to non-staff users.
- **Attachment Storage**: Uploads are restricted by extension (executables blocked) and size (default 10MB).

---

## 3. Backend Services & Architecture

Found in `backend/src/services/support/`:

- **`ticket.service.ts`**: Handles CRUD, ticket number generation (`FS-1001`), and multi-tenant scoping.
- **`ticketMessage.service.ts`**: Handles public replies and internal notes with role checking.
- **`ticketAssignment.service.ts`**: Assigns tickets to agents or teams with event logging.
- **`ticketSla.service.ts`**: Evaluates SLA targets, response countdowns, and breach status.
- **`ticketNotification.service.ts`**: Dispatches system notifications on ticket state changes.
- **`ticketAttachment.service.ts`**: Securely handles file upload parsing and downloads.
- **`ticketSearch.service.ts`**: Server-side filtering, text search, and pagination.
- **`ticketAudit.service.ts`**: Logs immutable state transition events.
- **`supportAnalytics.service.ts`**: Aggregates ticket volume, status breakdown, average response times, and SLA compliance percentages.

---

## 4. API Endpoints

Mounted under `/api/v1/support/` and `/api/support/`:

| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `GET` | `/categories` | List support categories | `ticket:create` |
| `POST` | `/categories` | Create ticket category | `ticket:manage_categories` |
| `GET` | `/teams` | List support teams | `ticket:manage_teams` |
| `POST` | `/teams` | Create support team | `ticket:manage_teams` |
| `GET` | `/tickets` | List tickets (with filters & search) | `ticket:view_own` |
| `POST` | `/tickets` | Create support ticket | `ticket:create` |
| `GET` | `/tickets/:id` | Get ticket details & messages | `ticket:view_own` |
| `POST` | `/tickets/:id/messages` | Add public reply / internal note | `ticket:reply` |
| `POST` | `/tickets/:id/attachments` | Upload attachment | `ticket:reply` |
| `GET` | `/tickets/:id/attachments/:attId/download` | Secure file download | `ticket:view_own` |
| `POST` | `/tickets/:id/assign` | Assign agent or team | `ticket:assign` |
| `POST` | `/tickets/:id/status` | Update ticket status | `ticket:change_status` |
| `POST` | `/tickets/:id/priority` | Update ticket priority | `ticket:change_priority` |
| `POST` | `/tickets/:id/resolve` | Mark ticket resolved | `ticket:resolve` |
| `POST` | `/tickets/:id/reopen` | Reopen ticket | `ticket:reopen` |
| `POST` | `/tickets/:id/close` | Close ticket | `ticket:close` |
| `GET` | `/analytics` | Get support analytics metrics | `ticket:view_analytics` |

---

## 5. Frontend UI & Dashboard

Found in `frontend/src/features/support/`:

- **Components**:
  - `TicketStatusBadge`: Status pill with color scheme.
  - `TicketPriorityBadge`: Priority pill with urgency indicators.
  - `SlaBadge`: SLA status badge (On Track, Warning, Breached, Completed).
  - `InternalNoteCard`: Distinct Amber/Gold card styling with lock icon for staff-only internal notes.
  - `TicketComposer`: Message editor supporting toggle between Public Reply and Internal Note with file attachment.
  - `TicketTimeline`: Chronological stream of messages, internal notes, and system events.
  - `TicketMetadataSidebar`: Technical context display (Browser, OS, WordPress status, site ID).
  - `TicketTable` & `TicketFiltersBar`: Paginated table and search filter bar.
- **Pages**:
  - `TicketListPage` (`/support`): Main ticket queue.
  - `CreateTicketPage` (`/support/new`): Ticket submission form with environment capture.
  - `TicketDetailsPage` (`/support/tickets/:id`): Full conversation timeline and staff controls.
  - `SupportAdminViewPage` (`/support/admin`): Governance command center for teams, SLA policies, and analytics.

---

## 6. Testing & Quality Assurance

- **Unit & Security Tests**: `backend/src/tests/support-system.test.ts`
  - Validates RBAC permissions across all user roles.
  - Enforces valid status transition state machine.
  - Tests SLA target calculations and breach detection.
  - Validates attachment file extension sanitization and path traversal prevention.
- **E2E Lifecycle Tests**: `backend/src/tests/support-e2e-lifecycle.test.ts`
  - Verifies 11-step end-to-end customer-to-agent lifecycle.
  - Verifies strict hiding of internal notes from customer DTO payload.
