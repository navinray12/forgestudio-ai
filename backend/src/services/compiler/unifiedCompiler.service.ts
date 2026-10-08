import { AppError } from "../../utils/app-error.js";
import { generateAllCodeOutputs } from "../codeGenerator.service.js";
import { writeFile, readFile, ProjectFileEntity } from "../project/forgeFilesystem.service.js";

export const IR_SCHEMA_VERSION = "1.0.0";

export interface SourceRange {
  file: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface ElementIR {
  id: string;
  type: string;
  tag: string;
  name?: string;
  classes: string[];
  styles: Record<string, string>;
  responsiveStyles?: Record<string, Record<string, string>>;
  props?: Record<string, any>;
  attributes?: Record<string, string>;
  textContent?: string;
  children: ElementIR[];
  isProtected?: boolean; // Protected manual code region
  sourceRange?: SourceRange;
  dynamicData?: {
    source?: string;
    field?: string;
    fallback?: string;
  };
}

export interface ComponentIR {
  id: string;
  name: string;
  filePath: string;
  isPage: boolean;
  routePath?: string;
  rootElement: ElementIR;
  imports?: string[];
  customLogic?: string; // Hooks, state, manual helper functions
  props?: Record<string, any>;
  sourceRange?: SourceRange;
}

export interface RouteIR {
  path: string;
  componentId: string;
  title?: string;
  metaDescription?: string;
}

export interface DesignTokenIR {
  colors?: Record<string, string>;
  typography?: Record<string, any>;
  spacing?: Record<string, string>;
  radius?: Record<string, string>;
  shadows?: Record<string, string>;
  breakpoints?: Record<string, number>;
}

export interface ProjectIR {
  irVersion: string;
  schemaVersion?: string;
  projectId: string;
  name: string;
  slug: string;
  framework: string;
  components: ComponentIR[];
  routes: RouteIR[];
  designTokens: DesignTokenIR;
  globalStyles: Record<string, any>;
  customCss?: string;
  customJs?: string;
  metadata?: Record<string, any>;
}

export interface CompilerDiagnostic {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  file?: string;
  line?: number;
  col?: number;
  source?: string;
  suggestedAction?: string;
}

export interface CompilationResult {
  success: boolean;
  ir: ProjectIR;
  diagnostics: CompilerDiagnostic[];
  generatedFiles: Array<{ path: string; content: string; mimeType: string }>;
  filesCount?: number;
  incremental: boolean;
}

// In-memory incremental compilation cache keyed by `${projectId}:${contentHash}`
const compilationCache = new Map<string, { timestamp: number; ir: ProjectIR }>();

/**
 * Convert Visual Editor Element tree to canonical ElementIR
 */
export function visualElementToIR(element: any, filePath: string, parentLine = 1): ElementIR {
  if (!element || typeof element !== "object") {
    return {
      id: "el_default",
      type: "container",
      tag: "div",
      classes: [],
      styles: {},
      children: [],
    };
  }

  const children: ElementIR[] = [];
  if (Array.isArray(element.elements)) {
    element.elements.forEach((child: any, idx: number) => {
      children.push(visualElementToIR(child, filePath, parentLine + idx + 1));
    });
  }

  const tagMap: Record<string, string> = {
    heading: (element.headingLevel || "h2").toLowerCase(),
    button: "button",
    text: "p",
    paragraph: "p",
    image: "img",
    video: "video",
    container: "div",
    divider: "hr",
    spacer: "div",
  };

  const tag = tagMap[element.type] || "div";

  return {
    id: element.id || `el_${Math.random().toString(36).substring(2, 9)}`,
    type: element.type || "container",
    tag,
    name: element.name || element.label,
    classes: Array.isArray(element.classes) ? element.classes : [],
    styles: element.styles || {},
    responsiveStyles: element.responsiveStyles || {},
    props: {
      content: element.content,
      src: element.src,
      alt: element.alt,
      href: element.href,
      target: element.target,
      placeholder: element.placeholder,
      buttonText: element.buttonText,
      ...(element.props || {}),
    },
    textContent: typeof element.content === "string" ? element.content : undefined,
    children,
    isProtected: !!element.isProtected,
    sourceRange: {
      file: filePath,
      startLine: parentLine,
      startCol: 1,
      endLine: parentLine + 2,
      endCol: 1,
    },
    dynamicData: element.dynamicData,
  };
}

/**
 * Convert Visual Document (editorData) to canonical ProjectIR
 */
export function visualDocumentToIR(
  editorData: any,
  projectInfo: { id: string; name: string; slug: string; framework?: string }
): ProjectIR {
  const elements = Array.isArray(editorData?.elements) ? editorData.elements : [];
  const pages = Array.isArray(editorData?.pages) ? editorData.pages : [];
  const globalStyles = editorData?.globalStyles || {};
  const designTokens = editorData?.designTokens || {};

  const components: ComponentIR[] = [];
  const routes: RouteIR[] = [];

  // Multi-page document
  if (pages.length > 0) {
    for (const page of pages) {
      const pageElements = Array.isArray(page.elements) ? page.elements : [];
      const rootEl: ElementIR = {
        id: `page_root_${page.id}`,
        type: "container",
        tag: "main",
        classes: ["min-h-screen", "w-full"],
        styles: {},
        children: pageElements.map((el: any) => visualElementToIR(el, `src/pages/${page.slug || "page"}.tsx`)),
      };

      const compId = `comp_${page.id}`;
      const compName = (page.name || "Page").replace(/[^a-zA-Z0-9]/g, "");
      const filePath = `src/pages/${page.slug === "/" || page.slug === "home" ? "Home" : compName}.tsx`;

      components.push({
        id: compId,
        name: compName,
        filePath,
        isPage: true,
        routePath: page.path || page.slug || "/",
        rootElement: rootEl,
        imports: ["import React from 'react';"],
      });

      routes.push({
        path: page.path || page.slug || "/",
        componentId: compId,
        title: page.title || page.name,
        metaDescription: page.metaDescription,
      });
    }
  } else {
    // Single page document
    const rootEl: ElementIR = {
      id: "root_main",
      type: "container",
      tag: "main",
      classes: ["min-h-screen", "w-full"],
      styles: {},
      children: elements.map((el: any) => visualElementToIR(el, "src/App.tsx")),
    };

    components.push({
      id: "comp_main",
      name: "App",
      filePath: "src/App.tsx",
      isPage: true,
      routePath: "/",
      rootElement: rootEl,
      imports: ["import React from 'react';"],
    });

    routes.push({
      path: "/",
      componentId: "comp_main",
      title: projectInfo.name,
    });
  }

  return {
    irVersion: IR_SCHEMA_VERSION,
    schemaVersion: IR_SCHEMA_VERSION,
    projectId: projectInfo.id,
    name: projectInfo.name,
    slug: projectInfo.slug,
    framework: projectInfo.framework || "react",
    components,
    routes,
    designTokens: {
      colors: designTokens.colors || {},
      typography: designTokens.typography || {},
      spacing: designTokens.spacing || {},
      radius: designTokens.radius || {},
      shadows: designTokens.shadows || {},
      breakpoints: designTokens.breakpoints || { sm: 640, md: 768, lg: 1024, xl: 1280 },
    },
    globalStyles,
    customCss: editorData?.customCss || "",
    customJs: editorData?.customJs || "",
    metadata: { generatedAt: new Date().toISOString() },
  };
}

/**
 * Convert ElementIR back to Visual EditorElement
 */
export function irElementToVisual(ir: ElementIR): any {
  const elements = ir.children.map(irElementToVisual);

  return {
    id: ir.id,
    type: ir.type || "container",
    headingLevel: ir.tag.startsWith("h") ? ir.tag.toUpperCase() : undefined,
    name: ir.name,
    classes: ir.classes || [],
    styles: ir.styles || {},
    responsiveStyles: ir.responsiveStyles || {},
    content: ir.textContent || ir.props?.content || "",
    src: ir.props?.src,
    alt: ir.props?.alt,
    href: ir.props?.href,
    target: ir.props?.target,
    placeholder: ir.props?.placeholder,
    buttonText: ir.props?.buttonText,
    isProtected: ir.isProtected,
    elements,
  };
}

/**
 * Convert ProjectIR back to Visual editorData
 */
export function irToVisualDocument(ir: ProjectIR): any {
  if (ir.components.length === 1 && !ir.components[0].routePath) {
    const mainComp = ir.components[0];
    return {
      version: 1,
      elements: mainComp.rootElement.children.map(irElementToVisual),
      globalStyles: ir.globalStyles || {},
      designTokens: ir.designTokens || {},
      customCss: ir.customCss || "",
      customJs: ir.customJs || "",
    };
  }

  // Multi-page representation
  const pages = ir.components.map((c) => ({
    id: c.id.replace("comp_", ""),
    name: c.name,
    slug: c.routePath || `/${c.name.toLowerCase()}`,
    path: c.routePath || `/${c.name.toLowerCase()}`,
    elements: c.rootElement.children.map(irElementToVisual),
  }));

  return {
    version: 1,
    pages,
    elements: pages[0]?.elements || [],
    globalStyles: ir.globalStyles || {},
    designTokens: ir.designTokens || {},
    customCss: ir.customCss || "",
    customJs: ir.customJs || "",
  };
}

/**
 * Optimization pass: Dead node elimination and unused styling cleanup
 */
export function optimizeIR(ir: ProjectIR): { ir: ProjectIR; eliminatedNodesCount: number } {
  let eliminatedNodesCount = 0;

  function pruneElement(el: ElementIR): ElementIR | null {
    // If spacer or divider has zero dimensions and no children, prune
    if (el.type === "spacer" && el.styles.height === "0px" && (!el.children || el.children.length === 0)) {
      eliminatedNodesCount++;
      return null;
    }

    const prunedChildren: ElementIR[] = [];
    for (const child of el.children) {
      const res = pruneElement(child);
      if (res) prunedChildren.push(res);
    }

    return {
      ...el,
      children: prunedChildren,
    };
  }

  const optimizedComponents = ir.components.map((c) => {
    const optimizedRoot = pruneElement(c.rootElement) || c.rootElement;
    return {
      ...c,
      rootElement: optimizedRoot,
    };
  });

  return {
    ir: { ...ir, components: optimizedComponents },
    eliminatedNodesCount,
  };
}

/**
 * Generate full source file tree from ProjectIR
 */
export function compileIRToSourceFiles(ir: ProjectIR): Array<{ path: string; content: string; mimeType: string }> {
  const visualDoc = irToVisualDocument(ir);
  const codeOutputs = generateAllCodeOutputs(visualDoc, { scope: "full" });

  const files: Array<{ path: string; content: string; mimeType: string }> = [];

  // 1. package.json
  const packageJson = {
    name: ir.slug,
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
      "lucide-react": "^1.40.0",
    },
    devDependencies: {
      typescript: "^5.7.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      vite: "^6.0.0",
      tailwindcss: "^4.0.0",
    },
  };
  files.push({
    path: "package.json",
    content: JSON.stringify(packageJson, null, 2),
    mimeType: "application/json",
  });

