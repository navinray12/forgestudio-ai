import { writeFile, readFile } from "./forgeFilesystem.service.js";
import { getForgeProjectById, ForgeProjectEntity } from "./forgeProject.service.js";
import { AppError } from "../../utils/app-error.js";

export const CURRENT_MANIFEST_SCHEMA_VERSION = "1.0.0";
export const MANIFEST_FILE_PATH = "forge.manifest.json";

export interface ManifestFrameworkConfig {
  name: string;
  version: string;
  runtime: string;
  runtimeVersion: string;
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
  language: "typescript" | "javascript";
}

export interface ManifestCommands {
  dev: string;
  build: string;
  start?: string;
  test?: string;
  lint?: string;
  preview?: string;
  typecheck?: string;
  [key: string]: string | undefined;
}

export interface ManifestEnvVariable {
  required: boolean;
  description?: string;
  secretRef?: string; // Reference to credential/vault, NEVER plain secret
  defaultValue?: string;
}

export interface ManifestAiRules {
  protectedPaths: string[];
  codingRules: string[];
  architectureRules: string[];
  disallowedPatterns?: string[];
}

export interface ForgeManifest {
  schemaVersion: string;
  projectId: string;
  name: string;
  slug: string;
  framework: ManifestFrameworkConfig;
  commands: ManifestCommands;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  environment: {
    variables: Record<string, ManifestEnvVariable>;
    defaults?: Record<string, string>;
  };
  build: {
    command: string;
    outDir: string;
    target: "static" | "ssr" | "serverless" | "spa";
    entryPoint?: string;
  };
  preview: {
    command: string;
    port: number;
    healthCheck?: string;
  };
  deployment: {
    target: string;
    outputDirectory: string;
    routingRules?: Array<{ source: string; destination: string }>;
  };
  aiRules: ManifestAiRules;
  bindings?: {
    database?: { enabled: boolean; dialect?: string };
    storage?: { enabled: boolean; provider?: string };
  };
  plugins?: Array<{ id: string; name: string; version: string; config?: Record<string, any> }>;
}

export interface ManifestValidationDiagnostic {
  severity: "error" | "warning";
  field: string;
  message: string;
  suggestedFix?: string;
}

/**
 * Generate a canonical default manifest tailored to the project framework and type
 */
export function generateDefaultManifest(project: ForgeProjectEntity): ForgeManifest {
  const isNext = project.projectType === "NEXTJS" || project.framework === "nextjs";
  const isStatic = project.projectType === "STATIC";

  return {
    schemaVersion: CURRENT_MANIFEST_SCHEMA_VERSION,
    projectId: project.id,
    name: project.name,
    slug: project.slug,
    framework: {
      name: project.framework || (isNext ? "nextjs" : "react"),
      version: project.frameworkVersion || (isNext ? "15.0.0" : "19.0.0"),
      runtime: project.runtime || "node",
      runtimeVersion: project.runtimeVersion || "22.0.0",
      packageManager: (project.packageManager as any) || "npm",
      language: (project.language as any) || "typescript",
    },
    commands: {
      dev: isNext ? "next dev" : isStatic ? "vite" : "vite",
      build: isNext ? "next build" : "vite build",
      start: isNext ? "next start" : "vite preview",
      test: "vitest run",
      lint: "eslint .",
      preview: "vite preview",
      typecheck: "tsc --noEmit",
    },
    dependencies: isNext
      ? { next: "^15.0.0", react: "^19.0.0", "react-dom": "^19.0.0", "lucide-react": "^1.40.0" }
      : isStatic
      ? {}
      : { react: "^19.0.0", "react-dom": "^19.0.0", "lucide-react": "^1.40.0" },
    devDependencies: isStatic
      ? { vite: "^6.0.0" }
      : {
          typescript: "^5.7.0",
          "@types/react": "^19.0.0",
          "@types/react-dom": "^19.0.0",
          vite: "^6.0.0",
          tailwindcss: "^4.0.0",
        },
    environment: {
      variables: {
        NODE_ENV: { required: false, defaultValue: "development", description: "Node environment" },
        NEXT_PUBLIC_APP_URL: { required: false, description: "Public canonical app URL" },
      },
      defaults: {
        NODE_ENV: "development",
      },
    },
    build: {
      command: isNext ? "next build" : "vite build",
      outDir: isNext ? ".next" : "dist",
      target: isNext ? "ssr" : isStatic ? "static" : "spa",
      entryPoint: isNext ? "app/page.tsx" : "src/main.tsx",
    },
    preview: {
      command: isNext ? "next dev -p 3000" : "vite --port 5173",
      port: isNext ? 3000 : 5173,
      healthCheck: "/",
    },
    deployment: {
      target: isNext ? "node-server" : "static-cdn",
      outputDirectory: isNext ? ".next" : "dist",
      routingRules: [{ source: "/(.*)", destination: "/$1" }],
    },
    aiRules: {
      protectedPaths: [
        "forge.manifest.json",
        ".env",
        "package.json",
        "src/api/protected/**",
      ],
      codingRules: [
        "Use TypeScript strict mode",
        "Prefer functional components with hooks",
        "Use Tailwind CSS utility classes for styling",
        "Do not remove manual code comments or protected regions",
      ],
      architectureRules: [
        "Keep components modular and reusable in src/components",
        "Centralize design tokens in src/styles/tokens.json",
      ],
      disallowedPatterns: [
        "eval(",
        "process.exit(",
        "dangerouslySetInnerHTML without DOMPurify",
      ],
    },
    bindings: {
      database: { enabled: project.capabilities.database, dialect: "postgresql" },
      storage: { enabled: project.capabilities.storage, provider: "s3" },
    },
    plugins: [],
  };
}

