/**
 * ForgeStudio Module 09: Next.js Project Generator Service
 * Production-grade Next.js 14/15 App Router Generator with Server/Client Component placement,
 * Server Actions, Route Handlers, Metadata, Image/Font Optimization, and Scoped Regeneration.
 */

import { ProjectIR, ComponentIR, ElementIR, pageFilePathFor } from "../compiler/unifiedCompiler.service.js";
import {
  GenerationPlan,
  GenerationScope,
  PlannedFile,
  NextJsGeneratorOptions,
} from "./generatorTypes.js";
import { reconcilePlannedFile } from "./sourcePreservation.service.js";
import {
  RenderContext,
  createRenderContext,
  renderElementToJsx,
  buildForgeStylesheet,
  escapeJsString,
  toComponentIdentifier,
  FORGE_CSS_HELPER_SOURCE,
} from "./jsxRenderer.js";
import { toPackageName } from "../codeGenerator.service.js";

/**
 * Check if ElementIR or its descendants declare event handlers, which require "use client"
 */
function isInteractiveElement(el: ElementIR): boolean {
  if (el.attributes?.onClick || el.attributes?.onSubmit || el.props?.onClick) {
    return true;
  }
  if (el.children && el.children.length > 0) {
    return el.children.some(isInteractiveElement);
  }
  return false;
}

function toValidComponentName(raw: string): string {
  return toComponentIdentifier(raw, "Component");
}

function buildJsxImports(uses: RenderContext["uses"], cssHelperPath: string): string[] {
  const imports: string[] = ["import React from 'react';"];
  if (uses.image) imports.push("import Image from 'next/image';");
  if (uses.link) imports.push("import Link from 'next/link';");
  if (uses.css) imports.push(`import { css } from '${cssHelperPath}';`);
  return imports;
}

/**
 * Generate Next.js Page component (Server Component by default, "use client" if interactive)
 */
function generateNextPageSource(
  comp: ComponentIR,
  renderingStrategy: "ssr" | "ssg" | "isr",
  revalidateSeconds = 60,
  ctx: RenderContext = createRenderContext("next"),
  page: { title?: string; description?: string; isHome?: boolean; isDynamic?: boolean } = {}
): string {
  const isClient = isInteractiveElement(comp.rootElement);
  const clientDirective = isClient ? `"use client";\n\n` : "";
  const local = { ...ctx, uses: { link: false, image: false, css: false } };
  const rootJsx = renderElementToJsx(comp.rootElement, local, "        ");
  const cleanName = toValidComponentName(comp.name);
  const componentName = cleanName.endsWith("Page") ? cleanName : `${cleanName}Page`;
  const imports = buildJsxImports(local.uses, "@/lib/forgeStyle");

  // Route segment config and metadata are only valid in Server Components
  let serverExports = "";
  if (!isClient) {
    if (!page.isHome && page.title) {
      imports.unshift("import type { Metadata } from 'next';");
      serverExports += `export const metadata: Metadata = {\n  title: '${escapeJsString(page.title)}',${
        page.description ? `\n  description: '${escapeJsString(page.description)}',` : ""
      }\n};\n\n`;
    }
    if (renderingStrategy === "ssr" || page.isDynamic) {
      serverExports += `export const dynamic = 'force-dynamic';\n`;
    } else if (renderingStrategy === "isr") {
      serverExports += `export const revalidate = ${revalidateSeconds};\n`;
    } else {
      serverExports += `export const dynamic = 'force-static';\n`;
    }
  }

  return `${clientDirective}${imports.join("\n")}

${serverExports}
export default function ${componentName}() {
  // [forge-protect-start: custom-page-logic]
  // Custom server data fetching, actions, or client hooks
  // [forge-protect-end: custom-page-logic]

  return (
    <main className="min-h-screen">
      <div className="w-full">
${rootJsx}
      </div>
    </main>
  );
}
`;
}

/**
 * Scaffolds the complete Next.js App Router project structure
 */
