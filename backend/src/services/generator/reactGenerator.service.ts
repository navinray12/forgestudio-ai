/**
 * ForgeStudio Module 08: React Project Generator Service
 * Production-grade Vite + React 19 + TypeScript + Tailwind + React Router generator
 */

import { ProjectIR, ComponentIR } from "../compiler/unifiedCompiler.service.js";
import {
  GenerationPlan,
  GenerationScope,
  PlannedFile,
  ReactGeneratorOptions,
} from "./generatorTypes.js";
import { reconcilePlannedFile } from "./sourcePreservation.service.js";
import {
  RenderContext,
  createRenderContext,
  renderElementToJsx,
  buildForgeStylesheet,
  escapeJsString,
  escapeJsxText,
  toComponentIdentifier,
  FORGE_CSS_HELPER_SOURCE,
} from "./jsxRenderer.js";
import { toPackageName } from "../codeGenerator.service.js";

/**
 * Generate a standalone reusable React component
 */
function generateComponentSource(comp: ComponentIR, ctx: RenderContext): string {
  const compName = toComponentIdentifier(comp.name, "Component");
  const local = { ...ctx, uses: { link: false, image: false, css: false } };
  const rootJsx = renderElementToJsx(comp.rootElement, local, "      ");
  const extraImports = [
    local.uses.link ? "import { Link } from 'react-router-dom';" : "",
    local.uses.css ? "import { css } from '../lib/forgeStyle';" : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `import React from 'react';
${extraImports ? `${extraImports}\n` : ""}
export interface ${compName}Props {
  className?: string;
  title?: string;
  children?: React.ReactNode;
  // [forge-protect-start: custom-props]
  // Add custom props here
  // [forge-protect-end: custom-props]
}

export const ${compName}: React.FC<${compName}Props> = ({
  className = '',
  title,
  children,
}) => {
  // [forge-protect-start: custom-state]
  // Custom hooks and component state
  // [forge-protect-end: custom-state]

  return (
    <div className={\`${compName.toLowerCase()}-wrapper \${className}\`}>
${rootJsx}
      {children}
    </div>
  );
};

export default ${compName};
`;
}

/**
 * Generate Page component with route integration
 */
function generatePageSource(comp: ComponentIR, pageTitle: string, ctx: RenderContext): string {
  const cleanName = toComponentIdentifier(comp.name, "Page");
  const pageName = cleanName.endsWith("Page") ? cleanName : `${cleanName}Page`;
  const local = { ...ctx, uses: { link: false, image: false, css: false } };
  // The page root is emitted even for an empty canvas: it is where elements
  // added in the Code Workspace belong, and it renders nothing by itself
  const rootJsx = renderElementToJsx(comp.rootElement, local, "        ");
  const extraImports = [
    local.uses.link ? "import { Link } from 'react-router-dom';" : "",
    local.uses.css ? "import { css } from '../lib/forgeStyle';" : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `import React, { useEffect } from 'react';
${extraImports ? `${extraImports}\n` : ""}
export const ${pageName}: React.FC = () => {
  useEffect(() => {
    document.title = '${escapeJsString(pageTitle)}';
  }, []);

  // [forge-protect-start: page-custom-logic]
  // Custom page logic, API hooks, and handlers
  // [forge-protect-end: page-custom-logic]

  return (
    <div className="min-h-screen">
      <main className="w-full">
${rootJsx}
      </main>
    </div>
  );
};

export default ${pageName};
`;
}

/**
 * Scaffolds the complete React project structure
 */
export async function buildReactGenerationPlan(
  projectIR: ProjectIR,
  existingFiles: Array<{
    id: string;
    path: string;
    content?: string | null;
    contentHash: string;
    isGenerated: boolean;
    isProtected: boolean;
  }> = [],
  options: ReactGeneratorOptions = {}
): Promise<GenerationPlan> {
  const scope: GenerationScope = options.scope || { type: "full" };
  const existingMap = new Map(existingFiles.map((f) => [f.path, f]));
  const plannedFiles: PlannedFile[] = [];
  const planWarnings: string[] = [...((projectIR.metadata?.warnings as string[]) || [])];
  const renderCtx = createRenderContext("react", projectIR.metadata?.editorBreakpoints);

  // Helper to add file through reconciliation
  function addFile(
    filePath: string,
    content: string,
    mimeType = "text/typescript-jsx",
    reason = "React Project Scaffolding",
    isProtected = false
  ) {
    const existing = existingMap.get(filePath) || null;

    // Check scope filtering: if scoped to a page/component, skip unrelated files
    if (scope.type === "page" && scope.targetPath) {
      const isTarget = filePath === scope.targetPath || filePath.endsWith(`${scope.targetId}.tsx`);
      if (!isTarget && existing) {
        // Unrelated file preserved in scoped mode
        plannedFiles.push({
          path: filePath,
          action: "PRESERVE",
          ownership: existing.isGenerated ? "GENERATED" : "USER",
          content: existing.content || "",
          mimeType,
          reason: "Scoped regeneration: preserved unrelated file",
          existingHash: existing.contentHash,
          newHash: existing.contentHash,
          isProtected: existing.isProtected,
        });
        return;
      }
    }

    const { planned, conflict } = reconcilePlannedFile(
      { path: filePath, content, mimeType, reason, isProtected },
      existing
    );
    if (conflict) {
      planWarnings.push(conflict.message);
    }
    plannedFiles.push(planned);
  }

  // 1. package.json
  const preferredPkgName =
    projectIR.name && projectIR.name !== "ForgeProject" && projectIR.name !== "default_project"
      ? projectIR.name
      : projectIR.slug || "forgestudio-react-app";
  const packageJson = {
    name: toPackageName(preferredPkgName),
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
    },
    dependencies: {
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      "react-router-dom": "^7.1.0",
      "lucide-react": "^1.40.0",
      clsx: "^2.1.1",
      "tailwind-merge": "^3.0.0",
    },
    devDependencies: {
      typescript: "^5.7.0",
      "@types/node": "^22.0.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "@vitejs/plugin-react": "^4.3.4",
      vite: "^6.0.0",
      tailwindcss: "^4.0.0",
      "@tailwindcss/vite": "^4.0.0",
    },
  };
  addFile("package.json", JSON.stringify(packageJson, null, 2), "application/json", "Project manifest");

  // 2. tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      useDefineForClassFields: true,
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noFallthroughCasesInSwitch: true,
      paths: {
        "@/*": ["./src/*"],
      },
    },
    include: ["src"],
  };
  addFile("tsconfig.json", JSON.stringify(tsconfig, null, 2), "application/json", "TypeScript configuration");

  // 3. vite.config.ts
  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
  },
});
`;
  addFile("vite.config.ts", viteConfig, "application/typescript", "Vite build configuration");

  // 6. index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeJsxText(projectIR.name)}</title>
  </head>
  <body class="antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  addFile("index.html", indexHtml, "text/html", "HTML document root");

  // 7. src/index.css
  const indexCss = `@import "tailwindcss";