  // 2. tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      useDefineForClassFields: true,
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noFallthroughCasesInSwitch: true,
    },
    include: ["src"],
  };
  files.push({
    path: "tsconfig.json",
    content: JSON.stringify(tsconfig, null, 2),
    mimeType: "application/json",
  });

  // 3. index.html
  files.push({
    path: "index.html",
    content: codeOutputs.html || `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${ir.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    mimeType: "text/html",
  });

  // 4. src/main.tsx
  files.push({
    path: "src/main.tsx",
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    mimeType: "text/typescript-jsx",
  });

  // 5. src/index.css
  files.push({
    path: "src/index.css",
    content: codeOutputs.css || `@import "tailwindcss";

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  color: #1e293b;
  background-color: #ffffff;
}`,
    mimeType: "text/css",
  });

  // 6. src/App.tsx
  const appTsx = codeOutputs.reactCode?.appTsx || `import React from 'react';

export default function App() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">${ir.name}</h1>
      </div>
    </main>
  );
}`;
  files.push({
    path: "src/App.tsx",
    content: appTsx,
    mimeType: "text/typescript-jsx",
  });

  // 7. Component files from reactCode.components
  if (codeOutputs.reactCode?.components) {
    for (const [name, code] of Object.entries(codeOutputs.reactCode.components)) {
      files.push({
        path: `src/components/${name}.tsx`,
        content: code,
        mimeType: "text/typescript-jsx",
      });
    }
  }

  // 8. Design tokens file
  files.push({
    path: "src/styles/tokens.json",
    content: JSON.stringify(ir.designTokens, null, 2),
    mimeType: "application/json",
  });

  return files;
}

/**
 * Execute full compilation pipeline: Visual -> IR -> Optimize -> Persistent Filesystem
 */
export async function compileAndSyncProject(
  projectId: string,
  editorData: any,
  projectInfo: { id: string; name: string; slug: string; framework?: string },
  authorId?: string
): Promise<CompilationResult> {
  const diagnostics: CompilerDiagnostic[] = [];

  // 1. Visual -> IR
  const rawIR = visualDocumentToIR(editorData, projectInfo);

  // 2. Optimization pass
  const { ir: optimizedIR } = optimizeIR(rawIR);

  // 3. IR -> Source files
  const files = compileIRToSourceFiles(optimizedIR);

  // 4. Write generated files to project filesystem
  for (const file of files) {
    try {
      await writeFile(projectId, file.path, {
        content: file.content,
        encoding: "utf-8",
        isGenerated: true,
        authorId,
        reason: "Compiler IR sync",
      });
    } catch (err: any) {
      diagnostics.push({
        severity: "error",
        code: "FILE_WRITE_ERROR",
        message: `Failed to write generated file '${file.path}': ${err.message}`,
        file: file.path,
      });
    }
  }

  const success = !diagnostics.some((d) => d.severity === "error");

  return {
    success,
    ir: optimizedIR,
    diagnostics,
    generatedFiles: files,
    filesCount: files.length,
    incremental: false,
  };
}

export const unifiedCompilerService = {
  visualDocumentToIR,
  optimizeIR,
  compileIRToSourceFiles,
  compileAndSyncProject,
  compileProject: async (
    projectId: string,
    editorData: any,
    projectInfo: { id: string; name: string; slug: string; framework?: string } = {
      id: projectId,
      name: "ForgeProject",
      slug: "forge-project",
      framework: "react",
    },
    authorId?: string
  ) => {
    return compileAndSyncProject(projectId, editorData, projectInfo, authorId);
  },
};

