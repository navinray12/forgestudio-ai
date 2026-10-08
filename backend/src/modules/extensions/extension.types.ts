/**
 * ForgeStudio Module 58: Forge Extension & Plugin SDK Types
 */

export type PluginPermission =
  | "filesystem.read"
  | "filesystem.write"
  | "terminal.execute"
  | "network.request"
  | "database.read"
  | "database.write"
  | "git.read"
  | "git.write"
  | "deployment.read"
  | "deployment.write"
  | "ai.tool"
  | "project.read"
  | "project.write";

export type PluginTrustLevel = "OFFICIAL" | "VERIFIED" | "COMMUNITY" | "UNTRUSTED" | "REVOKED";

export type PluginInstallationStatus = "ENABLED" | "DISABLED" | "ERROR" | "UPDATING";

export interface PluginCommand {
  id: string;
  title: string;
  category?: string;
  icon?: string;
  keybinding?: string;
  handler: string;
}

export interface PluginPanel {
  id: string;
  title: string;
  icon?: string;
  location: "SIDEBAR" | "BOTTOM" | "EDITOR_RIGHT" | "MODAL";
  entrypoint: string;
}

export interface PluginAiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  handler: string;
}

export interface PluginGeneratorDefinition {
  id: string;
  name: string;
  type: "PROJECT" | "COMPONENT" | "CODE" | "TEMPLATE" | "MIGRATION";
  description: string;
  handler: string;
}

export interface PluginBuildHooks {
  preBuild?: string;
  postBuild?: string;
  preTest?: string;
  postTest?: string;
}

export interface PluginDeployHooks {
  preDeploy?: string;
  postDeploy?: string;
  validate?: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  forgeVersion: string;
  permissions: PluginPermission[];
  commands?: PluginCommand[];
  panels?: PluginPanel[];
  buildHooks?: PluginBuildHooks;
  deployHooks?: PluginDeployHooks;
  aiTools?: PluginAiToolDefinition[];
  generators?: PluginGeneratorDefinition[];
  configSchema?: Record<string, any>;
  entrypoints: {
    backend?: string;
    frontend?: string;
  };
  documentation?: {
    readme?: string;
    repository?: string;
    homepage?: string;
  };
  trust?: {
    publisher: string;
    signatureAlgorithm?: string;
    publicKeyFingerprint?: string;
    signature?: string;
  };
}

export interface PluginInstallation {
  id: string;
  pluginId: string;
  projectId: string;
  version: string;
  status: PluginInstallationStatus;
  config: Record<string, any>;
  healthStatus: "HEALTHY" | "DEGRADED" | "FAILED";
  permissions: PluginPermission[];
  installedAt: Date;
  updatedAt: Date;
}

export interface PluginExecutionRecord {
  id: string;
  installationId: string;
  projectId: string;
  hookType: string;
  actionName: string;
  durationMs: number;
  status: "SUCCESS" | "FAILED";
  errorMessage?: string;
  executedAt: Date;
}
