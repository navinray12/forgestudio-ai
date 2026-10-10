/**
 * ForgeStudio Feature 32: Project Template Engine
 * Scaffolds production project boilerplates (React+Vite, Next.js, Node/Express, Full-stack)
 * directly into forge_project_files with variable interpolation and design system defaults.
 */

import { pgPool } from "../../config/prisma.js";
import { forgeFilesystemService } from "../../services/project/forgeFilesystem.service.js";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { designSystemService } from "./designSystem.service.js";
import { AppError } from "../../utils/app-error.js";
import type { ProjectTemplateDefinition } from "./designSystem.types.js";

const BUILTIN_TEMPLATES: ProjectTemplateDefinition[] = [
  // 1. React + Vite
  {
    templateId: "react-vite",
    name: "React 19 + Vite + TailwindCSS",
    description: "Modern, blazing-fast single page application starter with React 19, Vite, and Tailwind CSS.",
    framework: "react",
    category: "frontend",
    version: "1.0.0",
    dependencies: {
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      "lucide-react": "^0.460.0",
    },
    devDependencies: {
      vite: "^5.4.10",
      "@vitejs/plugin-react": "^4.3.3",
      typescript: "^5.6.3",
      tailwindcss: "^3.4.14",
      autoprefixer: "^10.4.20",
      postcss: "^8.4.47",
    },
    files: [
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name: "{{slug}}",
            private: true,
            version: "1.0.0",
            type: "module",
            scripts: {
              dev: "vite",
              build: "tsc && vite build",
              preview: "vite preview",
            },
            dependencies: { react: "^19.0.0", "react-dom": "^19.0.0", "lucide-react": "^0.460.0" },
            devDependencies: { vite: "^5.4.10", typescript: "^5.6.3", tailwindcss: "^3.4.14" },
          },
          null,
          2
        ),
      },
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{name}}</title>
  </head>
  <body class="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
      },
      {
        path: "src/main.tsx",
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './theme/tokens.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
      },
      {
        path: "src/App.tsx",
        content: `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight mb-4 text-blue-600">
        {{name}}
      </h1>
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-md">
        Welcome to your new ForgeStudio React application. Powered by React 19, Vite, and TailwindCSS.
      </p>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setCount((c) => c + 1)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-md"
        >
          Count: {count}
        </button>
      </div>
    </div>
  );
}`,
      },
    ],
  },

  // 2. Next.js App Router
  {
    templateId: "nextjs-app",
    name: "Next.js 15 App Router",
    description: "Production Next.js 15 project with App Router, React Server Components, and Tailwind CSS.",
    framework: "nextjs",
    category: "fullstack",
    version: "1.0.0",
    dependencies: {
      next: "^15.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    },
    devDependencies: {
      typescript: "^5.6.3",
      tailwindcss: "^3.4.14",
    },
    files: [
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name: "{{slug}}",
            version: "1.0.0",
            scripts: {
              dev: "next dev",
              build: "next build",
              start: "next start",
            },
            dependencies: { next: "^15.0.0", react: "^19.0.0", "react-dom": "^19.0.0" },
          },
          null,
          2
        ),
      },
      {
        path: "app/layout.tsx",
        content: `import './globals.css';
import React from 'react';

export const metadata = {
  title: '{{name}}',
  description: 'Built with ForgeStudio Next.js Engine',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,
      },
      {
        path: "app/page.tsx",
        content: `export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-black mb-4">{{name}}</h1>
      <p className="text-xl text-gray-500">Next.js 15 App Router with ForgeStudio Intelligence.</p>
    </main>
  );
}`,
      },
    ],
  },

  // 3. Node/Express API
  {
    templateId: "node-express-api",
    name: "Node.js + Express 5 API",
    description: "Scalable backend microservice template with Express 5, TypeScript, CORS, and Helmet.",
    framework: "node",
    category: "backend",
    version: "1.0.0",
    dependencies: {
      express: "^5.0.0",
      cors: "^2.8.5",
      helmet: "^8.0.0",
      dotenv: "^16.4.5",
    },
    devDependencies: {
      typescript: "^5.6.3",
      "@types/express": "^5.0.0",
      tsx: "^4.19.0",
    },
    files: [
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name: "{{slug}}",
            version: "1.0.0",
            main: "src/server.ts",
            scripts: {
              dev: "tsx watch src/server.ts",
              build: "tsc",
              start: "node dist/server.js",
            },
            dependencies: { express: "^5.0.0", cors: "^2.8.5", helmet: "^8.0.0" },
          },
          null,
          2
        ),
      },
      {
        path: "src/server.ts",
        content: `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: '{{name}}', timestamp: new Date() });
});

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from {{name}} API!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`{{name}} running on http://localhost:\${PORT}\`);
});`,
      },
    ],
  },
];

