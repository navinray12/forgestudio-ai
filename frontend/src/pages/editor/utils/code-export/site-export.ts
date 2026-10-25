/**
 * Code exporter: site-export. Moved verbatim from codeExporter.ts, which re-exports the public API.
 */
import type { CanonicalWebsiteData } from "../../types";
import { exportCode } from "./export-code";
import { toPascalCase } from "./styles";

/**
 * F-MULTI-EXPORT: Dynamically exports a complete multi-page website project from CanonicalWebsiteData.
 * Generates dynamic routes from pages[], shared Header & Footer, global styles CSS variables,
 * package.json, vite.config.ts, and React Router App.tsx.
 */
export function exportEntireWebsite(data: CanonicalWebsiteData): Record<string, string> {
  const files: Record<string, string> = {};
  const siteTitle = data.siteSettings?.title || data.name || "ForgeStudio Website";
  const homeId = data.homePageId || data.pages.find((p) => p.isHome || p.slug === "/")?.id || (data.pages[0]?.id ?? "home");

  // 1. package.json
  files["package.json"] = JSON.stringify(
    {
      name: (data.slug || "forgestudio-website").toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      version: `1.0.${data.publishing?.version || 1}`,
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
        "lucide-react": "^0.475.0",
      },
      devDependencies: {
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "@vitejs/plugin-react": "^4.3.4",
        typescript: "~5.7.2",
        vite: "^6.1.0",
      },
    },
    null,
    2
  );

  // 2. vite.config.ts
  files["vite.config.ts"] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;

  // 3. index.html
  files["index.html"] = `<!doctype html>
<html lang="${data.siteSettings?.language || "en"}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${siteTitle}</title>
    ${data.siteSettings?.favicon ? `<link rel="icon" href="${data.siteSettings.favicon}" />` : ""}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  // 4. src/styles/global.css (Tokens from GlobalStylesConfig)
  const gStyles = data.globalStyles || (data.globalSettings as any)?.globalStyles || data.globalSettings || {};
  const gVars = (data as any).variables || gStyles.variables || (data.globalSettings as any)?.variables || {};
  const gClasses = (data as any).globalClasses || gStyles.globalClasses || (data.globalSettings as any)?.globalClasses || {};

  let extraCssVars = "";
  if (gVars && typeof gVars === "object") {
    Object.entries(gVars).forEach(([k, v]: [string, any]) => {
      const varName = k.startsWith("--") ? k : `--${k}`;
      const val = typeof v === "object" ? v.value : v;
      if (val) extraCssVars += `  ${varName}: ${val};\n`;
    });
  }

  let globalClassCss = "";
  if (gClasses && typeof gClasses === "object") {
    Object.entries(gClasses).forEach(([className, styleObj]: [string, any]) => {
      if (styleObj && typeof styleObj === "object") {
        const rules = Object.entries(styleObj)
          .map(([prop, val]) => {
            const kebab = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
            return `${kebab}: ${val};`;
          })
          .join(" ");
        if (rules) globalClassCss += `.${className} { ${rules} }\n`;
      }
    });
  }
  files["src/styles/global.css"] = `:root {
  --forge-primary: ${gStyles.primaryColor || gStyles.colors?.primary || "#3b82f6"};
  --forge-secondary: ${gStyles.secondaryColor || gStyles.colors?.secondary || "#10b981"};
  --forge-accent: ${gStyles.accentColor || gStyles.colors?.accent || "#8b5cf6"};
  --forge-bg: ${gStyles.backgroundColor || gStyles.colors?.background || "#ffffff"};
  --forge-text: ${gStyles.textColor || gStyles.colors?.text || "#0f172a"};
  --forge-heading-font: ${gStyles.headingFont || gStyles.typography?.headingFontFamily || "Inter, sans-serif"};
  --forge-body-font: ${gStyles.bodyFont || gStyles.typography?.fontFamily || "Inter, sans-serif"};
  --forge-radius: ${gStyles.borderRadius || gStyles.buttonStyles?.borderRadius || "12px"};
  --forge-container-max: ${gStyles.containerMaxWidth || gStyles.containerStyles?.maxWidth || "1280px"};
${extraCssVars}}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--forge-body-font);
  background-color: var(--forge-bg);
  color: var(--forge-text);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--forge-heading-font);
}