export async function buildNextJsGenerationPlan(
  projectIR: ProjectIR,
  existingFiles: Array<{
    id: string;
    path: string;
    content?: string | null;
    contentHash: string;
    isGenerated: boolean;
    isProtected: boolean;
  }> = [],
  options: NextJsGeneratorOptions = {}
): Promise<GenerationPlan> {
  const scope: GenerationScope = options.scope || { type: "full" };
  const existingMap = new Map(existingFiles.map((f) => [f.path, f]));
  const plannedFiles: PlannedFile[] = [];
  const planWarnings: string[] = [...((projectIR.metadata?.warnings as string[]) || [])];
  const renderCtx = createRenderContext("next", projectIR.metadata?.editorBreakpoints);

  const renderingStrategy = options.renderingStrategy || "isr";
  const revalidateSeconds = options.revalidateSeconds || 60;
  const version = options.version || "15";

  function addFile(
    filePath: string,
    content: string,
    mimeType = "text/typescript-jsx",
    reason = "Next.js App Router Scaffolding",
    isProtected = false
  ) {
    const existing = existingMap.get(filePath) || null;

    if (scope.type === "page" && scope.targetPath) {
      const isTarget = filePath === scope.targetPath || filePath.endsWith(`${scope.targetId}/page.tsx`);
      if (!isTarget && existing) {
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
  const isV15 = version === "15";
  const preferredPkgName =
    projectIR.name && projectIR.name !== "ForgeProject" && projectIR.name !== "default_project"
      ? projectIR.name
      : projectIR.slug || "forgestudio-nextjs-app";
  const packageJson = {
    name: toPackageName(preferredPkgName),
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
    },
    dependencies: {
      next: isV15 ? "^15.1.0" : "^14.2.0",
      react: isV15 ? "^19.0.0" : "^18.3.0",
      "react-dom": isV15 ? "^19.0.0" : "^18.3.0",
      "lucide-react": "^1.40.0",
      clsx: "^2.1.1",
      "tailwind-merge": "^3.0.0",
    },
    devDependencies: {
      typescript: "^5.7.0",
      "@types/node": "^22.0.0",
      "@types/react": isV15 ? "^19.0.0" : "^18.3.0",
      "@types/react-dom": isV15 ? "^19.0.0" : "^18.3.0",
      tailwindcss: "^4.0.0",
      "@tailwindcss/postcss": "^4.0.0",
      postcss: "^8.5.0",
      eslint: "^9.18.0",
      "eslint-config-next": isV15 ? "^15.1.0" : "^14.2.0",
    },
  };
  addFile("package.json", JSON.stringify(packageJson, null, 2), "application/json", "Next.js package manifest");

  // 2. tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: {
        "@/*": ["./*"],
      },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  };
  addFile("tsconfig.json", JSON.stringify(tsconfig, null, 2), "application/json", "TypeScript configuration for Next.js");

  // 3. next.config.mjs
  const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
      ],
    },
  ],
};

export default nextConfig;
`;
  addFile("next.config.mjs", nextConfig, "application/javascript", "Next.js configuration");

  // 3b. postcss.config.mjs for Tailwind v4
  const postcssConfig = `export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
`;
  addFile("postcss.config.mjs", postcssConfig, "application/javascript", "PostCSS configuration for Tailwind v4");

  // 4. app/globals.css
  const globalsCss = `@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #09090b;
  --primary: #3b82f6;
  --primary-foreground: #ffffff;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  min-height: 100vh;
}
`;
  addFile("app/globals.css", globalsCss, "text/css", "Global Tailwind CSS styles");

  // 5. app/layout.tsx (Root Layout with Font Optimization & Metadata)
  const escapedProjectName = escapeJsString(projectIR.name);
  const escapedDescription = escapeJsString(projectIR.metadata?.description || "Built with ForgeStudio Next.js Generator");

  const rootLayoutTsx = `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import './forge.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: '${escapedProjectName} | ForgeStudio',
    template: '%s | ${escapedProjectName}',
  },
  description: '${escapedDescription}',
  metadataBase: new URL('https://forge.studio'),
  openGraph: {
    title: '${escapedProjectName}',
    description: '${escapedDescription}',
    siteName: '${escapedProjectName}',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
`;
  addFile("app/layout.tsx", rootLayoutTsx, "text/typescript-jsx", "Root App Router layout");

  // 6. app/loading.tsx
  const loadingTsx = `import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading page content...</p>
      </div>
    </div>
  );
}
`;
  addFile("app/loading.tsx", loadingTsx, "text/typescript-jsx", "App Router loading boundary");

  // 7. app/error.tsx
  const errorTsx = `'use client';

