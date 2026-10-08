/**
 * ForgeStudio Module 61: Container & Infrastructure Tooling Types
 */

export interface DockerfileStage {
  name: string;
  baseImage: string;
  commands: string[];
}

export interface ContainerDefinition {
  id: string;
  projectId: string;
  name: string;
  filePath: string;
  dockerfileContent: string;
  baseImage: string;
  isMultiStage: boolean;
  stages: DockerfileStage[];
  exposedPorts: number[];
  entrypoint: string[];
  cmd: string[];
  isGenerated: boolean;
  createdAt: Date;
}

export interface ContainerBuildResult {
  id: string;
  definitionId: string;
  projectId: string;
  tag: string;
  status: "BUILDING" | "COMPLETED" | "FAILED";
  digest?: string;
  sizeBytes: number;
  durationMs: number;
  buildLogs: string;
  errorMessage?: string;
}

export interface ContainerRunInstance {
  id: string;
  definitionId: string;
  projectId: string;
  containerName: string;
  status: "RUNNING" | "STOPPED" | "FAILED";
  portBindings: Record<string, number>;
  volumeBindings: Array<{ hostPath: string; containerPath: string; readOnly?: boolean }>;
  envVars: Record<string, string>;
  memoryLimitMb: number;
  cpuQuotaPercent: number;
  logs: string;
}

export interface ComposeService {
  name: string;
  image?: string;
  build?: { context: string; dockerfile?: string };
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  depends_on?: string[];
  restart?: string;
}

export interface DockerComposeDefinition {
  id: string;
  projectId: string;
  filePath: string;
  content: string;
  version: string;
  services: Record<string, ComposeService>;
  networks: Record<string, any>;
  volumes: Record<string, any>;
  isValid: boolean;
  validationErrors: string[];
}

export interface KubernetesManifestSet {
  deploymentYaml: string;
  serviceYaml: string;
  configMapYaml: string;
  ingressYaml?: string;
  hpaYaml?: string;
}

export interface TerraformModuleSet {
  mainTf: string;
  variablesTf: string;
  outputsTf: string;
  terraformTfvars: string;
}

export interface InfrastructureValidationReport {
  isValid: boolean;
  syntaxErrors: string[];
  securityScore: number; // 0 - 100
  detectedSecrets: string[];
  dangerousConfigs: string[];
  summary: string;
}
