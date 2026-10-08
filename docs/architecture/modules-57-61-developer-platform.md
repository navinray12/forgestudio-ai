# ForgeStudio Standalone Developer Platform Capabilities (Modules 57–61)

This document provides complete architectural specifications, database schemas, API interfaces, and system guarantees for the five standalone developer-platform capabilities integrated into ForgeStudio:

1. **Module 57: Collaborative Development**
2. **Module 58: Forge Extension & Plugin SDK**
3. **Module 59: Project Import & Migration**
4. **Module 60: Monorepo & Multi-service Support**
5. **Module 61: Container & Infrastructure Tooling**

---

## Architecture Integration Map

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 Developer Workspace                    │
                  │   (Multi-File Editor, Live Preview, Visual Sync)       │
                  └───────────────────────────┬────────────────────────────┘
                                              │
    ┌─────────────────────────┬───────────────┴───────────────┬─────────────────────────┐
    ▼                         ▼                               ▼                         ▼
┌───────────────┐     ┌───────────────┐               ┌───────────────┐         ┌───────────────┐
│   Module 57   │     │   Module 58   │               │   Module 59   │         │   Module 60   │
│ Collaboration │     │  Plugin SDK   │               │Import/Migrate │         │   Monorepo    │
│  & Live Sync  │     │ & Capabilities│               │& Detection    │         │  & Services   │
└───────┬───────┘     └───────┬───────┘               └───────┬───────┘         └───────┬───────┘
        │                     │                               │                         │
        └─────────────────────┼───────────────────────────────┴─────────────────────────┘
                              │
                              ▼
                      ┌───────────────┐
                      │   Module 61   │
                      │  Containers   │
                      │  & Cloud IaC  │
                      └───────┬───────┘
                              │
    ┌─────────────────────────┴───────────────────────────────┐
    ▼                                                         ▼
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│     Persistent Filesystem       │           │   PostgreSQL Self-Healing       │
│  (forgeFilesystem.service.ts)   │           │      (ensure-schema.ts)         │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

---

## 1. Module 57: Collaborative Development

### Capabilities
- **Live Presence & Cursors:** WebSocket-powered presence channels (`/ws/presence` and `/ws/collaboration`) streaming active file, line/column cursor positions, and selections.
- **3-Way Conflict Resolution:** Server-authoritative revision detection comparing `baseRevisionId`, `currentFileContent`, and `incomingContent` to prevent silent overwrites. Resolution modes: `MERGE`, `KEEP_CURRENT`, `ACCEPT_INCOMING`.
- **Code Comments & Mentions:** Threaded annotations scoped to project, file, and line ranges with author tagging, @mentions, and resolved/reopened statuses.
- **Review Requests:** Review governance workflows tracking approvals, requested changes, and reviewer assignments with Git branch linkage.
- **Shared Preview Sessions:** Multi-user synchronized live preview sessions with lockable route navigation and viewport dimensions.
- **Activity Timeline:** Project-scoped immutable audit log of developer events.

### Database Tables
- `forge_collaborator_session`
- `forge_file_conflict`
- `forge_file_comment`
- `forge_comment_reply`
- `forge_review_request`
- `forge_review_decision`
- `forge_shared_preview_session`
- `forge_collab_activity`

---

## 2. Module 58: Forge Extension & Plugin SDK

### Capabilities
- **Strict Manifest Validation:** Enforces `PluginManifestSchema` validating semantic versioning, compatibility engine thresholds, and explicit permission declarations.
- **11-Stage Lifecycle:** `DISCOVER` -> `INSTALL` -> `VERIFY` -> `ENABLE` -> `INITIALIZE` -> `REGISTER` -> `EXECUTE` -> `MONITOR` -> `DISABLE` -> `UPDATE` -> `UNINSTALL`.
- **Lifecycle Hooks:** Execution gates for `preBuild`, `postBuild`, `preDeploy`, `postDeploy`, and `onFileChange` with timeout boundaries.
- **AI Tool Integration:** Extensions can register typed JSON-schema tools accessible to the Forge AI Coding and Architecture Agents.
- **Cryptographic Trust & Signing:** Author verification and permission-boundary checks.

### Database Tables
- `forge_plugin`
- `forge_plugin_version`
- `forge_plugin_installation`
- `forge_plugin_execution`

---

## 3. Module 59: Project Import & Migration