@layer base {
  :root {
    --primary: #3b82f6;
    --background: #ffffff;
    --foreground: #0f172a;
  }

  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background-color: var(--background);
    color: var(--foreground);
    min-height: 100vh;
  }
}
`;
  addFile("src/index.css", indexCss, "text/css", "Global Tailwind CSS styles");

  // 8. src/main.tsx (Entrypoint)
  const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import './styles/forge.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
`;
  addFile("src/main.tsx", mainTsx, "text/typescript-jsx", "Application entrypoint with error boundary and routing");

  // 9. src/components/ErrorBoundary.tsx
  const errorBoundaryTsx = `import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-red-100 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              !
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-600 mb-6">
              {this.state.error?.message || 'An unexpected runtime error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
`;
  addFile("src/components/ErrorBoundary.tsx", errorBoundaryTsx, "text/typescript-jsx", "Production error boundary");

  // 15b. Vite client types (import.meta.env) and the inline-style helper used by generated pages
  addFile(
    "src/vite-env.d.ts",
    `/// <reference types="vite/client" />\n`,
    "application/typescript",
    "Vite client type declarations"
  );
  addFile("src/lib/forgeStyle.ts", FORGE_CSS_HELPER_SOURCE, "application/typescript", "Inline style helper");

  // 16. .env.example
  const envExample = `# Client-Safe Environment Variables (Publicly exposed in Vite)
VITE_API_URL=http://localhost:5000/api
VITE_APP_TITLE=${String(projectIR.name).replace(/[\r\n]+/g, " ")}
VITE_ENVIRONMENT=development
# NEVER store private secrets with VITE_ prefix
`;
  addFile(".env.example", envExample, "text/plain", "Environment variables template");

  // 17. src/pages/NotFoundPage.tsx
  const notFoundTsx = `import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
    <div className="max-w-md w-full text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-100">
      <h1 className="text-6xl font-black text-slate-800">404</h1>
      <p className="text-lg font-semibold text-slate-700 mt-2">Page Not Found</p>
      <p className="text-sm text-slate-500 mt-1">The page you requested does not exist or has been moved.</p>
      <Link
        to="/"
        className="mt-6 inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition"
      >
        Return to Home
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
`;
  addFile("src/pages/NotFoundPage.tsx", notFoundTsx, "text/typescript-jsx", "404 Not Found page");

  // 18. Generate Component and Page files
  const routeConfigs: Array<{ path: string; name: string; file: string; dynamic?: boolean }> = [];
  const componentConfigs: Array<{ name: string; file: string; isClient?: boolean; isPage?: boolean }> = [];

  const usedPageNames = new Set<string>(["NotFoundPage"]);
  const usedRoutePaths = new Set<string>();

  for (const comp of projectIR.components) {
    const isPage = comp.isPage;
    if (isPage) {
      const cleanCompName = toComponentIdentifier(comp.name, "Page");
      const baseCompName = cleanCompName.endsWith("Page") ? cleanCompName : `${cleanCompName}Page`;
      let pageCompName = baseCompName;
      for (let n = 2; usedPageNames.has(pageCompName); n++) pageCompName = `${cleanCompName}${n}Page`;
      usedPageNames.add(pageCompName);

      const routePath = comp.routePath || "/";
      if (usedRoutePaths.has(routePath)) {
        planWarnings.push(`Page '${comp.name}' shares route '${routePath}' with another page and was skipped.`);
        continue;
      }
      usedRoutePaths.add(routePath);

      const pageFile = `src/pages/${pageCompName}.tsx`;
      const pageTitle = projectIR.routes.find((r) => r.componentId === comp.id)?.title || comp.name;
      const pageCode = generatePageSource({ ...comp, name: pageCompName }, pageTitle, renderCtx);
      addFile(pageFile, pageCode, "text/typescript-jsx", `Page component: ${comp.name}`);

      routeConfigs.push({
        path: routePath,
        name: pageCompName,
        file: pageFile,
        dynamic: routePath.includes(":"),
      });
      componentConfigs.push({ name: pageCompName, file: pageFile, isPage: true });
    } else {
      const cleanCompName = toComponentIdentifier(comp.name, "Component");
      const compFile = `src/components/${cleanCompName}.tsx`;
      const compCode = generateComponentSource(comp, renderCtx);
      addFile(compFile, compCode, "text/typescript-jsx", `Reusable component: ${comp.name}`);
      componentConfigs.push({ name: cleanCompName, file: compFile, isPage: false });
    }
  }

  // 18b. Stylesheet with design tokens, responsive overrides and custom CSS
  addFile(
    "src/styles/forge.css",
    buildForgeStylesheet(projectIR.designTokens, renderCtx.cssRules, projectIR.customCss),
    "text/css",
    "Design tokens, responsive overrides and custom CSS"
  );
  planWarnings.push(...renderCtx.warnings);

  // 19. src/routes/AppRoutes.tsx
  const importStatements = routeConfigs
    .map((r) => `import ${r.name} from '../pages/${r.name}';`)
    .join("\n");

  const routeElements = routeConfigs
    .map((r) => `        <Route path="${r.path.replace(/"/g, "")}" element={<${r.name} />} />`)
    .join("\n");

  const appRoutesTsx = `import React from 'react';
import { Routes, Route } from 'react-router-dom';
import NotFoundPage from '../pages/NotFoundPage';
${importStatements}

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
${routeElements}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;
`;
  addFile("src/routes/AppRoutes.tsx", appRoutesTsx, "text/typescript-jsx", "App router definitions");

  // 20. src/App.tsx
  const appTsx = `import React from 'react';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <AppRoutes />
    </div>
  );
}
`;
  addFile("src/App.tsx", appTsx, "text/typescript-jsx", "Root App shell");

  return {
    id: `plan_react_${Date.now()}`,
    projectId: projectIR.projectId,
    framework: "react",
    frameworkVersion: "19.0.0",
    createdAt: new Date().toISOString(),
    scope,
    files: plannedFiles,
    dependencies: packageJson.dependencies,
    devDependencies: packageJson.devDependencies,
    routes: routeConfigs,
    components: componentConfigs,
    environment: {
      clientVars: {
        VITE_API_URL: "http://localhost:5000/api",
        VITE_APP_TITLE: projectIR.name,
      },
      serverVars: {},
    },
    warnings: Array.from(new Set(planWarnings)),
  };
}

export const reactGeneratorService = {
  buildReactGenerationPlan,
};
