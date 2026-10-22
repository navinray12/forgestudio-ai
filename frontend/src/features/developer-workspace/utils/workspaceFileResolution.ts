import type { FileTreeNode, ProjectPage } from "../services/forgeProjectService";

// Workspace file / route resolution for the Developer Workspace: which project file is a page (not a
// helper component or asset), the default file to open, and the page file for a route.
// Pure functions, moved verbatim from pages/DeveloperWorkspace.tsx, which re-exports them.

/**
 * Identify whether a given workspace file path represents a helper component, utility, or non-page asset.
 * Guarantees that EmptyState.tsx or arbitrary UI atoms are never treated as route pages.
 */
export function isHelperOrNonPageFile(filePath: string): boolean {
  const clean = filePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  const nonPageDirs = [
    "src/components/",
    "components/",
    "src/utils/",
    "utils/",
    "src/hooks/",
    "hooks/",
    "src/services/",
    "services/",
    "src/styles/",
    "styles/",
    "src/types/",
    "types/",
    "src/lib/",
    "lib/",
    "src/api/",
    "api/",
    "public/",
    "assets/",
    "src/assets/",
  ];
  if (nonPageDirs.some((dir) => clean.startsWith(dir) || clean.includes(`/${dir}`))) {
    return true;
  }
  const nonPageFileNames = [
    "EmptyState.tsx",
    "EmptyState.jsx",
    "Button.tsx",
    "Button.jsx",
    "ErrorBoundary.tsx",
    "ErrorBoundary.jsx",
  ];
  const base = clean.split("/").pop() || "";
  return nonPageFileNames.includes(base);
}

/**
 * Identify the real entry page from the project manifest, route configuration, and file tree.
 * Never selects EmptyState.tsx or another helper component as the page source by default.
 */
export function resolveDefaultWorkspaceFile(
  fileTree: FileTreeNode[],
  manifest: any | null,
  pages: ProjectPage[] = []
): string | null {
  const allFiles: string[] = [];
  const collectFiles = (nodes: FileTreeNode[]) => {
    for (const node of nodes) {
      if (!node.isDirectory) {
        allFiles.push(node.path);
      } else if (node.children) {
        collectFiles(node.children);
      }
    }
  };
  collectFiles(fileTree);

  if (allFiles.length === 0) return null;
  const hasFile = (p: string) => allFiles.includes(p);

  // 1. Identify the home/root page from the visual pages registry
  const homePage = pages.find((p) => p.isHome || p.routePath === "/");
  if (homePage?.filePath && hasFile(homePage.filePath) && !isHelperOrNonPageFile(homePage.filePath)) {
    return homePage.filePath;
  }

  // 2. Identify any other valid page from the visual pages registry
  for (const page of pages) {
    if (page.filePath && hasFile(page.filePath) && !isHelperOrNonPageFile(page.filePath)) {
      return page.filePath;
    }
  }

  // 3. Check project manifest build entryPoint (e.g. app/page.tsx or src/App.tsx)
  const manifestEntry = manifest?.build?.entryPoint;
  if (typeof manifestEntry === "string" && hasFile(manifestEntry) && !isHelperOrNonPageFile(manifestEntry)) {
    return manifestEntry;
  }

  // 4. Well-known Next.js page entry files
  const nextCandidates = [
    "app/page.tsx",
    "app/page.jsx",
    "pages/index.tsx",
    "pages/index.jsx",
    "src/app/page.tsx",
    "src/app/page.jsx",
  ];
  for (const candidate of nextCandidates) {
    if (hasFile(candidate)) return candidate;
  }

  // 5. Well-known React page files in src/pages/
  const reactHomeCandidates = [
    "src/pages/HomePage.tsx",
    "src/pages/HomePage.jsx",
    "src/pages/IndexPage.tsx",
    "src/pages/IndexPage.jsx",
  ];
  for (const candidate of reactHomeCandidates) {
    if (hasFile(candidate)) return candidate;
  }

  // Any other page in src/pages/ (excluding helper components)
  const srcPage = allFiles.find(
    (f) =>
      (f.startsWith("src/pages/") || f.startsWith("pages/")) &&
      /\.(tsx|jsx)$/.test(f) &&
      !isHelperOrNonPageFile(f)
  );
  if (srcPage) return srcPage;

  // 6. Application shells (App.tsx / main.tsx)
  const appCandidates = [
    "src/App.tsx",
    "src/App.jsx",
    "App.tsx",
    "App.jsx",
    "src/main.tsx",
    "src/main.jsx",
    "src/index.tsx",
    "src/index.jsx",
    "index.html",
  ];
  for (const candidate of appCandidates) {
    if (hasFile(candidate)) return candidate;
  }

  // 7. Any root-level or source file that is NOT a helper component
  const fallback = allFiles.find(
    (f) =>
      !isHelperOrNonPageFile(f) &&
      /\.(tsx|jsx|ts|js|html)$/.test(f) &&
      !f.includes(".test.") &&
      !f.includes(".spec.")
  );
  return fallback || null;
}

/**
 * Resolve the page source file corresponding to a route path from pages registry and file tree.
 * Excludes helper and utility components like EmptyState.tsx.
 */
export function resolveFileForRoute(
  route: string,
  fileTree: FileTreeNode[],
  pages: ProjectPage[] = []
): string | null {
  const cleanRoute = (route || "/").trim().toLowerCase();

  // 1. Direct match in visual pages registry
  const matched = pages.find((p) => p.routePath.toLowerCase() === cleanRoute) ||
                  (cleanRoute === "/" ? pages.find((p) => p.isHome) : undefined);
  if (matched?.filePath && !isHelperOrNonPageFile(matched.filePath)) {
    return matched.filePath;
  }

  // Flatten file list
  const allFiles: string[] = [];
  const collectFiles = (nodes: FileTreeNode[]) => {
    for (const node of nodes) {
      if (!node.isDirectory) {
        allFiles.push(node.path);
      } else if (node.children) {
        collectFiles(node.children);
      }
    }
  };
  collectFiles(fileTree);

  const segment = cleanRoute === "/" ? "home" : cleanRoute.replace(/^\/+/, "").replace(/\/+$/, "");

  // Heuristic candidates (React and Next.js page conventions)
  const candidates = [
    `src/pages/${segment.charAt(0).toUpperCase() + segment.slice(1)}Page.tsx`,
    `src/pages/${segment.charAt(0).toUpperCase() + segment.slice(1)}Page.jsx`,
    `src/pages/${segment}.tsx`,
    `src/pages/${segment}.jsx`,
    `pages/${segment}.tsx`,
    `pages/${segment}.jsx`,
    `app/${segment}/page.tsx`,
    `src/app/${segment}/page.tsx`,
  ];
  if (cleanRoute === "/") {
    candidates.push(
      "src/pages/HomePage.tsx",
      "src/pages/IndexPage.tsx",
      "src/pages/AbcPage.tsx",
      "app/page.tsx",
      "src/app/page.tsx",
      "pages/index.tsx"
    );
  }

  for (const c of candidates) {
    const found = allFiles.find((f) => f.toLowerCase() === c.toLowerCase());
    if (found && !isHelperOrNonPageFile(found)) return found;
  }

  return null;
}