/**
 * Validate manifest schema and semantic consistency
 */
export function validateManifest(manifest: any): {
  isValid: boolean;
  diagnostics: ManifestValidationDiagnostic[];
} {
  const diagnostics: ManifestValidationDiagnostic[] = [];

  if (!manifest || typeof manifest !== "object") {
    return {
      isValid: false,
      diagnostics: [{ severity: "error", field: "root", message: "Manifest must be a JSON object" }],
    };
  }

  // Schema version
  if (!manifest.schemaVersion) {
    diagnostics.push({
      severity: "error",
      field: "schemaVersion",
      message: "schemaVersion is required (e.g. '1.0.0')",
      suggestedFix: "Set schemaVersion to '1.0.0'",
    });
  }

  // Project Identity
  if (!manifest.name || typeof manifest.name !== "string" || !manifest.name.trim()) {
    diagnostics.push({ severity: "error", field: "name", message: "Project name is required" });
  }

  // Framework
  if (!manifest.framework || typeof manifest.framework !== "object") {
    diagnostics.push({ severity: "error", field: "framework", message: "framework configuration is required" });
  } else {
    if (!manifest.framework.name) {
      diagnostics.push({ severity: "error", field: "framework.name", message: "framework.name is required" });
    }
    if (!manifest.framework.runtime) {
      diagnostics.push({ severity: "warning", field: "framework.runtime", message: "framework.runtime recommended" });
    }
  }

  // Commands
  if (!manifest.commands || typeof manifest.commands !== "object") {
    diagnostics.push({ severity: "error", field: "commands", message: "commands configuration is required" });
  } else {
    if (!manifest.commands.dev) {
      diagnostics.push({ severity: "error", field: "commands.dev", message: "commands.dev is required" });
    }
    if (!manifest.commands.build) {
      diagnostics.push({ severity: "error", field: "commands.build", message: "commands.build is required" });
    }
  }

  // Security check: Environment secrets check
  if (manifest.environment?.variables) {
    for (const [key, val] of Object.entries(manifest.environment.variables) as [string, any][]) {
      // Check for accidental plaintext secrets in defaultValue or description
      if (/(password|secret|key|token|auth)/i.test(key) && val.defaultValue && !val.secretRef) {
        diagnostics.push({
          severity: "error",
          field: `environment.variables.${key}`,
          message: `Plaintext secret detected in '${key}'. Secrets must use secretRef instead of defaultValue.`,
          suggestedFix: `Configure secretRef: 'vault:${key.toLowerCase()}' and remove defaultValue`,
        });
      }
    }
  }

  // Build configuration
  if (!manifest.build?.outDir) {
    diagnostics.push({
      severity: "warning",
      field: "build.outDir",
      message: "build.outDir should be explicitly declared (e.g. 'dist' or '.next')",
    });
  }

  const isValid = !diagnostics.some((d) => d.severity === "error");
  return { isValid, diagnostics };
}

