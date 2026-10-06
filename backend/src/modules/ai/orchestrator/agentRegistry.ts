/**
 * ForgeStudio Module 41: Agent Registry
 * Manages registered specialized agents, capabilities, schemas, and constraints.
 */

import { AgentDescriptor, AgentRole } from "./orchestrator.types.js";

class AgentRegistry {
  private agents: Map<AgentRole, AgentDescriptor> = new Map();

  constructor() {
    this.register({
      id: "agent-planner-v1",
      name: "Planning Agent",
      version: "1.0.0",
      role: "PLANNER",
      capabilities: ["requirement_decomposition", "affected_files_prediction", "risk_analysis", "dag_plan_generation"],
      requiredContextProfile: "PlanningAgentContext",
      allowedTools: ["read_file", "list_files", "search_files"],
      timeoutMs: 60000,
      retryPolicy: { maxRetries: 2, backoffMs: 2000 },
    });

    this.register({
      id: "agent-architecture-v1",
      name: "Architecture Agent",
      version: "1.0.0",
      role: "ARCHITECTURE",
      capabilities: ["dependency_analysis", "boundary_validation", "cycle_detection", "drift_detection"],
      requiredContextProfile: "ArchitectureAgentContext",
      allowedTools: ["read_file", "list_files"],
      timeoutMs: 60000,
      retryPolicy: { maxRetries: 2, backoffMs: 2000 },
    });

    this.register({
      id: "agent-coding-v1",
      name: "Coding Agent",
      version: "1.0.0",
      role: "CODING",
      capabilities: ["file_editing", "code_generation", "refactoring", "syntax_repair"],
      requiredContextProfile: "CodingAgentContext",
      allowedTools: ["read_file", "write_file", "delete_file", "list_files"],
      timeoutMs: 120000,
      retryPolicy: { maxRetries: 3, backoffMs: 3000 },
    });

    this.register({
      id: "agent-testing-v1",
      name: "Testing & Verification Agent",
      version: "1.0.0",
      role: "TESTING",
      capabilities: ["build_verification", "test_runner", "diagnostic_analysis", "compile_check"],
      requiredContextProfile: "TestingAgentContext",
      allowedTools: ["run_command", "read_file", "trigger_build"],
      timeoutMs: 180000,
      retryPolicy: { maxRetries: 2, backoffMs: 4000 },
    });

    this.register({
      id: "agent-reviewer-v1",
      name: "Reviewer Agent",
      version: "1.0.0",
      role: "REVIEW",
      capabilities: ["diff_review", "memory_conformance", "security_audit", "regression_check"],
      requiredContextProfile: "ReviewAgentContext",
      allowedTools: ["read_file", "get_diff"],
      timeoutMs: 60000,
      retryPolicy: { maxRetries: 2, backoffMs: 2000 },
    });

    this.register({
      id: "agent-synthesis-v1",
      name: "Synthesis Agent",
      version: "1.0.0",
      role: "SYNTHESIS",
      capabilities: ["outcome_synthesis", "artifact_compilation", "changelog_generation"],
      requiredContextProfile: "DEFAULT",
      allowedTools: ["read_file"],
      timeoutMs: 60000,
      retryPolicy: { maxRetries: 1, backoffMs: 1000 },
    });
  }

  public register(descriptor: AgentDescriptor): void {
    this.agents.set(descriptor.role, descriptor);
  }

  public getAgent(role: AgentRole): AgentDescriptor | undefined {
    return this.agents.get(role);
  }

  public listAgents(): AgentDescriptor[] {
    return Array.from(this.agents.values());
  }
}

export const agentRegistry = new AgentRegistry();