export class ProjectTemplateService {
  /**
   * Seed builtin templates into DB
   */
  async ensureBuiltinTemplates(): Promise<void> {
    for (const tmpl of BUILTIN_TEMPLATES) {
      await pgPool.query(
        `INSERT INTO forge_project_templates (
          "templateId", name, description, framework, category, version,
          dependencies, "devDependencies", files, "defaultConfig", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT ("templateId") DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          framework = EXCLUDED.framework,
          category = EXCLUDED.category,
          dependencies = EXCLUDED.dependencies,
          "devDependencies" = EXCLUDED."devDependencies",
          files = EXCLUDED.files,
          "updatedAt" = NOW()`,
        [
          tmpl.templateId,
          tmpl.name,
          tmpl.description,
          tmpl.framework,
          tmpl.category,
          tmpl.version,
          JSON.stringify(tmpl.dependencies),
          JSON.stringify(tmpl.devDependencies),
          JSON.stringify(tmpl.files),
          JSON.stringify(tmpl.defaultConfig || {}),
        ]
      );
    }
  }

  /**
   * List all available project templates
   */
  async listTemplates(): Promise<ProjectTemplateDefinition[]> {
    await this.ensureBuiltinTemplates();
    const res = await pgPool.query(`SELECT * FROM forge_project_templates ORDER BY framework ASC, name ASC`);
    return res.rows.map((r) => ({
      templateId: r.templateId,
      name: r.name,
      description: r.description,
      framework: r.framework,
      category: r.category,
      version: r.version,
      dependencies: r.dependencies,
      devDependencies: r.devDependencies,
      files: r.files,
      defaultConfig: r.defaultConfig,
    }));
  }

  /**
   * Scaffold a template into an existing Forge project
   */
  async scaffoldTemplate(
    projectId: string,
    templateId: string,
    options: {
      userId?: string;
      customVariables?: Record<string, string>;
      overwrite?: boolean;
    } = {}
  ): Promise<{
    filesCreated: string[];
    templateName: string;
  }> {
    const project = await getForgeProjectById(projectId);
    if (!project) throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");

    await this.ensureBuiltinTemplates();

    const tmplRes = await pgPool.query(
      `SELECT * FROM forge_project_templates WHERE "templateId" = $1`,
      [templateId]
    );

    if (tmplRes.rows.length === 0) {
      throw new AppError(`Template '${templateId}' not found`, 404, "TEMPLATE_NOT_FOUND");
    }

    const template: ProjectTemplateDefinition = tmplRes.rows[0];

    // Check if project already has files
    const existingFiles = await forgeFilesystemService.listFiles(projectId);
    if (existingFiles.length > 0 && !options.overwrite) {
      throw new AppError(
        `Project contains ${existingFiles.length} existing files. Pass overwrite: true to confirm template replacement.`,
        409,
        "PROJECT_NOT_EMPTY"
      );
    }

    // Prepare interpolation variables
    const variables: Record<string, string> = {
      name: project.name,
      slug: project.slug,
      ...(options.customVariables || {}),
    };

    const filesCreated: string[] = [];

    // Write all template files
    for (const f of template.files) {
      let content = f.content;
      for (const [k, v] of Object.entries(variables)) {
        content = content.replace(new RegExp(`{{${k}}}`, "g"), v);
      }

      await forgeFilesystemService.writeFile(projectId, f.path, {
        content,
        userId: options.userId,
        reason: `Scaffolded from template: ${template.name}`,
      });
      filesCreated.push(f.path);
    }

    // Apply design tokens
    await designSystemService.applyTokensToProject(projectId, options.userId);
    filesCreated.push("src/theme/tokens.css", "tailwind.config.js");

    // Create initial snapshot
    await forgeFilesystemService.createProjectSnapshot(
      projectId,
      `Template Scaffold: ${template.name}`,
      `Initial scaffold from ${template.templateId}`,
      options.userId
    );

    return {
      filesCreated,
      templateName: template.name,
    };
  }
}

export const projectTemplateService = new ProjectTemplateService();
