/**
 * ForgeStudio Module 36: Repository Knowledge Graph Engine
 * Canonical queryable graph connecting project files, AST symbols, API routes,
 * database entities, and external dependencies.
 */

import path from "node:path";
import { pgPool } from "../../config/prisma.js";
import { forgeFilesystemService } from "../../services/project/forgeFilesystem.service.js";
import { codeIntelligenceService } from "../code-intelligence/codeIntelligence.service.js";
import { AppError } from "../../utils/app-error.js";
import type {
  KnowledgeGraphNodeEntity,
  KnowledgeGraphEdgeEntity,
  KnowledgeGraphQuery,
  GraphQueryResult,
  BuildGraphResult,
  KnowledgeGraphNodeType,
  KnowledgeGraphEdgeType,
} from "./knowledgeGraph.types.js";

export class KnowledgeGraphService {
  /**
   * Build complete repository knowledge graph from Feature 35 symbols + repository assets
   */
  async buildKnowledgeGraph(projectId: string): Promise<BuildGraphResult> {
    const startTime = Date.now();

    // 1. Ensure Feature 35 index is present
    await codeIntelligenceService.indexProject(projectId);

    // 2. Fetch project files and symbols
    const files = await forgeFilesystemService.listFiles(projectId);
    const symbolsRes = await pgPool.query(
      `SELECT * FROM forge_code_symbols WHERE "projectId" = $1`,
      [projectId]
    );
    const symbols = symbolsRes.rows;

    const fileDepsRes = await pgPool.query(
      `SELECT * FROM forge_file_dependencies WHERE "projectId" = $1`,
      [projectId]
    );
    const fileDeps = fileDepsRes.rows;

    const refsRes = await pgPool.query(
      `SELECT * FROM forge_code_references WHERE "projectId" = $1`,
      [projectId]
    );
    const refs = refsRes.rows;

    // 3. Clear existing graph
    await pgPool.query(`DELETE FROM forge_knowledge_graph_edges WHERE "projectId" = $1`, [projectId]);
    await pgPool.query(`DELETE FROM forge_knowledge_graph_nodes WHERE "projectId" = $1`, [projectId]);

    const nodeKeyToId = new Map<string, string>();

    // Helper: insert node
    async function insertNode(
      nodeKey: string,
      name: string,
      nodeType: KnowledgeGraphNodeType,
      filePath?: string | null,
      symbolId?: string | null,
      metadata: Record<string, any> = {}
    ): Promise<string> {
      if (nodeKeyToId.has(nodeKey)) {
        return nodeKeyToId.get(nodeKey)!;
      }

      const res = await pgPool.query(
        `INSERT INTO forge_knowledge_graph_nodes (
          "projectId", "nodeKey", name, "nodeType", "filePath", "symbolId", metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT ("projectId", "nodeKey") DO UPDATE SET
          name = EXCLUDED.name,
          "nodeType" = EXCLUDED."nodeType",
          "filePath" = EXCLUDED."filePath",
          "symbolId" = EXCLUDED."symbolId",
          metadata = EXCLUDED.metadata,
          "updatedAt" = NOW()
        RETURNING id`,
        [projectId, nodeKey, name, nodeType, filePath || null, symbolId || null, JSON.stringify(metadata)]
      );

      const id = res.rows[0].id;
      nodeKeyToId.set(nodeKey, id);
      return id;
    }

    // Helper: insert edge
    async function insertEdge(
      sourceNodeId: string,
      targetNodeId: string,
      edgeType: KnowledgeGraphEdgeType,
      metadata: Record<string, any> = {}
    ) {
      if (sourceNodeId === targetNodeId) return;

      await pgPool.query(
        `INSERT INTO forge_knowledge_graph_edges (
          "projectId", "sourceNodeId", "targetNodeId", "edgeType", metadata
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT ("projectId", "sourceNodeId", "targetNodeId", "edgeType") DO NOTHING`,
        [projectId, sourceNodeId, targetNodeId, edgeType, JSON.stringify(metadata)]
      );
    }

    // 4. Create PROJECT root node
    const projectNodeId = await insertNode("project:root", "Repository Root", "PROJECT");

    // 5. Create FILE nodes and link from PROJECT
    for (const file of files) {
      const fileKey = `file:${file.path}`;
      const fileNodeId = await insertNode(fileKey, file.name, "FILE", file.path, null, {
        sizeBytes: file.sizeBytes,
        extension: file.extension,
      });
      await insertEdge(projectNodeId, fileNodeId, "DEPENDS_ON");
    }

    // 6. Create SYMBOL nodes and link from FILE (DEFINES)
    const symNameToNodeId = new Map<string, string>();
    for (const sym of symbols) {
      let nodeType: KnowledgeGraphNodeType = "SYMBOL";
      if (sym.kind === "FUNCTION") nodeType = "FUNCTION";
      else if (sym.kind === "CLASS") nodeType = "CLASS";
      else if (sym.kind === "INTERFACE") nodeType = "INTERFACE";
      else if (sym.kind === "TYPE_ALIAS") nodeType = "TYPE";
      else if (sym.kind === "MODULE") nodeType = "MODULE";

      const symKey = `sym:${sym.filePath}:${sym.name}`;
      const symNodeId = await insertNode(symKey, sym.name, nodeType, sym.filePath, sym.id, {
        kind: sym.kind,
        startLine: sym.startLine,
        isExported: sym.isExported,
      });

      symNameToNodeId.set(`${sym.filePath}:${sym.name}`, symNodeId);
      if (!symNameToNodeId.has(sym.name)) {
        symNameToNodeId.set(sym.name, symNodeId);
      }

      // Link file defines symbol
      const fileNodeId = nodeKeyToId.get(`file:${sym.filePath}`);
      if (fileNodeId) {
        await insertEdge(fileNodeId, symNodeId, "DEFINES");
      }
    }

    // 7. Create IMPORTS and DEPENDS_ON edges between files
    for (const dep of fileDeps) {
      const sourceFileNodeId = nodeKeyToId.get(`file:${dep.sourceFilePath}`);
      if (!sourceFileNodeId) continue;

      if (dep.isExternal) {
        const extKey = `ext:${dep.specifier}`;
        const extNodeId = await insertNode(extKey, dep.specifier, "EXTERNAL_DEPENDENCY", null, null);
        await insertEdge(sourceFileNodeId, extNodeId, "DEPENDS_ON");
      } else {
        const targetFileNodeId = nodeKeyToId.get(`file:${dep.targetFilePath}`);
        if (targetFileNodeId) {
          await insertEdge(sourceFileNodeId, targetFileNodeId, "IMPORTS", {
            specifier: dep.specifier,
            importedSymbols: dep.importedSymbols,
          });
        }
      }
    }

    // 8. Create CALLS, EXTENDS, IMPLEMENTS, REFERENCES edges
    for (const ref of refs) {
      const sourceFileNodeId = nodeKeyToId.get(`file:${ref.sourceFilePath}`);
      if (!sourceFileNodeId) continue;

      const targetSymNodeId = symNameToNodeId.get(ref.symbolName);
      if (!targetSymNodeId) continue;

      if (ref.kind === "CALL") {
        await insertEdge(sourceFileNodeId, targetSymNodeId, "CALLS", { line: ref.line });
      } else if (ref.kind === "HERITAGE_EXTENDS") {
        await insertEdge(sourceFileNodeId, targetSymNodeId, "EXTENDS", { line: ref.line });
      } else if (ref.kind === "HERITAGE_IMPLEMENTS") {
        await insertEdge(sourceFileNodeId, targetSymNodeId, "IMPLEMENTS", { line: ref.line });
      } else {
        await insertEdge(sourceFileNodeId, targetSymNodeId, "REFERENCES", { line: ref.line });
      }
    }

    // 9. Discover API Routes and link (ROUTES_TO)
    for (const file of files) {
      const content = file.content || "";
      if (file.path.includes("route") || file.path.includes("controller") || file.path.includes("api/")) {
        const routeRegex = /(?:router|app)\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/g;
        let rMatch: RegExpExecArray | null;
        while ((rMatch = routeRegex.exec(content)) !== null) {
          const method = rMatch[1].toUpperCase();
          const routePath = rMatch[2];
          const routeKey = `route:${method}:${routePath}`;
          const routeNodeId = await insertNode(routeKey, `${method} ${routePath}`, "API_ROUTE", file.path, null, {
            method,
            path: routePath,
          });

          const fileNodeId = nodeKeyToId.get(`file:${file.path}`);
          if (fileNodeId) {
            await insertEdge(routeNodeId, fileNodeId, "ROUTES_TO");
          }
        }
      }

      // 10. Discover Database Entities and link (QUERIES)
      if (file.path.endsWith("schema.prisma") || file.path.includes("entities") || file.path.includes("models")) {
        const modelRegex = /model\s+([A-Za-z_$][\w$]*)\s*\{/g;
        let mMatch: RegExpExecArray | null;
        while ((mMatch = modelRegex.exec(content)) !== null) {
          const entityName = mMatch[1];
          const dbKey = `db:${entityName}`;
          const dbNodeId = await insertNode(dbKey, entityName, "DATABASE_ENTITY", file.path, null);

          const fileNodeId = nodeKeyToId.get(`file:${file.path}`);
          if (fileNodeId) {
            await insertEdge(fileNodeId, dbNodeId, "DEFINES");
          }
        }
      }
    }

    // Calculate totals
    const nodesCountRes = await pgPool.query(
      `SELECT COUNT(*)::int AS count FROM forge_knowledge_graph_nodes WHERE "projectId" = $1`,
      [projectId]
    );
    const edgesCountRes = await pgPool.query(
      `SELECT COUNT(*)::int AS count FROM forge_knowledge_graph_edges WHERE "projectId" = $1`,
      [projectId]
    );

    return {
      projectId,
      nodesCount: nodesCountRes.rows[0]?.count || 0,
      edgesCount: edgesCountRes.rows[0]?.count || 0,
      durationMs: Date.now() - startTime,
      builtAt: new Date(),
    };
  }

  /**
   * Execute query on repository knowledge graph
   */
  async queryGraph(projectId: string, query: KnowledgeGraphQuery): Promise<GraphQueryResult> {
    // If graph has no nodes yet, build it automatically
    const countCheck = await pgPool.query(
      `SELECT COUNT(*)::int AS count FROM forge_knowledge_graph_nodes WHERE "projectId" = $1`,
      [projectId]
    );
    if ((countCheck.rows[0]?.count || 0) === 0) {
      await this.buildKnowledgeGraph(projectId);
    }

    switch (query.queryType) {
      case "WHAT_IMPORTS_FILE":
        return this.queryWhatImportsFile(projectId, query.target || "");
      case "WHAT_FILE_IMPORTS":
        return this.queryWhatFileImports(projectId, query.target || "");
      case "WHERE_SYMBOL_DEFINED":
        return this.queryWhereSymbolDefined(projectId, query.target || "");
      case "WHO_REFERENCES_SYMBOL":
        return this.queryWhoReferencesSymbol(projectId, query.target || "");
      case "WHO_CALLS_FUNCTION":
        return this.queryWhoCallsFunction(projectId, query.target || "");
      case "FILE_DEPENDENCIES":
        return this.queryFileDependencies(projectId, query.target || "", query.depth || 3);
      case "ROUTE_REACHABILITY":
        return this.queryRouteReachability(projectId, query.target || "");
      case "IMPACT_ANALYSIS":
        return this.queryImpactAnalysis(projectId, query.target || "");
      case "DEPENDENCY_CHAIN":
        return this.queryDependencyChain(projectId, query.sourceNodeKey || "", query.targetNodeKey || "");
      case "SUBGRAPH":
      default:
        return this.querySubgraph(projectId, query.target || "project:root", query.depth || 2);
    }
  }

  /**
   * Query: What files import target file?
   */
  private async queryWhatImportsFile(projectId: string, filePath: string): Promise<GraphQueryResult> {
    const fileKey = filePath.startsWith("file:") ? filePath : `file:${filePath}`;

    const res = await pgPool.query(
      `SELECT
         src.id as src_id, src."nodeKey" as src_key, src.name as src_name, src."nodeType" as src_type, src."filePath" as src_file,
         tgt.id as tgt_id, tgt."nodeKey" as tgt_key, tgt.name as tgt_name, tgt."nodeType" as tgt_type, tgt."filePath" as tgt_file,
         e.id as edge_id, e."edgeType", e.metadata as edge_meta
       FROM forge_knowledge_graph_edges e
       JOIN forge_knowledge_graph_nodes tgt ON e."targetNodeId" = tgt.id
       JOIN forge_knowledge_graph_nodes src ON e."sourceNodeId" = src.id
       WHERE e."projectId" = $1
         AND tgt."nodeKey" = $2
         AND e."edgeType" = 'IMPORTS'`,
      [projectId, fileKey]
    );

    const nodesMap = new Map<string, any>();
    const edges: any[] = [];

    for (const r of res.rows) {
      nodesMap.set(r.src_id, {
        id: r.src_id,
        projectId,
        nodeKey: r.src_key,
        name: r.src_name,
        nodeType: r.src_type,
        filePath: r.src_file,
      });
      nodesMap.set(r.tgt_id, {
        id: r.tgt_id,
        projectId,
        nodeKey: r.tgt_key,
        name: r.tgt_name,
        nodeType: r.tgt_type,
        filePath: r.tgt_file,
      });
      edges.push({
        id: r.edge_id,
        projectId,
        sourceNodeId: r.src_id,
        targetNodeId: r.tgt_id,
        edgeType: r.edgeType,
        metadata: r.edge_meta,
      });
    }

    return {
      queryType: "WHAT_IMPORTS_FILE",
      nodes: Array.from(nodesMap.values()),
      edges,
      summary: {
        totalNodes: nodesMap.size,
        totalEdges: edges.length,
        target: filePath,
        affectedFilesCount: res.rows.length,
      },
    };
  }

  /**
   * Query: What does target file import?
   */
  private async queryWhatFileImports(projectId: string, filePath: string): Promise<GraphQueryResult> {
    const fileKey = filePath.startsWith("file:") ? filePath : `file:${filePath}`;

    const res = await pgPool.query(
      `SELECT
         src.id as src_id, src."nodeKey" as src_key, src.name as src_name, src."nodeType" as src_type, src."filePath" as src_file,
         tgt.id as tgt_id, tgt."nodeKey" as tgt_key, tgt.name as tgt_name, tgt."nodeType" as tgt_type, tgt."filePath" as tgt_file,
         e.id as edge_id, e."edgeType", e.metadata as edge_meta
       FROM forge_knowledge_graph_edges e
       JOIN forge_knowledge_graph_nodes src ON e."sourceNodeId" = src.id
       JOIN forge_knowledge_graph_nodes tgt ON e."targetNodeId" = tgt.id
       WHERE e."projectId" = $1
         AND src."nodeKey" = $2
         AND e."edgeType" IN ('IMPORTS', 'DEPENDS_ON')`,
      [projectId, fileKey]
    );

    const nodesMap = new Map<string, any>();
    const edges: any[] = [];

    for (const r of res.rows) {
      nodesMap.set(r.src_id, {
        id: r.src_id,
        projectId,
        nodeKey: r.src_key,
        name: r.src_name,
        nodeType: r.src_type,
        filePath: r.src_file,
      });
      nodesMap.set(r.tgt_id, {
        id: r.tgt_id,
        projectId,
        nodeKey: r.tgt_key,
        name: r.tgt_name,
        nodeType: r.tgt_type,
        filePath: r.tgt_file,
      });
      edges.push({
        id: r.edge_id,
        projectId,
        sourceNodeId: r.src_id,
        targetNodeId: r.tgt_id,
        edgeType: r.edgeType,
        metadata: r.edge_meta,
      });
    }

    return {
      queryType: "WHAT_FILE_IMPORTS",
      nodes: Array.from(nodesMap.values()),
      edges,
      summary: {
        totalNodes: nodesMap.size,
        totalEdges: edges.length,
        target: filePath,
      },
    };
  }

  /**
   * Query: Where is this symbol defined?
   */
  private async queryWhereSymbolDefined(projectId: string, symbolName: string): Promise<GraphQueryResult> {
    const res = await pgPool.query(
      `SELECT
         sym.id as sym_id, sym."nodeKey" as sym_key, sym.name as sym_name, sym."nodeType" as sym_type, sym."filePath" as sym_file,
         f.id as f_id, f."nodeKey" as f_key, f.name as f_name, f."nodeType" as f_type, f."filePath" as f_file,
         e.id as edge_id, e."edgeType"
       FROM forge_knowledge_graph_nodes sym
       JOIN forge_knowledge_graph_edges e ON e."targetNodeId" = sym.id
       JOIN forge_knowledge_graph_nodes f ON e."sourceNodeId" = f.id
       WHERE sym."projectId" = $1
         AND sym.name = $2
         AND e."edgeType" = 'DEFINES'`,
      [projectId, symbolName]
    );

    const nodesMap = new Map<string, any>();
    const edges: any[] = [];

    for (const r of res.rows) {
      nodesMap.set(r.sym_id, {
        id: r.sym_id,
        projectId,
        nodeKey: r.sym_key,
        name: r.sym_name,
        nodeType: r.sym_type,
        filePath: r.sym_file,
      });
      nodesMap.set(r.f_id, {
        id: r.f_id,
        projectId,
        nodeKey: r.f_key,
        name: r.f_name,
        nodeType: r.f_type,
        filePath: r.f_file,
      });
      edges.push({
        id: r.edge_id,
        projectId,
        sourceNodeId: r.f_id,
        targetNodeId: r.sym_id,
        edgeType: r.edgeType,
      });
    }

    return {
      queryType: "WHERE_SYMBOL_DEFINED",
      nodes: Array.from(nodesMap.values()),
      edges,
      summary: {
        totalNodes: nodesMap.size,
        totalEdges: edges.length,
        target: symbolName,
      },
    };
  }

  /**
   * Query: Who references this symbol?
   */
  private async queryWhoReferencesSymbol(projectId: string, symbolName: string): Promise<GraphQueryResult> {
    const res = await pgPool.query(
      `SELECT
         src.id as src_id, src."nodeKey" as src_key, src.name as src_name, src."nodeType" as src_type, src."filePath" as src_file,
         sym.id as sym_id, sym."nodeKey" as sym_key, sym.name as sym_name, sym."nodeType" as sym_type, sym."filePath" as sym_file,
         e.id as edge_id, e."edgeType", e.metadata as edge_meta
       FROM forge_knowledge_graph_edges e
       JOIN forge_knowledge_graph_nodes sym ON e."targetNodeId" = sym.id
       JOIN forge_knowledge_graph_nodes src ON e."sourceNodeId" = src.id
       WHERE e."projectId" = $1
         AND sym.name = $2
         AND e."edgeType" IN ('REFERENCES', 'CALLS', 'EXTENDS', 'IMPLEMENTS')`,
      [projectId, symbolName]
    );

    const nodesMap = new Map<string, any>();
    const edges: any[] = [];

    for (const r of res.rows) {
      nodesMap.set(r.src_id, {
        id: r.src_id,
        projectId,
        nodeKey: r.src_key,
        name: r.src_name,
        nodeType: r.src_type,
        filePath: r.src_file,
      });
      nodesMap.set(r.sym_id, {
        id: r.sym_id,
        projectId,
        nodeKey: r.sym_key,
        name: r.sym_name,
        nodeType: r.sym_type,
        filePath: r.sym_file,
      });
      edges.push({
        id: r.edge_id,
        projectId,
        sourceNodeId: r.src_id,
        targetNodeId: r.sym_id,
        edgeType: r.edgeType,
        metadata: r.edge_meta,
      });
    }

    return {
      queryType: "WHO_REFERENCES_SYMBOL",
      nodes: Array.from(nodesMap.values()),
      edges,
      summary: {
        totalNodes: nodesMap.size,
        totalEdges: edges.length,
        target: symbolName,
        affectedFilesCount: res.rows.length,
      },
    };
  }

  /**
   * Query: Who calls this function?
   */
  private async queryWhoCallsFunction(projectId: string, fnName: string): Promise<GraphQueryResult> {
    const res = await pgPool.query(
      `SELECT
         src.id as src_id, src."nodeKey" as src_key, src.name as src_name, src."nodeType" as src_type, src."filePath" as src_file,
         sym.id as sym_id, sym."nodeKey" as sym_key, sym.name as sym_name, sym."nodeType" as sym_type, sym."filePath" as sym_file,
         e.id as edge_id, e."edgeType", e.metadata as edge_meta
       FROM forge_knowledge_graph_edges e
       JOIN forge_knowledge_graph_nodes sym ON e."targetNodeId" = sym.id
       JOIN forge_knowledge_graph_nodes src ON e."sourceNodeId" = src.id
       WHERE e."projectId" = $1
         AND sym.name = $2
         AND e."edgeType" = 'CALLS'`,
      [projectId, fnName]
    );

    const nodesMap = new Map<string, any>();
    const edges: any[] = [];

    for (const r of res.rows) {
      nodesMap.set(r.src_id, {
        id: r.src_id,
        projectId,
        nodeKey: r.src_key,
        name: r.src_name,
        nodeType: r.src_type,
        filePath: r.src_file,
      });
      nodesMap.set(r.sym_id, {
        id: r.sym_id,
        projectId,
        nodeKey: r.sym_key,
        name: r.sym_name,
        nodeType: r.sym_type,
        filePath: r.sym_file,
      });
      edges.push({
        id: r.edge_id,
        projectId,
        sourceNodeId: r.src_id,
        targetNodeId: r.sym_id,
        edgeType: r.edgeType,
        metadata: r.edge_meta,
      });
    }

    return {
      queryType: "WHO_CALLS_FUNCTION",
      nodes: Array.from(nodesMap.values()),
      edges,
      summary: {
        totalNodes: nodesMap.size,
        totalEdges: edges.length,
        target: fnName,
        affectedFilesCount: res.rows.length,
      },
    };
  }

  /**
   * Query: Transitive file dependencies
   */
  private async queryFileDependencies(projectId: string, filePath: string, maxDepth: number = 3): Promise<GraphQueryResult> {
    const rootKey = filePath.startsWith("file:") ? filePath : `file:${filePath}`;

    const rootRes = await pgPool.query(
      `SELECT * FROM forge_knowledge_graph_nodes WHERE "projectId" = $1 AND "nodeKey" = $2`,
      [projectId, rootKey]
    );

    if (rootRes.rows.length === 0) {
      return {
        queryType: "FILE_DEPENDENCIES",
        nodes: [],
        edges: [],
        summary: { totalNodes: 0, totalEdges: 0, target: filePath },
      };
    }

    const visitedNodeIds = new Set<string>([rootRes.rows[0].id]);
    const collectedNodes = new Map<string, any>([[rootRes.rows[0].id, rootRes.rows[0]]]);
    const collectedEdges: any[] = [];

    let currentLevel = [rootRes.rows[0].id];
    let depth = 0;

    while (currentLevel.length > 0 && depth < maxDepth) {
      depth++;
      const edgeRes = await pgPool.query(
        `SELECT e.*, tgt.*
         FROM forge_knowledge_graph_edges e
         JOIN forge_knowledge_graph_nodes tgt ON e."targetNodeId" = tgt.id
         WHERE e."projectId" = $1
           AND e."sourceNodeId" = ANY($2::uuid[])
           AND e."edgeType" IN ('IMPORTS', 'DEPENDS_ON')`,
        [projectId, currentLevel]
      );

      const nextLevel: string[] = [];
      for (const r of edgeRes.rows) {
        collectedEdges.push({
          id: r.id,
          projectId,
          sourceNodeId: r.sourceNodeId,
          targetNodeId: r.targetNodeId,
          edgeType: r.edgeType,
          metadata: r.metadata,
        });

        if (!visitedNodeIds.has(r.targetNodeId)) {
          visitedNodeIds.add(r.targetNodeId);
          collectedNodes.set(r.targetNodeId, {
            id: r.targetNodeId,
            projectId,
            nodeKey: r.nodeKey,
            name: r.name,
            nodeType: r.nodeType,
            filePath: r.filePath,
          });
          nextLevel.push(r.targetNodeId);
        }
      }

      currentLevel = nextLevel;
    }

    return {
      queryType: "FILE_DEPENDENCIES",
      nodes: Array.from(collectedNodes.values()),
      edges: collectedEdges,
      summary: {
        totalNodes: collectedNodes.size,
        totalEdges: collectedEdges.length,
        target: filePath,
        chainLength: depth,
      },
    };
  }

  /**
   * Query: Route reachability (Route -> File -> Database)
   */
  private async queryRouteReachability(projectId: string, routeTarget: string): Promise<GraphQueryResult> {
    const routeRes = await pgPool.query(
      `SELECT * FROM forge_knowledge_graph_nodes
       WHERE "projectId" = $1 AND "nodeType" = 'API_ROUTE' AND (name ILIKE $2 OR "nodeKey" ILIKE $2)`,
      [projectId, `%${routeTarget}%`]
    );

    if (routeRes.rows.length === 0) {
      return {
        queryType: "ROUTE_REACHABILITY",
        nodes: [],
        edges: [],
        summary: { totalNodes: 0, totalEdges: 0, target: routeTarget },
      };
    }

    const routeNode = routeRes.rows[0];
    const nodesMap = new Map<string, any>([[routeNode.id, routeNode]]);
    const edges: any[] = [];

    // Find outgoing edges from route to files
    const fileEdgeRes = await pgPool.query(
      `SELECT e.*, tgt.*
       FROM forge_knowledge_graph_edges e
       JOIN forge_knowledge_graph_nodes tgt ON e."targetNodeId" = tgt.id
       WHERE e."projectId" = $1 AND e."sourceNodeId" = $2`,
      [projectId, routeNode.id]
    );

    const fileNodeIds: string[] = [];
    for (const r of fileEdgeRes.rows) {
      fileNodeIds.push(r.targetNodeId);
      nodesMap.set(r.targetNodeId, {
        id: r.targetNodeId,
        projectId,
        nodeKey: r.nodeKey,
        name: r.name,
        nodeType: r.nodeType,
        filePath: r.filePath,
      });
      edges.push({
        id: r.id,
        projectId,
        sourceNodeId: r.sourceNodeId,
        targetNodeId: r.targetNodeId,
        edgeType: r.edgeType,
      });
    }

    // From file nodes, find DB entities or service calls
    if (fileNodeIds.length > 0) {
      const downstreamRes = await pgPool.query(
        `SELECT e.*, tgt.*
         FROM forge_knowledge_graph_edges e
         JOIN forge_knowledge_graph_nodes tgt ON e."targetNodeId" = tgt.id
         WHERE e."projectId" = $1 AND e."sourceNodeId" = ANY($2::uuid[])`,
        [projectId, fileNodeIds]
      );

      for (const r of downstreamRes.rows) {
        nodesMap.set(r.targetNodeId, {
          id: r.targetNodeId,
          projectId,
          nodeKey: r.nodeKey,
          name: r.name,
          nodeType: r.nodeType,
          filePath: r.filePath,
        });
        edges.push({
          id: r.id,
          projectId,
          sourceNodeId: r.sourceNodeId,
          targetNodeId: r.targetNodeId,
          edgeType: r.edgeType,
        });
      }
    }

    return {
      queryType: "ROUTE_REACHABILITY",
      nodes: Array.from(nodesMap.values()),
      edges,
      summary: {
        totalNodes: nodesMap.size,
        totalEdges: edges.length,
        target: routeTarget,
        pathFound: edges.length > 0,
      },
    };
  }

  /**
   * Query: Impact analysis (transitive reverse dependents / blast radius)
   */
  private async queryImpactAnalysis(projectId: string, targetIdentifier: string): Promise<GraphQueryResult> {
    const rootRes = await pgPool.query(
      `SELECT * FROM forge_knowledge_graph_nodes
       WHERE "projectId" = $1 AND ("nodeKey" = $2 OR name = $2 OR "filePath" = $2)`,
      [projectId, targetIdentifier.startsWith("file:") ? targetIdentifier : `file:${targetIdentifier}`]
    );

    if (rootRes.rows.length === 0) {
      return {
        queryType: "IMPACT_ANALYSIS",
        nodes: [],
        edges: [],
        summary: { totalNodes: 0, totalEdges: 0, target: targetIdentifier },
      };
    }

    const rootNode = rootRes.rows[0];
    const visited = new Set<string>([rootNode.id]);
    const collectedNodes = new Map<string, any>([[rootNode.id, rootNode]]);
    const collectedEdges: any[] = [];

    let currentLevel = [rootNode.id];
    let depth = 0;

    // Traverse reverse incoming edges (who depends on / calls / imports this node)
    while (currentLevel.length > 0 && depth < 5) {
      depth++;
      const edgeRes = await pgPool.query(
        `SELECT e.*, src.*
         FROM forge_knowledge_graph_edges e
         JOIN forge_knowledge_graph_nodes src ON e."sourceNodeId" = src.id
         WHERE e."projectId" = $1 AND e."targetNodeId" = ANY($2::uuid[])`,
        [projectId, currentLevel]
      );

      const nextLevel: string[] = [];
      for (const r of edgeRes.rows) {
        collectedEdges.push({
          id: r.id,
          projectId,
          sourceNodeId: r.sourceNodeId,
          targetNodeId: r.targetNodeId,
          edgeType: r.edgeType,
        });

        if (!visited.has(r.sourceNodeId)) {
          visited.add(r.sourceNodeId);
          collectedNodes.set(r.sourceNodeId, {
            id: r.sourceNodeId,
            projectId,
            nodeKey: r.nodeKey,
            name: r.name,
            nodeType: r.nodeType,
            filePath: r.filePath,
          });
          nextLevel.push(r.sourceNodeId);
        }
      }

      currentLevel = nextLevel;
    }

    const affectedFiles = new Set<string>();
    const affectedSymbols = new Set<string>();

    for (const node of collectedNodes.values()) {
      if (node.nodeType === "FILE" && node.filePath) affectedFiles.add(node.filePath);
      if (["FUNCTION", "CLASS", "INTERFACE", "TYPE", "SYMBOL"].includes(node.nodeType)) {
        affectedSymbols.add(node.name);
      }
    }

    return {
      queryType: "IMPACT_ANALYSIS",
      nodes: Array.from(collectedNodes.values()),
      edges: collectedEdges,
      summary: {
        totalNodes: collectedNodes.size,
        totalEdges: collectedEdges.length,
        target: targetIdentifier,
        affectedFilesCount: affectedFiles.size,
        affectedSymbolsCount: affectedSymbols.size,
      },
      details: {
        affectedFiles: Array.from(affectedFiles),
        affectedSymbols: Array.from(affectedSymbols),
      },
    };
  }

  /**
   * Query: Shortest dependency chain between source and target
   */
  private async queryDependencyChain(
    projectId: string,
    sourceKey: string,
    targetKey: string
  ): Promise<GraphQueryResult> {
    const srcRes = await pgPool.query(
      `SELECT * FROM forge_knowledge_graph_nodes WHERE "projectId" = $1 AND ("nodeKey" = $2 OR name = $2)`,
      [projectId, sourceKey]
    );
    const tgtRes = await pgPool.query(
      `SELECT * FROM forge_knowledge_graph_nodes WHERE "projectId" = $1 AND ("nodeKey" = $2 OR name = $2)`,
      [projectId, targetKey]
    );

    if (srcRes.rows.length === 0 || tgtRes.rows.length === 0) {
      return {
        queryType: "DEPENDENCY_CHAIN",
        nodes: [],
        edges: [],
        summary: { totalNodes: 0, totalEdges: 0, pathFound: false },
      };
    }

    const srcNode = srcRes.rows[0];
    const tgtNode = tgtRes.rows[0];

    // BFS shortest path
    const queue: Array<{ nodeId: string; path: string[]; edgePath: any[] }> = [
      { nodeId: srcNode.id, path: [srcNode.id], edgePath: [] },
    ];
    const visited = new Set<string>([srcNode.id]);

    let foundPath: string[] | null = null;
    let foundEdges: any[] | null = null;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.nodeId === tgtNode.id) {
        foundPath = current.path;
        foundEdges = current.edgePath;
        break;
      }

      const outEdges = await pgPool.query(
        `SELECT * FROM forge_knowledge_graph_edges WHERE "projectId" = $1 AND "sourceNodeId" = $2`,
        [projectId, current.nodeId]
      );

      for (const e of outEdges.rows) {
        if (!visited.has(e.targetNodeId)) {
          visited.add(e.targetNodeId);
          queue.push({
            nodeId: e.targetNodeId,
            path: [...current.path, e.targetNodeId],
            edgePath: [...current.edgePath, e],
          });
        }
      }
    }