import React, { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Router Boundary Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-sm border border-red-100 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
          !
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-600 mb-6">
          {error.message || 'An unexpected error occurred while loading this route.'}
        </p>
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
`;
  addFile("app/error.tsx", errorTsx, "text/typescript-jsx", "App Router error boundary");

  // 8. app/not-found.tsx
  const notFoundTsx = `import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-6xl font-black text-slate-800">404</h1>
        <p className="text-lg font-semibold text-slate-700 mt-2">Route Not Found</p>
        <p className="text-sm text-slate-500 mt-1">The requested page does not exist on this server.</p>
        <Link
          href="/"
          className="mt-6 inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
`;
  addFile("app/not-found.tsx", notFoundTsx, "text/typescript-jsx", "App Router 404 boundary");

  // 9. app/sitemap.ts
  const staticRoutePaths = Array.from(
    new Set(
      projectIR.components
        .filter((c) => c.isPage)
        .map((c) => (c.routePath === "/home" ? "/" : c.routePath || "/"))
        .filter((p) => !p.includes(":"))
    )
  );
  if (!staticRoutePaths.includes("/")) staticRoutePaths.unshift("/");

  const sitemapTs = `import { MetadataRoute } from 'next';

const routes = ${JSON.stringify(staticRoutePaths)};

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://forge.studio').replace(/\\/+$/, '');

  return routes.map((route) => ({
    url: route === '/' ? baseUrl : \`\${baseUrl}\${route}\`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '/' ? 1 : 0.7,
  }));
}
`;
  addFile("app/sitemap.ts", sitemapTs, "application/typescript", "Next.js dynamic sitemap");

  // 10. app/robots.ts
  const robotsTs = `import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://forge.studio';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: \`\${baseUrl}/sitemap.xml\`,
  };
}
`;
  addFile("app/robots.ts", robotsTs, "application/typescript", "Next.js dynamic robots.txt");

  // 11. middleware.ts
  const middlewareTs = `import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Security response headers
  const response = NextResponse.next();
  response.headers.set('X-Robots-Tag', 'all');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
`;
  addFile("middleware.ts", middlewareTs, "application/typescript", "Next.js edge middleware");

  // 12. app/api/health/route.ts (Route Handlers)
  const healthRouteTs = `import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: '${escapeJsString(projectIR.name)}',
  });
}
`;
  addFile("app/api/health/route.ts", healthRouteTs, "application/typescript", "Health check API route handler");

  // 13. app/actions/submitAction.ts (Server Actions)
  const serverActionTs = `'use server';

export interface FormSubmissionResult {
  success: boolean;
  message: string;
}

export async function submitContactAction(formData: FormData): Promise<FormSubmissionResult> {
  const email = formData.get('email');
  const message = formData.get('message');

  if (!email || typeof email !== 'string') {
    return { success: false, message: 'Valid email is required.' };
  }

  // [forge-protect-start: custom-action-handler]
  // Process contact form securely on the server
  // [forge-protect-end: custom-action-handler]

  return {
    success: true,
    message: 'Thank you for your message. We will get back to you shortly.',
  };
}
`;
  addFile("app/actions/submitAction.ts", serverActionTs, "application/typescript", "Secure Next.js Server Action");

  // 14. .env.example
  const envExample = `# Public Client Variables (Exposed to browser via NEXT_PUBLIC_)
NEXT_PUBLIC_SITE_URL=https://forge.studio
NEXT_PUBLIC_API_URL=https://api.forge.studio

# Server-Only Secrets (Never exposed to browser bundle)
DATABASE_URL=postgresql://user:pass@localhost:5432/forge_db
API_SECRET_KEY=forge_sec_example_key
`;
  addFile(".env.example", envExample, "text/plain", "Next.js environment variables configuration");

  // 15. Generate Routes and Pages
  const routeConfigs: Array<{ path: string; name: string; file: string; dynamic?: boolean }> = [];
  const componentConfigs: Array<{ name: string; file: string; isClient?: boolean; isPage?: boolean }> = [];

  addFile("lib/forgeStyle.ts", FORGE_CSS_HELPER_SOURCE, "application/typescript", "Inline style helper");

  const usedPageFiles = new Set<string>();

  for (const comp of projectIR.components) {
    if (comp.isPage) {
      const routePath = comp.routePath === "/home" ? "/" : comp.routePath || "/";

      // App router file path ("/blog/:slug" -> "app/blog/[slug]/page.tsx")
      const pageFile = pageFilePathFor("nextjs", comp.name, routePath);
      const relativeRoute = pageFile.replace(/^app\/?/, "").replace(/\/?page\.tsx$/, "");
      if (usedPageFiles.has(pageFile)) {
        planWarnings.push(`Page '${comp.name}' shares route '${routePath}' with another page and was skipped.`);
        continue;
      }
      usedPageFiles.add(pageFile);

      const route = projectIR.routes.find((r) => r.componentId === comp.id);
      const pageContent = generateNextPageSource(comp, renderingStrategy, revalidateSeconds, renderCtx, {
        title: route?.title,
        description: route?.metaDescription,
        isHome: routePath === "/",
        isDynamic: relativeRoute.includes("["),
      });
      const isClient = isInteractiveElement(comp.rootElement);

      addFile(pageFile, pageContent, "text/typescript-jsx", `Next.js page route: /${relativeRoute}`);
      routeConfigs.push({
        path: comp.routePath || "/",
        name: comp.name,
        file: pageFile,
        dynamic: relativeRoute.includes("["),
      });
      componentConfigs.push({
        name: comp.name,
        file: pageFile,
        isClient,
        isPage: true,
      });
    } else {
      const compCleanName = toValidComponentName(comp.name);
      const compFile = `components/${compCleanName}.tsx`;
      const isClient = isInteractiveElement(comp.rootElement);
      const clientDirective = isClient ? `"use client";\n\n` : "";
      const local = { ...renderCtx, uses: { link: false, image: false, css: false } };
      const rootJsx = renderElementToJsx(comp.rootElement, local, "      ");

      const compCode = `${clientDirective}${buildJsxImports(local.uses, "@/lib/forgeStyle").join("\n")}

export interface ${compCleanName}Props {
  className?: string;
  children?: React.ReactNode;
  // [forge-protect-start: custom-props]
  // Component props
  // [forge-protect-end: custom-props]
}

export function ${compCleanName}({ className = '', children }: ${compCleanName}Props) {
  // [forge-protect-start: custom-logic]
  // Custom component logic
  // [forge-protect-end: custom-logic]

  return (
    <div className={\`${compCleanName.toLowerCase()}-wrapper \${className}\`}>
${rootJsx}
      {children}
    </div>
  );
}

export default ${compCleanName};
`;
      addFile(compFile, compCode, "text/typescript-jsx", `Next.js reusable component: ${compCleanName}`);
      componentConfigs.push({
        name: compCleanName,
        file: compFile,
        isClient,
        isPage: false,
      });
    }
  }

  addFile(
    "app/forge.css",
    buildForgeStylesheet(projectIR.designTokens, renderCtx.cssRules, projectIR.customCss),
    "text/css",
    "Design tokens, responsive overrides and custom CSS"
  );
  planWarnings.push(...renderCtx.warnings);

  return {
    id: `plan_next_${Date.now()}`,
    projectId: projectIR.projectId,
    framework: "nextjs",
    frameworkVersion: isV15 ? "15.1.0" : "14.2.0",
    createdAt: new Date().toISOString(),
    scope,
    files: plannedFiles,
    dependencies: packageJson.dependencies,
    devDependencies: packageJson.devDependencies,
    routes: routeConfigs,
    components: componentConfigs,
    environment: {
      clientVars: {
        NEXT_PUBLIC_SITE_URL: "https://forge.studio",
      },
      serverVars: {
        DATABASE_URL: "postgresql://user:pass@localhost:5432/forge_db",
      },
    },
    warnings: Array.from(new Set(planWarnings)),
  };
}

export const nextjsGeneratorService = {
  buildNextJsGenerationPlan,
};