.site-container {
  max-width: var(--forge-container-max);
  margin: 0 auto;
  padding: 0 1rem;
}

${globalClassCss}`;

  // 5. src/main.tsx
  files["src/main.tsx"] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
`;

  // 6. src/components/Header.tsx
  const headerEls = data.siteParts?.header?.elements || [];
  const headerContent = headerEls.length > 0
    ? headerEls.map((el) => exportCode(el, "tsx")).join("\n\n")
    : `export const Header: React.FC = () => {
  return (
    <header style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 0', backgroundColor: '#ffffff' }}>
      <div className="site-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontSize: '1.25rem', fontWeight: 800, textDecoration: 'none', color: 'var(--forge-primary)' }}>
          ${siteTitle}
        </a>
        <nav style={{ display: 'flex', gap: '1.5rem' }}>
          ${data.pages
            .map(
              (p) =>
                `<a href="${p.id === homeId || p.slug === "/" ? "/" : p.slug}" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', textDecoration: 'none' }}>${p.name}</a>`
            )
            .join("\n          ")}
        </nav>
      </div>
    </header>
  );
};
export default Header;
`;
  files["src/components/Header.tsx"] = headerContent.includes("export default")
    ? headerContent
    : `${headerContent}\nexport default Header;\n`;

  // 7. src/components/Footer.tsx
  const footerEls = data.siteParts?.footer?.elements || [];
  const footerContent = footerEls.length > 0
    ? footerEls.map((el) => exportCode(el, "tsx")).join("\n\n")
    : `export const Footer: React.FC = () => {
  return (
    <footer style={{ borderTop: '1px solid #e2e8f0', padding: '2rem 0', backgroundColor: '#f8fafc', marginTop: 'auto' }}>
      <div className="site-container" style={{ textAlign: 'center', fontSize: '0.875rem', color: '#64748b' }}>
        <p>&copy; {new Date().getFullYear()} ${siteTitle}. All rights reserved.</p>
      </div>
    </footer>
  );
};
export default Footer;
`;
  files["src/components/Footer.tsx"] = footerContent.includes("export default")
    ? footerContent
    : `${footerContent}\nexport default Footer;\n`;

  // 8. Dynamic Pages (src/pages/<PageName>.tsx)
  const pageImports: { name: string; path: string; slug: string }[] = [];
  const usedNames = new Set<string>();

  data.pages.forEach((page, idx) => {
    let baseCompName = toPascalCase(page.name) + "Page";
    if (usedNames.has(baseCompName)) {
      baseCompName = `${baseCompName}_${idx + 1}`;
    }
    usedNames.add(baseCompName);

    const safeSlug = page.id === homeId || page.slug === "/" ? "/" : page.slug.startsWith("/") ? page.slug : `/${page.slug}`;
    pageImports.push({ name: baseCompName, path: `./pages/${baseCompName}`, slug: safeSlug });

    const pageElements = Array.isArray(page.elements) ? page.elements : [];
    const elementsCode = pageElements.length > 0
      ? pageElements.map((el) => exportCode(el, "tsx")).join("\n\n")
      : `const EmptySection: React.FC = () => (
  <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
    <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>${page.name}</h1>
    <p style={{ color: '#64748b' }}>Welcome to the ${page.name} page.</p>
  </div>
);`;

    files[`src/pages/${baseCompName}.tsx`] = `import React from 'react';

${elementsCode}

export const ${baseCompName}: React.FC = () => {
  return (
    <main className="page-content" style={{ minHeight: '80vh' }}>
      ${pageElements.length > 0 ? pageElements.map(el => `<${toPascalCase(el.type || "Component")} />`).join("\n      ") : `<EmptySection />`}
    </main>
  );
};

export default ${baseCompName};
`;
  });

  // 9. src/App.tsx
  files["src/App.tsx"] = `import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
${pageImports.map((p) => `import ${p.name} from '${p.path}';`).join("\n")}

export function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <Routes>
${pageImports.map((p) => `        <Route path="${p.slug}" element={<${p.name} />} />`).join("\n")}
      </Routes>
      <Footer />
    </div>
  );
}

export default App;
`;

  return files;
}
