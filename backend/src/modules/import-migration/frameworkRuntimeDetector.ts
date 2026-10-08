/**
 * ForgeStudio Module 59: Framework & Runtime Detector
 * Inspects package.json, lockfiles, configs, and directory structures to detect:
 * framework, runtime, package manager, scripts, env references, secrets, routes, and monorepos.
 */

import type {
  ImportAnalysisResult,
  ImportCompatibilityReport,
  DetectedFramework,
  DetectedPackageManager,
  UnsupportedPattern,
  MigrationStep,
  DiscoveredRoute,
  DiscoveredSecretKey,
} from "./import.types.js";

export class FrameworkRuntimeDetector {
  /**
   * Analyze in-memory or staged files to detect environment and architecture
   */
  detect(files: Array<{ path: string; content?: string; sizeBytes?: number }>): {
    analysis: ImportAnalysisResult;
    report: ImportCompatibilityReport;
  } {
    const filePaths = new Set(files.map((f) => f.path.replace(/\\/g, "/")));
    const fileMap = new Map(files.map((f) => [f.path.replace(/\\/g, "/"), f.content || ""]));

    let packageJson: any = null;
    const pkgContent = fileMap.get("package.json") || fileMap.get("/package.json");
    if (pkgContent) {
      try {
        packageJson = JSON.parse(pkgContent);
      } catch {
        // Ignored, will fall back to static detection
      }
    }

    // 1. Detect Framework
    let framework: DetectedFramework = "UNKNOWN";
    let frameworkVersion: string | undefined;

    const allDeps = {
      ...(packageJson?.dependencies || {}),
      ...(packageJson?.devDependencies || {}),
    };

    if (allDeps["next"]) {
      framework = "nextjs";
      frameworkVersion = allDeps["next"];
    } else if (allDeps["@nestjs/core"]) {
      framework = "nestjs";
      frameworkVersion = allDeps["@nestjs/core"];
    } else if (allDeps["vite"] && (allDeps["react"] || allDeps["react-dom"])) {
      framework = "vite";
      frameworkVersion = allDeps["vite"];
    } else if (allDeps["react"] || allDeps["react-dom"]) {
      framework = "react";
      frameworkVersion = allDeps["react"];
    } else if (allDeps["express"]) {
      framework = "express";
      frameworkVersion = allDeps["express"];
    } else if (allDeps["vue"]) {
      framework = "vue";
      frameworkVersion = allDeps["vue"];
    } else if (allDeps["svelte"]) {
      framework = "svelte";
      frameworkVersion = allDeps["svelte"];
    } else if (filePaths.has("index.html") || filePaths.has("public/index.html")) {
      framework = "static";
    } else if (packageJson) {
      framework = "node";
    }

    // 2. Detect Package Manager
    let packageManager: DetectedPackageManager = "npm";
    if (filePaths.has("pnpm-lock.yaml")) {
      packageManager = "pnpm";
    } else if (filePaths.has("yarn.lock")) {
      packageManager = "yarn";
    } else if (filePaths.has("bun.lockb") || filePaths.has("bun.lock")) {
      packageManager = "bun";
    } else if (filePaths.has("package-lock.json")) {
      packageManager = "npm";
    }

    // 3. Detect Monorepo
    let isMonorepo = false;
    const monorepoWorkspaces: string[] = [];

    if (filePaths.has("pnpm-workspace.yaml") || filePaths.has("turbo.json") || filePaths.has("nx.json") || filePaths.has("lerna.json")) {
      isMonorepo = true;
    }
    if (packageJson?.workspaces) {
      isMonorepo = true;
      if (Array.isArray(packageJson.workspaces)) {
        monorepoWorkspaces.push(...packageJson.workspaces);
      } else if (packageJson.workspaces?.packages) {
        monorepoWorkspaces.push(...packageJson.workspaces.packages);
      }
    }

    // 4. Discover Environment References & Secret Keys (Scanning variable names ONLY, never raw values)
    const envReferences = new Set<string>();
    const discoveredSecretKeys: DiscoveredSecretKey[] = [];

    for (const [filePath, content] of fileMap.entries()) {
      if (filePath.endsWith(".env") || filePath.endsWith(".env.example") || filePath.endsWith(".env.local")) {
        const lines = content.split("\n");
        for (const line of lines) {
          const match = line.match(/^\s*([A-Z0-9_]{3,64})\s*=/);
          if (match && match[1]) {
            const keyName = match[1];
            envReferences.add(keyName);
            if (/SECRET|KEY|PASSWORD|TOKEN|DATABASE_URL|PRIVATE/i.test(keyName)) {
              discoveredSecretKeys.push({
                keyName,
                fileSource: filePath,
                risk: "HIGH",
              });
            }
          }
        }
      } else if (/\.(js|ts|jsx|tsx|mjs)$/.test(filePath)) {
        const matches = content.matchAll(/process\.env\.([A-Z0-9_]{3,64})/g);
        for (const m of matches) {
          if (m[1]) envReferences.add(m[1]);
        }
      }
    }

    // 5. Discover Routes & Pages
    const routes: DiscoveredRoute[] = [];
    for (const p of filePaths) {
      if (p.startsWith("src/pages/") || p.startsWith("pages/")) {
        const clean = p.replace(/^(src\/)?pages\//, "").replace(/\.(tsx|jsx|js|ts)$/, "");
        routes.push({
          path: clean === "index" ? "/" : `/${clean}`,
          sourceFile: p,
          type: clean.startsWith("api/") ? "API" : "PAGE",
        });
      } else if (p.startsWith("src/app/") || p.startsWith("app/")) {
        if (p.endsWith("page.tsx") || p.endsWith("page.jsx") || p.endsWith("page.js")) {
          const clean = p.replace(/^(src\/)?app\//, "").replace(/\/page\.(tsx|jsx|js)$/, "");
          routes.push({
            path: clean === "" ? "/" : `/${clean}`,
            sourceFile: p,
            type: "PAGE",
          });
        }
      }
    }

    // Calculate total stats
    const totalFiles = files.length;
    const totalBytes = files.reduce((acc, f) => acc + (f.sizeBytes || Buffer.byteLength(f.content || "", "utf8")), 0);

    const analysis: ImportAnalysisResult = {
      framework,
      frameworkVersion,
      runtime: "node",
      runtimeVersion: packageJson?.engines?.node || "20.x",
      packageManager,
      buildTools: Object.keys(allDeps).filter((d) => /vite|webpack|rollup|esbuild|turbopack|babel/i.test(d)),
      scripts: packageJson?.scripts || {},
      dependencies: packageJson?.dependencies || {},
      devDependencies: packageJson?.devDependencies || {},
      isMonorepo,
      monorepoWorkspaces,
      envReferences: Array.from(envReferences),
      discoveredSecretKeys,
      routes,
      totalFiles,
      totalBytes,
    };

    // 6. Generate Compatibility Report & Recommendations
    const unsupportedPatterns: UnsupportedPattern[] = [];
    const recommendations: MigrationStep[] = [];
    let overallScore = 100;

    if (framework === "UNKNOWN") {
      overallScore -= 30;
      unsupportedPatterns.push({
        category: "FRAMEWORK",
        severity: "WARNING",
        title: "Unrecognized Application Framework",
        description: "The repository does not declare a standard React, Next.js, Vite, or Express framework in package.json.",
        remedy: "Configure custom build scripts in forge.manifest.json or adopt Next.js/React.",
      });
    }

    if (discoveredSecretKeys.length > 0) {
      unsupportedPatterns.push({
        category: "SECRET",
        severity: "WARNING",
        title: `${discoveredSecretKeys.length} Environment Secret References Detected`,
        description: `Found references to credentials (${discoveredSecretKeys.map((s) => s.keyName).slice(0, 3).join(", ")}). Secrets must be stored in Forge Project Secrets, not checked into repository files.`,
        remedy: "Configure environment variables securely in Developer Workspace > Environment Secrets.",
      });
    }

    if (isMonorepo) {
      recommendations.push({
        step: 1,
        title: "Initialize Monorepo Workspace Manager",
        category: "CONFIG",
        description: `Detected monorepo with workspaces (${monorepoWorkspaces.join(", ") || "packages/*"}). ForgeStudio will configure individual service runtimes.`,
        isAutomatic: true,
      });
    }

    if (!packageJson?.scripts?.build) {
      overallScore -= 15;
      recommendations.push({
        step: recommendations.length + 1,
        title: "Add Standard Build Script",
        category: "CONFIG",
        description: "Repository is missing a 'build' script in package.json.",
        suggestedPatch: '"build": "vite build" or "next build"',
        isAutomatic: true,
      });
    }

    const report: ImportCompatibilityReport = {
      overallScore: Math.max(overallScore, 40),
      compatibilityLevel:
        overallScore >= 90
          ? "FULLY_COMPATIBLE"
          : overallScore >= 70
          ? "COMPATIBLE_WITH_PATCHES"
          : "REQUIRES_MIGRATION",
      unsupportedPatterns,
      recommendations,
      filesIndexedCount: totalFiles,
      symbolsIndexedCount: totalFiles * 8, // Estimate for summary
      routesDiscovered: routes,
      architectureMapSummary: {
        entryPoints: routes.map((r) => r.path).slice(0, 5),
        mainComponents: Array.from(filePaths).filter((p) => p.includes("components/")).slice(0, 10),
        sharedLibraries: Object.keys(analysis.dependencies).slice(0, 10),
      },
    };

    return { analysis, report };
  }
}

export const frameworkRuntimeDetector = new FrameworkRuntimeDetector();
