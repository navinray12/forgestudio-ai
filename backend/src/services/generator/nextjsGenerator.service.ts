/**
 * ForgeStudio Module 09: Next.js Project Generator Service
 * Production-grade Next.js 14/15 App Router Generator with Server/Client Component placement,
 * Server Actions, Route Handlers, Metadata, Image/Font Optimization, and Scoped Regeneration.
 */

import { ProjectIR, ComponentIR, ElementIR } from "../compiler/unifiedCompiler.service.js";
import {
  GenerationPlan,
  GenerationScope,
  PlannedFile,
  NextJsGeneratorOptions,
} from "./generatorTypes.js";
import { reconcilePlannedFile } from "./sourcePreservation.service.js";
import { stylesToTailwindClasses } from "../codeGenerator.service.js";

/**
 * Check if ElementIR or its descendants contain interactivity requiring "use client"
 */
function isInteractiveElement(el: ElementIR): boolean {
  if (
    el.type === "form" ||
    el.type === "button" ||
    el.tag === "button" ||
    el.attributes?.onClick ||
    el.attributes?.onSubmit ||
    el.props?.onClick
  ) {
    return true;
  }
  if (el.children && el.children.length > 0) {
    return el.children.some(isInteractiveElement);
  }
  return false;
}

/**
 * Render ElementIR node to clean Next.js JSX (using next/image for images)
 */
function renderNextElementToJSX(el: ElementIR, indent = "        "): string {
  const twClasses = [
    ...(el.classes || []),
    ...stylesToTailwindClasses(el.styles || {}),
  ];

  if (el.responsiveStyles) {
    for (const [bp, bpStyles] of Object.entries(el.responsiveStyles)) {
      const bpTw = stylesToTailwindClasses(bpStyles).map((c) => `${bp}:${c}`);
      twClasses.push(...bpTw);
    }
  }

  const classAttr = twClasses.length > 0 ? ` className="${twClasses.join(" ")}"` : "";
  const tag = el.tag || "div";

  const ariaLabel = el.attributes?.["aria-label"] || el.props?.alt ? ` aria-label="${el.attributes?.["aria-label"] || el.props?.alt}"` : "";
  const roleAttr = el.attributes?.role ? ` role="${el.attributes.role}"` : "";
  const hrefAttr = el.props?.href ? ` href="${el.props.href}"` : "";

  // Next.js Image Optimization
  if (tag === "img" || el.type === "image") {
    const src = el.props?.src || "/placeholder.webp";
    const alt = el.props?.alt || el.name || "Optimized Image";
    return `${indent}<Image src="${src}" alt="${alt}" width={800} height={500} className="${twClasses.join(" ")} rounded-lg object-cover"${ariaLabel}${roleAttr} />`;
  }

  if (tag === "hr" || tag === "input") {
    return `${indent}<${tag}${classAttr}${hrefAttr}${ariaLabel}${roleAttr} />`;
  }

  const text = el.textContent || el.props?.content || el.props?.buttonText || "";
  const hasChildren = el.children && el.children.length > 0;

  if (!hasChildren) {
    return `${indent}<${tag}${classAttr}${hrefAttr}${ariaLabel}${roleAttr}>${text}</${tag}>`;
  }

  const childJsx = el.children.map((c) => renderNextElementToJSX(c, indent + "  ")).join("\n");
  return `${indent}<${tag}${classAttr}${hrefAttr}${ariaLabel}${roleAttr}>\n${text ? `${indent}  ${text}\n` : ""}${childJsx}\n${indent}</${tag}>`;
}

/**
 * Generate Next.js Page component (Server Component by default, "use client" if interactive)
 */
function generateNextPageSource(comp: ComponentIR, renderingStrategy: "ssr" | "ssg" | "isr", revalidateSeconds = 60): string {
  const isClient = isInteractiveElement(comp.rootElement);
  const clientDirective = isClient ? `"use client";\n\n` : "";
  const rootJsx = renderNextElementToJSX(comp.rootElement, "      ");

  // Rendering strategy directives
  let renderingDirectives = "";
  if (renderingStrategy === "ssr") {
    renderingDirectives = `export const dynamic = 'force-dynamic';\n`;
  } else if (renderingStrategy === "isr") {
    renderingDirectives = `export const revalidate = ${revalidateSeconds};\n`;
  } else {
    renderingDirectives = `export const dynamic = 'force-static';\n`;
  }

  return `${clientDirective}import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

${renderingDirectives}
export default function ${comp.name.replace(/[^a-zA-Z0-9]/g, "")}Page() {
  // [forge-protect-start: custom-page-logic]
  // Custom server data fetching, actions, or client hooks
  // [forge-protect-end: custom-page-logic]

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
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
  const planWarnings: string[] = [];

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
  const packageJson = {
    name: projectIR.slug || "forgestudio-nextjs-app",
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
  const rootLayoutTsx = `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: '${projectIR.name} | ForgeStudio',
    template: '%s | ${projectIR.name}',
  },
  description: '${projectIR.metadata?.description || "Built with ForgeStudio Next.js Generator"}',
  metadataBase: new URL('https://forge.studio'),
  openGraph: {
    title: '${projectIR.name}',
    description: '${projectIR.metadata?.description || "High-performance Next.js application"}',
    siteName: '${projectIR.name}',
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
  const sitemapTs = `import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://forge.studio';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
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
    service: '${projectIR.name}',
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

  for (const comp of projectIR.components) {
    if (comp.isPage) {
      let relativeRoute = (comp.routePath || "/").replace(/^\/+/, "");
      if (!relativeRoute || relativeRoute === "home") {
        relativeRoute = "";
      }

      // App router file path
      const pageFile = relativeRoute ? `app/${relativeRoute}/page.tsx` : `app/page.tsx`;
      const pageContent = generateNextPageSource(comp, renderingStrategy, revalidateSeconds);
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
      const compFile = `components/${comp.name.replace(/[^a-zA-Z0-9]/g, "")}.tsx`;
      const isClient = isInteractiveElement(comp.rootElement);
      const clientDirective = isClient ? `"use client";\n\n` : "";
      const rootJsx = renderNextElementToJSX(comp.rootElement, "      ");

      const compCode = `${clientDirective}import React from 'react';
import Image from 'next/image';

export interface ${comp.name}Props {
  className?: string;
  children?: React.ReactNode;
  // [forge-protect-start: custom-props]
  // Component props
  // [forge-protect-end: custom-props]
}

export function ${comp.name}({ className = '', children }: ${comp.name}Props) {
  // [forge-protect-start: custom-logic]
  // Custom component logic
  // [forge-protect-end: custom-logic]

  return (
    <div className={\`${comp.name.toLowerCase()}-wrapper \${className}\`}>
${rootJsx}
      {children}
    </div>
  );
}

export default ${comp.name};
`;
      addFile(compFile, compCode, "text/typescript-jsx", `Next.js reusable component: ${comp.name}`);
      componentConfigs.push({
        name: comp.name,
        file: compFile,
        isClient,
        isPage: false,
      });
    }
  }

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
    warnings: planWarnings,
  };
}

export const nextjsGeneratorService = {
  buildNextJsGenerationPlan,
};
