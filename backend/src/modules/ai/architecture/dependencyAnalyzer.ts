/**
 * ForgeStudio Module 40: Dependency Graph & Circular Dependency Analyzer
 */

import { forgeFilesystemService } from "../../../services/project/forgeFilesystem.service.js";

export interface DependencyGraph {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ from: string; to: string; label?: string }>;
  cycles: Array<{ cycle: string[] }>;
  fanIn: Record<string, number>;
  fanOut: Record<string, number>;
  highRiskModules: string[];
  mermaid: string;
}

export async function analyzeProjectDependencies(projectId: string): Promise<DependencyGraph> {
  const allFiles = await forgeFilesystemService.listFiles(projectId);
  const codeFiles = allFiles.filter(
    (f: any) =>
      !f.isDirectory &&
      (f.path.endsWith(".ts") ||
        f.path.endsWith(".tsx") ||
        f.path.endsWith(".js") ||
        f.path.endsWith(".jsx")) &&
      !f.path.includes("node_modules") &&
      !f.path.includes(".test.")
  );

  const adjacency: Map<string, Set<string>> = new Map();
  const fanIn: Record<string, number> = {};
  const fanOut: Record<string, number> = {};

  for (const f of codeFiles) {
    adjacency.set(f.path, new Set());
    fanIn[f.path] = 0;
    fanOut[f.path] = 0;
  }

  // Parse import statements from files
  for (const f of codeFiles) {
    try {
      const fileData = await forgeFilesystemService.readFile(projectId, f.path);
      const content = fileData.content || "";
      const importMatches = content.matchAll(/(?:import|from)\s+['"]([^'"]+)['"]/g);

      for (const match of importMatches) {
        const importPath = match[1];
        if (importPath.startsWith(".")) {
          // Resolve relative import to matching candidate
          const normalizedTarget = codeFiles.find((target) => {
            const base = target.path.replace(/\.[^/.]+$/, "");
            return (
              target.path.includes(importPath.replace("./", "").replace("../", "")) ||
              base.endsWith(importPath.replace(/^\.\//, ""))
            );
          });

          if (normalizedTarget && normalizedTarget.path !== f.path) {
            adjacency.get(f.path)?.add(normalizedTarget.path);
          }
        }
      }
    } catch {}
  }

  // Calculate fan-in and fan-out
  const edges: Array<{ from: string; to: string }> = [];
  for (const [source, targets] of adjacency.entries()) {
    fanOut[source] = targets.size;
    for (const target of targets) {
      edges.push({ from: source, to: target });
      fanIn[target] = (fanIn[target] || 0) + 1;
    }
  }

  // Detect circular dependencies via Tarjan / DFS
  const cycles: Array<{ cycle: string[] }> = [];
  const visited: Set<string> = new Set();
  const recStack: Set<string> = new Set();
  const currentPath: string[] = [];

  function dfsCycle(node: string) {
    visited.add(node);
    recStack.add(node);
    currentPath.push(node);

    const neighbors = adjacency.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfsCycle(neighbor);
      } else if (recStack.has(neighbor)) {
        // Cycle detected
        const cycleStartIndex = currentPath.indexOf(neighbor);
        if (cycleStartIndex !== -1) {
          cycles.push({ cycle: [...currentPath.slice(cycleStartIndex), neighbor] });
        }
      }
    }

    currentPath.pop();
    recStack.delete(node);
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      dfsCycle(node);
    }
  }

  // Identify high-risk modules (fan-out > 5 or fan-in > 8)
  const highRiskModules = codeFiles
    .map((f: any) => f.path)
    .filter((p: string) => (fanOut[p] || 0) > 5 || (fanIn[p] || 0) > 8);

  // Generate Mermaid representation
  const mermaidLines = ["graph TD"];
  const nodes = codeFiles.map((f: any) => {
    const type = f.path.includes("components")
      ? "component"
      : f.path.includes("services")
      ? "service"
      : f.path.includes("controllers")
      ? "controller"
      : "module";
    return { id: f.path, label: f.path.split("/").pop() || f.path, type };
  });

  for (const n of nodes.slice(0, 30)) {
    mermaidLines.push(`  "${n.id}"["${n.label}"]`);
  }
  for (const e of edges.slice(0, 40)) {
    mermaidLines.push(`  "${e.from}" --> "${e.to}"`);
  }

  return {
    nodes,
    edges,
    cycles: cycles.slice(0, 10),
    fanIn,
    fanOut,
    highRiskModules,
    mermaid: mermaidLines.join("\n"),
  };
}