### Capabilities
- **Non-Destructive Staging:** Imported repositories are fetched into an isolated staging sandbox before committing to the primary project filesystem.
- **Framework & Runtime Detection:** Automated heuristic recognition for React, Next.js, Vite, Node, Express, and NestJS.
- **Lockfile & Package Manager Discovery:** Identifies `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, and `bun.lockb`.
- **Secret Masking:** Discovers environment variable references (`process.env.KEY`) without logging or persisting actual secret values.
- **Symbol & Architecture Indexing:** Generates structural dependency maps for the AI Context Engine.

### Database Tables
- `forge_import_job`
- `forge_migration_plan`

---

## 4. Module 60: Monorepo & Multi-service Support

### Capabilities
- **Workspace Discovery:** Detects pnpm workspaces (`pnpm-workspace.yaml`), Turborepo (`turbo.json`), Nx (`nx.json`), and npm/yarn workspaces.
- **Package Hierarchy:** Categorizes repository entities into `APP`, `SERVICE`, `PACKAGE`, `DOCS`, and `TOOL`.
- **Topological Build Order:** Computes Directed Acyclic Graph (DAG) dependencies for deterministic build sequencing.
- **Affected Package Analysis:** Traces file diffs through the DAG to identify downstream impacted packages.
- **Coordinated Deployment Plans:** Generates staged deployment pipelines ensuring shared packages deploy prior to dependent consumer applications.

### Database Tables
- `forge_monorepo_workspace`
- `forge_workspace_package`
- `forge_package_dependency`
- `forge_service_runtime_config`

---

## 5. Module 61: Container & Infrastructure Tooling

### Capabilities
- **Multi-Stage Dockerfile Generation:** Produces production-ready Dockerfiles with dependency caching, non-root user execution (`USER node`), and minimal base images.
- **Sandboxed Container Runner:** Local container build and run management with host/container port mapping, resource governance, and health polling.
- **Docker Compose Orchestration:** Parses and generates multi-container compose topologies.
- **Kubernetes Manifest Generation:** Emits cloud-neutral Kubernetes specifications (`Deployment`, `Service`, `ConfigMap`, `Ingress`).
- **Terraform Infrastructure as Code (IaC):** Emits parameterized Terraform modules (`main.tf`, `variables.tf`, `outputs.tf`).
- **Zero-Trust Security Scanner:** Scans IaC definitions for hardcoded API keys, unpinned `:latest` tags, and root container privileges.

### Database Tables
- `forge_container_definition`
- `forge_container_build`
- `forge_container_run`
- `forge_infrastructure_definition`
- `forge_infra_validation_report`

---

## REST Endpoints Overview

| Method | Endpoint | Module | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/:id/collaboration/sessions` | M57 | List active presence sessions |
| `POST` | `/:id/collaboration/heartbeat` | M57 | Send presence heartbeat & cursor position |
| `POST` | `/:id/collaboration/conflict/detect` | M57 | Detect 3-way file conflicts |
| `POST` | `/:id/collaboration/conflict/resolve` | M57 | Resolve conflict with selected strategy |
| `GET` | `/:id/collaboration/comments` | M57 | List project file comments |
| `POST` | `/:id/collaboration/comments` | M57 | Create new comment with @mentions |
| `POST` | `/:id/collaboration/reviews` | M57 | Submit review request |
| `GET` | `/:id/collaboration/timeline` | M57 | Fetch activity timeline events |
| `GET` | `/:id/extensions` | M58 | List installed plugins |
| `POST` | `/:id/extensions/install` | M58 | Install plugin from manifest |
| `POST` | `/:id/extensions/:pluginId/enable` | M58 | Enable installed plugin |
| `POST` | `/:id/extensions/:pluginId/disable` | M58 | Disable plugin |
| `DELETE` | `/:id/extensions/:pluginId` | M58 | Uninstall plugin |
| `POST` | `/:id/extensions/hooks/execute` | M58 | Execute lifecycle hook |
| `POST` | `/:id/import/start` | M59 | Start repository import pipeline |
| `GET` | `/:id/import/jobs/:jobId` | M59 | Query import status & analysis |
| `POST` | `/:id/import/jobs/:jobId/commit` | M59 | Commit staged import into project |
| `GET` | `/:id/monorepo/graph` | M60 | Query workspace packages & dependency DAG |
| `POST` | `/:id/monorepo/affected` | M60 | Find packages affected by changed files |
| `POST` | `/:id/monorepo/deploy-plan` | M60 | Generate coordinated deploy plan |
| `GET` | `/:id/containers/dockerfile` | M61 | Detect or inspect Dockerfile |
| `POST` | `/:id/containers/dockerfile/generate` | M61 | Generate multi-stage Dockerfile |
| `POST` | `/:id/containers/build` | M61 | Trigger container build |
| `POST` | `/:id/containers/run` | M61 | Run sandboxed container |
| `GET` | `/:id/containers` | M61 | List running containers |
| `DELETE` | `/:id/containers/:runId` | M61 | Terminate running container |
| `POST` | `/:id/infra/kubernetes/generate` | M61 | Generate Kubernetes manifests |
| `POST` | `/:id/infra/terraform/generate` | M61 | Generate Terraform IaC definitions |
| `GET` | `/:id/infra/validate` | M61 | Perform zero-trust policy & secret scan |

---

## CLI Integration Overview

```bash
# Module 57: Collaboration
forge collaborate sessions
forge collaborate timeline

# Module 58: Extensions
forge plugin list
forge plugin enable <id>
forge plugin disable <id>

# Module 60: Monorepo
forge monorepo
forge monorepo affected <files...>
forge monorepo deploy-plan

# Module 61: Containers & Infrastructure
forge container list
forge container build [tag]
forge container run [tag]
forge container stop <runId>
forge infra validate
forge infra kubernetes
forge infra terraform
```