    if (!foundPath || !foundEdges) {
      return {
        queryType: "DEPENDENCY_CHAIN",
        nodes: [srcNode, tgtNode],
        edges: [],
        summary: { totalNodes: 2, totalEdges: 0, pathFound: false },
      };
    }

    const nodeDetails = await pgPool.query(
      `SELECT * FROM forge_knowledge_graph_nodes WHERE id = ANY($1::uuid[])`,
      [foundPath]
    );

    return {
      queryType: "DEPENDENCY_CHAIN",
      nodes: nodeDetails.rows,
      edges: foundEdges,
      summary: {
        totalNodes: nodeDetails.rows.length,
        totalEdges: foundEdges.length,
        pathFound: true,
        chainLength: foundEdges.length,
      },
    };
  }

  /**
   * Query: Subgraph around target node
   */
  private async querySubgraph(
    projectId: string,
    targetKey: string = "project:root",
    depth: number = 2
  ): Promise<GraphQueryResult> {
    const rootRes = await pgPool.query(
      `SELECT * FROM forge_knowledge_graph_nodes WHERE "projectId" = $1 AND ("nodeKey" = $2 OR name = $2) LIMIT 1`,
      [projectId, targetKey]
    );

    if (rootRes.rows.length === 0) {
      const allRes = await pgPool.query(
        `SELECT * FROM forge_knowledge_graph_nodes WHERE "projectId" = $1 LIMIT 50`,
        [projectId]
      );
      return {
        queryType: "SUBGRAPH",
        nodes: allRes.rows,
        edges: [],
        summary: { totalNodes: allRes.rows.length, totalEdges: 0 },
      };
    }

    const rootNode = rootRes.rows[0];
    const visited = new Set<string>([rootNode.id]);
    const nodesMap = new Map<string, any>([[rootNode.id, rootNode]]);
    const edges: any[] = [];

    let currentLevel = [rootNode.id];
    let d = 0;

    while (currentLevel.length > 0 && d < depth) {
      d++;
      const edgeRes = await pgPool.query(
        `SELECT e.*, tgt.*
         FROM forge_knowledge_graph_edges e
         JOIN forge_knowledge_graph_nodes tgt ON e."targetNodeId" = tgt.id
         WHERE e."projectId" = $1 AND e."sourceNodeId" = ANY($2::uuid[])`,
        [projectId, currentLevel]
      );

      const nextLevel: string[] = [];
      for (const r of edgeRes.rows) {
        edges.push({
          id: r.id,
          projectId,
          sourceNodeId: r.sourceNodeId,
          targetNodeId: r.targetNodeId,
          edgeType: r.edgeType,
        });

        if (!visited.has(r.targetNodeId)) {
          visited.add(r.targetNodeId);
          nodesMap.set(r.targetNodeId, {
            id: r.targetNodeId,
            projectId,
            nodeKey: r.nodeKey,
            name: r.name,
            nodeType: r.nodeType,
            filePath: r.filePath,
          });
          nextLevel.push(r.targetNodeId);
        }
      }

      currentLevel = nextLevel;
    }

    return {
      queryType: "SUBGRAPH",
      nodes: Array.from(nodesMap.values()),
      edges,
      summary: { totalNodes: nodesMap.size, totalEdges: edges.length },
    };
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();
