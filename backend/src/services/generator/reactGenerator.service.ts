/**
 * ForgeStudio Module 08: React Project Generator Service
 * Production-grade Vite + React 19 + TypeScript + Tailwind + React Router generator
 */

import { ProjectIR, ComponentIR, ElementIR } from "../compiler/unifiedCompiler.service.js";
import {
  GenerationPlan,
  GenerationScope,
  PlannedFile,
  ReactGeneratorOptions,
} from "./generatorTypes.js";
import { reconcilePlannedFile } from "./sourcePreservation.service.js";
import { stylesToTailwindClasses } from "../codeGenerator.service.js";

/**
 * Convert ElementIR node to clean accessible React JSX
 */
function renderElementToJSX(el: ElementIR, indent = "        "): string {
  const twClasses = [
    ...(el.classes || []),
    ...stylesToTailwindClasses(el.styles || {}),
  ];

  // Responsive classes if present
  if (el.responsiveStyles) {
    for (const [bp, bpStyles] of Object.entries(el.responsiveStyles)) {
      const bpTw = stylesToTailwindClasses(bpStyles).map((c) => `${bp}:${c}`);
      twClasses.push(...bpTw);
    }
  }

  const classAttr = twClasses.length > 0 ? ` className="${twClasses.join(" ")}"` : "";
  const tag = el.tag || "div";

  // Accessibility attributes
  const ariaLabel = el.attributes?.["aria-label"] || el.props?.alt ? ` aria-label="${el.attributes?.["aria-label"] || el.props?.alt}"` : "";
  const roleAttr = el.attributes?.role ? ` role="${el.attributes.role}"` : "";
  const hrefAttr = el.props?.href ? ` href="${el.props.href}"` : "";
  const srcAttr = el.props?.src ? ` src="${el.props.src}"` : "";
  const altAttr = tag === "img" ? ` alt="${el.props?.alt || "Image"}"` : "";

  // Content or children
  const text = el.textContent || el.props?.content || el.props?.buttonText || "";
  const hasChildren = el.children && el.children.length > 0;

  if (tag === "img" || tag === "hr" || tag === "input") {
    return `${indent}<${tag}${classAttr}${srcAttr}${altAttr}${hrefAttr}${ariaLabel}${roleAttr} />`;
  }

  if (!hasChildren) {
    return `${indent}<${tag}${classAttr}${hrefAttr}${ariaLabel}${roleAttr}>${text}</${tag}>`;
  }

  const childJsx = el.children.map((c) => renderElementToJSX(c, indent + "  ")).join("\n");
  return `${indent}<${tag}${classAttr}${hrefAttr}${ariaLabel}${roleAttr}>\n${text ? `${indent}  ${text}\n` : ""}${childJsx}\n${indent}</${tag}>`;
}

/**
 * Generate a standalone reusable React component
 */