/**
 * Migrate older manifest versions to current schemaVersion
 */
export function migrateManifest(manifest: any): ForgeManifest {
  const version = manifest?.schemaVersion || "0.9.0";
  let migrated = { ...manifest };

  if (version === "0.9.0" || !manifest.schemaVersion) {
    migrated.schemaVersion = CURRENT_MANIFEST_SCHEMA_VERSION;
    if (!migrated.aiRules) {
      migrated.aiRules = {
        protectedPaths: ["forge.manifest.json", ".env"],
        codingRules: ["Use TypeScript"],
        architectureRules: ["Modular components"],
      };
    }
    if (!migrated.build) {
      migrated.build = { command: "npm run build", outDir: "dist", target: "spa" };
    }
    if (!migrated.preview) {
      migrated.preview = { command: "npm run preview", port: 5173 };
    }
    if (!migrated.deployment) {
      migrated.deployment = { target: "static-cdn", outputDirectory: "dist" };
    }
  }

  return migrated as ForgeManifest;
}

/**
 * Get or initialize manifest from project filesystem
 */
export async function getProjectManifest(
  projectId: string,
  user?: { id?: string; role?: string }
): Promise<{ manifest: ForgeManifest; diagnostics: ManifestValidationDiagnostic[] }> {
  const project = await getForgeProjectById(projectId, user);

  try {
    const file = await readFile(projectId, MANIFEST_FILE_PATH);
    const parsed = JSON.parse(file.content || "{}");
    const migrated = migrateManifest(parsed);
    const { diagnostics } = validateManifest(migrated);
    return { manifest: migrated, diagnostics };
  } catch {
    // If manifest doesn't exist yet, synthesize and persist default manifest
    const defaultManifest = generateDefaultManifest(project);
    await writeFile(projectId, MANIFEST_FILE_PATH, {
      content: JSON.stringify(defaultManifest, null, 2),
      isGenerated: true,
      authorId: user?.id || "system",
      reason: "Initial forge.manifest.json generation",
    });
    return { manifest: defaultManifest, diagnostics: [] };
  }
}

/**
 * Update manifest with validation
 */
export async function updateProjectManifest(
  projectId: string,
  manifestData: any,
  user: { id: string; role: string }
): Promise<{ manifest: ForgeManifest; diagnostics: ManifestValidationDiagnostic[] }> {
  await getForgeProjectById(projectId, user);

  const { isValid, diagnostics } = validateManifest(manifestData);
  if (!isValid) {
    const errorMsgs = diagnostics
      .filter((d) => d.severity === "error")
      .map((d) => `${d.field}: ${d.message}`)
      .join("; ");
    throw new AppError(`Invalid project manifest: ${errorMsgs}`, 422, "MANIFEST_VALIDATION_ERROR");
  }

  const jsonStr = JSON.stringify(manifestData, null, 2);
  await writeFile(projectId, MANIFEST_FILE_PATH, {
    content: jsonStr,
    isGenerated: false,
    authorId: user.id,
    reason: "Updated forge.manifest.json",
  });

  return { manifest: manifestData, diagnostics };
}

/**
 * Synchronize manifest directly to persistent filesystem disk
 */
export async function syncManifestToDisk(
  projectId: string,
  manifestData: any,
  authorId?: string
): Promise<void> {
  const jsonStr = JSON.stringify(manifestData, null, 2);
  await writeFile(projectId, MANIFEST_FILE_PATH, {
    content: jsonStr,
    isGenerated: true,
    authorId: authorId || "system",
    reason: "Synchronized manifest to disk",
  });
}

export const forgeManifestService = {
  getProjectManifest,
  updateProjectManifest,
  generateDefaultManifest,
  validateManifest,
  migrateManifest,
  syncManifestToDisk,
  CURRENT_MANIFEST_SCHEMA_VERSION,
  MANIFEST_FILE_PATH,
};
