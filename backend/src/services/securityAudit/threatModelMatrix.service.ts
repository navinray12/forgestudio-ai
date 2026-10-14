/**
 * ForgeStudio Execution Blueprint v2.1 — Point 18: Security, Privacy, Audit and Abuse Resistance
 * Section 4.1: Threat Model and Verification Plan
 *
 * Rules:
 * 1. Covers 13 threat vectors with mapped mitigations.
 * 2. Version-pinned OWASP ASVS v4.0 Level 2/3 control mapping.
 * 3. Does not label ForgeStudio certified without independent third-party assessment.
 */

export interface ThreatVector {
  id: string;
  name: string;
  description: string;
  owaspAsvsControl: string;
  implementedMitigation: string;
  assessmentRequirement: string;
}

export class ThreatModelMatrixService {
  public static readonly THREAT_VECTORS: ThreatVector[] = [
    {
      id: "THREAT_01_ACCOUNT_TAKEOVER",
      name: "Account Takeover and Session Theft",
      description: "Credential stuffing, session hijacking, or brute force of owner logins",
      owaspAsvsControl: "V2 Authentication & V3 Session Management",
      implementedMitigation: "Bcrypt password hashing, secure/httpOnly/sameSite cookie flags, rate-limited login, MFA step-up",
      assessmentRequirement: "Annual third-party penetration testing",
    },
    {
      id: "THREAT_02_CROSS_TENANT_SUBSTITUTION",
      name: "Cross-Tenant Reads/Writes and Tenant ID Substitution",
      description: "Attacker substitutes tenantId in API parameters or headers to access competitor data",
      owaspAsvsControl: "V4 Access Control (BOLA / IDOR)",
      implementedMitigation: "Server-side tenant resolution from verified JWT/session membership; user-supplied tenant IDs ignored",
      assessmentRequirement: "Automated multi-tenant isolation unit & integration test suites",
    },
    {
      id: "THREAT_03_CUSTOM_CODE_EXECUTION",
      name: "Imported/Custom Code Server-Side Sandbox Escape",
      description: "Malicious customer scripts attempting root shell access, disk traversal, or cluster take-over",
      owaspAsvsControl: "V5 Malicious Input Handling & V14 Build/Deployment",
      implementedMitigation: "Strict fail-closed policy: untrusted server code blocked without kernel-level container/gVisor isolation",
      assessmentRequirement: "Container escape audit and kernel syscall filtering review",
    },
    {
      id: "THREAT_04_SSRF_DNS_REBINDING",
      name: "SSRF and DNS Rebinding",
      description: "Webhooks, link crawlers, or preview bots hitting internal metadata or private subnets",
      owaspAsvsControl: "V12 SSRF Protection & Communication Security",
      implementedMitigation: "Outbound IP firewall blocking loopback (127.0.0.1), private RFC 1918 subnets, and AWS/GCP metadata (169.254.169.254); redirect validation at every hop",
      assessmentRequirement: "SSRF fuzz testing and egress proxy verification",
    },
    {
      id: "THREAT_05_MALICIOUS_UPLOADS",
      name: "Malicious Content and Unsafe Uploads",
      description: "Executable scripts, malware, or HTML/SVG XSS payloads uploaded via form fields",
      owaspAsvsControl: "V12 File Upload Security",
      implementedMitigation: "Quarantine lifecycle, MIME verification, size ceilings, heuristic signature scanning, private non-public storage",
      assessmentRequirement: "Payload bypass testing with SVG and polyglot files",
    },
    {
      id: "THREAT_06_FORGED_CALLBACKS",
      name: "Forged or Replayed Provider Webhook Callbacks",
      description: "Attacker spoofing Stripe, SendGrid, or Meta webhook receipts to trigger fraudulent conversions",
      owaspAsvsControl: "V13 API & Web Service Verification",
      implementedMitigation: "HMAC cryptographic signature verification, replay timestamps within 5-minute tolerance, idempotency keys",
      assessmentRequirement: "Replay and signature tampering integration tests",
    },
    {
      id: "THREAT_07_SOURCE_CORRUPTION",
      name: "Source Deletion, Corruption and Unauthorized Export",
      description: "Accidental or malicious overwriting of customer project history or unapproved source leaks",
      owaspAsvsControl: "V8 Data Protection",
      implementedMitigation: "Immutable source manifests (Record 3), protected-source rules, role-gated export permissions",
      assessmentRequirement: "Source preservation regression gates",
    },
    {
      id: "THREAT_08_ATTESTATION_TAMPERING",
      name: "Evidence and Attestation Tampering",
      description: "Customer build scripts attempting to self-sign release passports or fake passed test gates",
      owaspAsvsControl: "V14 Build Pipeline Integrity (SLSA)",
      implementedMitigation: "Trusted platform verifier signing key isolation; customer scripts prohibited from self-issuance",
      assessmentRequirement: "Cryptographic passport signature verification tests",
    },
    {
      id: "THREAT_09_UNBOUNDED_AI_COSTS",
      name: "Unbounded AI, Build, Search and Provider Spend",
      description: "Denial-of-wallet attacks draining OpenAI API keys or email gateway quotas",
      owaspAsvsControl: "V11 Business Logic & Quota Enforcement",
      implementedMitigation: "Per-tenant and per-action spend budgets, token reservations, bounded query execution",
      assessmentRequirement: "Load and concurrency budget exhaustion tests",
    },
    {
      id: "THREAT_10_MISLEADING_ATTRIBUTION",
      name: "Misleading Analytics and Conversion Attribution",
      description: "Ad networks or malicious visitors injecting fake click IDs to hijack revenue attribution",
      owaspAsvsControl: "V10 Malicious Activity & Analytics Integrity",
      implementedMitigation: "Click ID provenance validation; frozen conversion attribution; refuse-direct fallback rejection",
      assessmentRequirement: "Attribution engine automated test suite",
    },
    {
      id: "THREAT_11_UNAUTHORIZED_CHAT_TOOLS",
      name: "Unauthorized Chat/Tool Actions",
      description: "Prompt injection prompting the LLM to trigger unauthorized refunds, edits, or data leaks",
      owaspAsvsControl: "V5 Input Validation & Tool Boundary",
      implementedMitigation: "Tool authorization, schema validation, and side-effect gating run strictly outside the model",
      assessmentRequirement: "Prompt injection red-teaming",
    },
    {
      id: "THREAT_12_WORKFLOW_QUEUE_ABUSE",
      name: "Workflow Abuse and Queue Exhaustion",
      description: "Infinite loop workflows causing worker thread pool starvation",
      owaspAsvsControl: "V11 Denial of Service & Queue Safety",
      implementedMitigation: "Graph cycle detection, max execution step bounds (50 steps), monotonic worker fencing tokens",
      assessmentRequirement: "Graph validation and lease fencing unit tests",
    },
    {
      id: "THREAT_13_PRIVILEGE_ESCALATION",
      name: "Privilege Escalation via Alternate APIs or WebSockets",
      description: "Normal members attempting admin actions over WebSockets or unauthenticated export endpoints",
      owaspAsvsControl: "V4 Access Control Architecture",
      implementedMitigation: "Centralized authoritative 8-factor authorization applied uniformly across HTTP, SSE, WS, and jobs",
      assessmentRequirement: "Comprehensive authorization matrix regression suites",
    },
  ];

  public static getThreatModel(): { threats: ThreatVector[]; asvsVersion: string; disclaimer: string } {
    return {
      threats: this.THREAT_VECTORS,
      asvsVersion: "OWASP ASVS v4.0.3 Level 2/3",
      disclaimer: "This threat model represents architectural controls and automated verification. Full formal compliance requires independent third-party audit.",
    };
  }
}