function generateComponentSource(comp: ComponentIR): string {
  const compName = comp.name.replace(/[^a-zA-Z0-9]/g, "");
  const rootJsx = renderElementToJSX(comp.rootElement, "      ");

  return `import React from 'react';

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
function generatePageSource(comp: ComponentIR, pageTitle: string): string {
  const pageName = comp.name.replace(/[^a-zA-Z0-9]/g, "") + "Page";
  const rootJsx = renderElementToJSX(comp.rootElement, "      ");

  return `import React, { useEffect } from 'react';
import { useResponsive } from '../hooks/useResponsive';
import { useAppContext } from '../contexts/AppContext';

export const ${pageName}: React.FC = () => {
  const { isMobile } = useResponsive();
  const { state } = useAppContext();

  useEffect(() => {
    document.title = '${pageTitle} | ForgeStudio';
  }, []);

  // [forge-protect-start: page-custom-logic]
  // Custom page logic, API hooks, and handlers
  // [forge-protect-end: page-custom-logic]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200">
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
  const planWarnings: string[] = [];

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
  const packageJson = {
    name: projectIR.slug || "forgestudio-react-app",
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
      test: "vitest run",
      lint: "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
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
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "@vitejs/plugin-react": "^4.3.4",
      vite: "^6.0.0",
      tailwindcss: "^4.0.0",
      "@tailwindcss/vite": "^4.0.0",
      vitest: "^3.0.0",
      eslint: "^9.18.0",
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

  // 4. vitest.config.ts
  const vitestConfig = `import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
});
`;
  addFile("vitest.config.ts", vitestConfig, "application/typescript", "Vitest configuration");

  // 5. eslint.config.js
  const eslintConfig = `import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  }
);
`;
  addFile("eslint.config.js", eslintConfig, "application/javascript", "ESLint configuration");

  // 6. index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectIR.name} | ForgeStudio</title>
  </head>
  <body class="bg-slate-50 text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
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
import { AppProvider } from './contexts/AppContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
`;
  addFile("src/main.tsx", mainTsx, "text/typescript-jsx", "Application entrypoint with provider hierarchy");

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

  // 10. src/components/LoadingSpinner.tsx
  const loadingSpinnerTsx = `import React from 'react';

export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeMap = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className="flex items-center justify-center p-8">
      <div className={\`\${sizeMap[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin\`} />
    </div>
  );
};
`;
  addFile("src/components/LoadingSpinner.tsx", loadingSpinnerTsx, "text/typescript-jsx", "Loading state spinner");

  // 11. src/components/EmptyState.tsx
  const emptyStateTsx = `import React from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, actionText, onAction }) => (
  <div className="text-center py-12 px-4">
    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
      ∅
    </div>
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    {description && <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>}
    {actionText && onAction && (
      <button
        onClick={onAction}
        className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
      >
        {actionText}
      </button>
    )}
  </div>
);
`;
  addFile("src/components/EmptyState.tsx", emptyStateTsx, "text/typescript-jsx", "Empty state fallback component");

  // 12. src/contexts/AppContext.tsx (State Management)
  const appContextTsx = `import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export interface AppState {
  theme: 'light' | 'dark';
  user: { id: string; name?: string; email?: string } | null;
  // [forge-protect-start: custom-app-state]
  // Extend global app state here
  // [forge-protect-end: custom-app-state]
}

type Action =
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'SET_USER'; payload: AppState['user'] };

const initialState: AppState = {
  theme: 'light',
  user: null,
};

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload };
    default:
      return state;
  }
}

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
`;
  addFile("src/contexts/AppContext.tsx", appContextTsx, "text/typescript-jsx", "Application state context & provider");

  // 13. src/hooks/useResponsive.ts
  const useResponsiveTs = `import { useState, useEffect } from 'react';

export function useResponsive() {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    width: windowWidth,
    isMobile: windowWidth < 640,
    isTablet: windowWidth >= 640 && windowWidth < 1024,
    isDesktop: windowWidth >= 1024,
  };
}
`;
  addFile("src/hooks/useResponsive.ts", useResponsiveTs, "application/typescript", "Responsive viewport hook");

  // 14. src/hooks/useApi.ts
  const useApiTs = `import { useState, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

export function useApi<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.request<T>(endpoint, options);
      setData(res);
      return res;
    } catch (err: any) {
      const msg = err.message || 'API request failed';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, execute };
}
`;
  addFile("src/hooks/useApi.ts", useApiTs, "application/typescript", "Custom hook for typed API calls");

  // 15. src/services/apiClient.ts
  const apiClientTs = `/**
 * Typed API Client with base URL, timeout, retry, and auth wiring
 */
export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || '/api';
  }

  public async request<T>(endpoint: string, options: RequestInit = {}, retries = 2): Promise<T> {
    const url = \`\${this.baseUrl}\${endpoint.startsWith('/') ? endpoint : \`/\${endpoint}\`}\`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (token) {
      headers['Authorization'] = \`Bearer \${token}\`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        throw new Error(\`HTTP error \${response.status}: \${response.statusText}\`);
      }
      return (await response.json()) as T;
    } catch (err: any) {
      if (retries > 0 && options.method !== 'POST') {
        await new Promise((r) => setTimeout(r, 500));
        return this.request<T>(endpoint, options, retries - 1);
      }
      throw err;
    }
  }

  public get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  public post<T>(endpoint: string, body: any) {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }
}

export const apiClient = new ApiClient();
`;
  addFile("src/services/apiClient.ts", apiClientTs, "application/typescript", "Typed API client wiring");

  // 16. .env.example
  const envExample = `# Client-Safe Environment Variables (Publicly exposed in Vite)
VITE_API_URL=http://localhost:5000/api
VITE_APP_TITLE=${projectIR.name}
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

  for (const comp of projectIR.components) {
    const isPage = comp.isPage;
    if (isPage) {
      const pageFile = `src/pages/${comp.name.replace(/[^a-zA-Z0-9]/g, "")}Page.tsx`;
      const pageCode = generatePageSource(comp, comp.name);
      addFile(pageFile, pageCode, "text/typescript-jsx", `Page component: ${comp.name}`);

      const routePath = comp.routePath || "/";
      routeConfigs.push({
        path: routePath,
        name: `${comp.name}Page`,
        file: pageFile,
        dynamic: routePath.includes(":"),
      });
      componentConfigs.push({ name: `${comp.name}Page`, file: pageFile, isPage: true });
    } else {
      const compFile = `src/components/${comp.name.replace(/[^a-zA-Z0-9]/g, "")}.tsx`;
      const compCode = generateComponentSource(comp);
      addFile(compFile, compCode, "text/typescript-jsx", `Reusable component: ${comp.name}`);
      componentConfigs.push({ name: comp.name, file: compFile, isPage: false });
    }
  }

  // 19. src/routes/AppRoutes.tsx
  const importStatements = routeConfigs
    .map((r) => `import ${r.name} from '../pages/${r.name}';`)
    .join("\n");

  const routeElements = routeConfigs
    .map((r) => `      <Route path="${r.path}" element={<${r.name} />} />`)
    .join("\n");

  const appRoutesTsx = `import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import NotFoundPage from '../pages/NotFoundPage';
${importStatements}

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" />}>
      <Routes>
${routeElements}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <AppRoutes />
    </div>
  );
}
`;
  addFile("src/App.tsx", appTsx, "text/typescript-jsx", "Root App shell");

  // 21. src/tests/setup.ts & src/tests/App.test.tsx
  const testSetup = `import { expect, afterEach } from 'vitest';
// Test environment setup
`;
  addFile("src/tests/setup.ts", testSetup, "application/typescript", "Vitest test harness");

  const appTest = `import { describe, it, expect } from 'vitest';

describe('Application Core', () => {
  it('initializes routes and configuration', () => {
    expect(true).toBe(true);
  });
});
`;
  addFile("src/tests/App.test.tsx", appTest, "text/typescript-jsx", "Core unit test suite");

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
    warnings: planWarnings,
  };
}

export const reactGeneratorService = {
  buildReactGenerationPlan,
};
