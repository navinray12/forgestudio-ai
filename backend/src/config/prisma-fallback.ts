import { pgPool as defaultPool } from "./prisma.js";

let activePool: any = null;

export function setFallbackPool(pool: any) {
  activePool = pool;
}

function getPool() {
  return activePool || defaultPool;
}

const MODEL_TO_TABLE: Record<string, string> = {
  supportTicket: "support_tickets",
  supportCategory: "support_categories",
  supportTeam: "support_teams",
  supportTeamMember: "support_team_members",
  supportSlaPolicy: "support_sla_policies",
  supportTicketMessage: "support_ticket_messages",
  supportTicketAttachment: "support_ticket_attachments",
  supportTicketEvent: "support_ticket_events",
  supportCannedResponse: "support_canned_responses",
  supportSavedView: "support_saved_views",
  supportTag: "support_tags",
  forumCategory: "forum_categories",
  forumTopic: "forum_topics",
  forumPost: "forum_posts",
  forumTopicFollower: "forum_topic_followers",
  forumReaction: "forum_reactions",
  forumBookmark: "forum_bookmarks",
  forumReport: "forum_reports",
  forgeProject: "forge_projects",
  forgeProjectFile: "forge_project_files",
  forgeProjectRevision: "forge_project_revisions",
  forgeProjectSnapshot: "forge_project_snapshots",
  forgeWorkspaceState: "forge_workspace_states",
  forgeRuntimeSession: "forge_runtime_sessions",
  forgeBuildRecord: "forge_build_records",
  forgeBuildArtifact: "forge_build_artifacts",
  forgePreviewSession: "forge_preview_sessions",
  forgeTerminalSession: "forge_terminal_sessions",
  forgeDebugSession: "forge_debug_sessions",
  forgeExecutionAudit: "forge_execution_audits",
  forgeDeployment: "forge_deployments",
  forgeCicdPipeline: "forge_cicd_pipelines",
  forgeCustomDomain: "forge_custom_domains",
  forgeGitRepository: "forge_git_repositories",
  forgeGitCommit: "forge_git_commits",
  forgeGitBranch: "forge_git_branches",
  forgeGitStash: "forge_git_stashes",
  forgeGitTag: "forge_git_tags",
  forgeGithubConnection: "forge_github_connections",
  forgeGithubPullRequest: "forge_github_pull_requests",
  forgeCliSession: "forge_cli_sessions",
  forgeAiProvider: "forge_ai_providers",
  forgeAiRequest: "forge_ai_requests",
  forgeAiToolExecution: "forge_ai_tool_executions",
  forgeAiAgentSession: "forge_ai_agent_sessions",
  forgeAiAgentPlan: "forge_ai_agent_plans",
  forgeAiCheckpoint: "forge_ai_checkpoints",
  forgeMcpServer: "forge_mcp_servers",
  forgeMcpExecution: "forge_mcp_executions",
};

function quoteCol(col: string): string {
  // If column is already quoted or has function, don't double quote
  if (col.startsWith('"') || col.includes("(") || col.includes(".")) return col;
  return `"${col}"`;
}

function buildWhereClause(where: Record<string, any> | undefined, params: any[]): string {
  if (!where || Object.keys(where).length === 0) return "";
  const clauses: string[] = [];

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;

    if (key === "OR" && Array.isArray(value)) {
      const orClauses: string[] = [];
      for (const item of value) {
        // Special case: nested relation queries like { user: { email: { contains: q } } }
        if (item.user) {
          const q = item.user.email?.contains || item.user.fullName?.contains;
          if (q) {
            params.push(`%${q}%`);
            const pIdx = params.length;
            orClauses.push(
              `EXISTS (SELECT 1 FROM users u WHERE u.id = support_tickets."userId" AND (u.email ILIKE $${pIdx} OR u."fullName" ILIKE $${pIdx}))`
            );
          }
          continue;
        }
        if (item.website) {
          const q = item.website.name?.contains;
          if (q) {
            params.push(`%${q}%`);
            const pIdx = params.length;
            orClauses.push(
              `EXISTS (SELECT 1 FROM websites w WHERE w.id = support_tickets."websiteId" AND w.name ILIKE $${pIdx})`
            );
          }
          continue;
        }

        const sub = buildWhereClause(item, params);
        if (sub) orClauses.push(sub.replace(/^WHERE\s+/, ""));
      }
      if (orClauses.length > 0) {
        clauses.push(`(${orClauses.join(" OR ")})`);
      }
      continue;
    }

    if (key === "AND" && Array.isArray(value)) {
      const andClauses: string[] = [];
      for (const item of value) {
        const sub = buildWhereClause(item, params);
        if (sub) andClauses.push(sub.replace(/^WHERE\s+/, ""));
      }
      if (andClauses.length > 0) {
        clauses.push(`(${andClauses.join(" AND ")})`);
      }
      continue;
    }

    const col = quoteCol(key);

    if (value === null) {
      clauses.push(`${col} IS NULL`);
    } else if (typeof value === "object" && !(value instanceof Date)) {
      if ("in" in value && Array.isArray(value.in)) {
        params.push(value.in);
        clauses.push(`${col} = ANY($${params.length})`);
      } else if ("notIn" in value && Array.isArray(value.notIn)) {
        params.push(value.notIn);
        clauses.push(`${col} != ALL($${params.length})`);
      } else if ("not" in value) {
        if (value.not === null) {
          clauses.push(`${col} IS NOT NULL`);
        } else {
          params.push(value.not);
          clauses.push(`${col} != $${params.length}`);
        }
      } else if ("contains" in value) {
        params.push(`%${value.contains}%`);
        clauses.push(`${col} ILIKE $${params.length}`);
      } else if ("gte" in value || "lte" in value || "gt" in value || "lt" in value) {
        if ("gte" in value) {
          params.push(value.gte);
          clauses.push(`${col} >= $${params.length}`);
        }
        if ("lte" in value) {
          params.push(value.lte);
          clauses.push(`${col} <= $${params.length}`);
        }
        if ("gt" in value) {
          params.push(value.gt);
          clauses.push(`${col} > $${params.length}`);
        }
        if ("lt" in value) {
          params.push(value.lt);
          clauses.push(`${col} < $${params.length}`);
        }
      } else {
        // Fallback for nested keys (e.g. composite keys)
        for (const [subK, subV] of Object.entries(value)) {
          params.push(subV);
          clauses.push(`${quoteCol(subK)} = $${params.length}`);
        }
      }
    } else {
      params.push(value);
      clauses.push(`${col} = $${params.length}`);
    }
  }

  return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
}

function buildOrderBy(orderBy: any): string {
  if (!orderBy) return "";
  const parts: string[] = [];
  const list = Array.isArray(orderBy) ? orderBy : [orderBy];

  for (const item of list) {
    if (typeof item === "object") {
      for (const [col, dir] of Object.entries(item)) {
        const direction = String(dir).toUpperCase() === "ASC" ? "ASC" : "DESC";
        parts.push(`${quoteCol(col)} ${direction}`);
      }
    }
  }

  return parts.length > 0 ? `ORDER BY ${parts.join(", ")}` : "";
}

async function hydrateTickets(tickets: any[], include: any) {
  if (!tickets.length || !include) return tickets;

  const ticketIds = tickets.map((t) => t.id);

  // 1. Users
  if (include.user) {
    const userIds = [...new Set(tickets.map((t) => t.userId).filter(Boolean))];
    if (userIds.length > 0) {
      const { rows } = await getPool().query(
        `SELECT id, "fullName", email, role FROM users WHERE id = ANY($1)`,
        [userIds]
      );
      const userMap = new Map(rows.map((u: any) => [u.id, u]));
      for (const t of tickets) {
        t.user = userMap.get(t.userId) || null;
      }
    } else {
      for (const t of tickets) t.user = null;
    }
  }

  // 2. Assigned Agent
  if (include.assignedAgent) {
    const agentIds = [...new Set(tickets.map((t) => t.assignedAgentId).filter(Boolean))];
    if (agentIds.length > 0) {
      const { rows } = await getPool().query(
        `SELECT id, "fullName", email, role FROM users WHERE id = ANY($1)`,
        [agentIds]
      );
      const agentMap = new Map(rows.map((u: any) => [u.id, u]));
      for (const t of tickets) {
        t.assignedAgent = t.assignedAgentId ? agentMap.get(t.assignedAgentId) || null : null;
      }
    } else {
      for (const t of tickets) t.assignedAgent = null;
    }
  }

  // 3. Assigned Team
  if (include.assignedTeam) {
    const teamIds = [...new Set(tickets.map((t) => t.assignedTeamId).filter(Boolean))];
    if (teamIds.length > 0) {
      const { rows } = await getPool().query(
        `SELECT id, name FROM support_teams WHERE id = ANY($1)`,
        [teamIds]
      );
      const teamMap = new Map(rows.map((team: any) => [team.id, team]));
      for (const t of tickets) {
        t.assignedTeam = t.assignedTeamId ? teamMap.get(t.assignedTeamId) || null : null;
      }
    } else {
      for (const t of tickets) t.assignedTeam = null;
    }
  }

  // 4. Category
  if (include.category) {
    const catIds = [...new Set(tickets.map((t) => t.categoryId).filter(Boolean))];
    if (catIds.length > 0) {
      const { rows } = await getPool().query(
        `SELECT id, name, slug, color, icon FROM support_categories WHERE id = ANY($1)`,
        [catIds]
      );
      const catMap = new Map(rows.map((c: any) => [c.id, c]));
      for (const t of tickets) {
        t.category = catMap.get(t.categoryId) || null;
      }
    } else {
      for (const t of tickets) t.category = null;
    }
  }

  // 5. Website
  if (include.website) {
    const siteIds = [...new Set(tickets.map((t) => t.websiteId).filter(Boolean))];
    if (siteIds.length > 0) {
      const { rows } = await getPool().query(
        `SELECT id, name, slug FROM websites WHERE id = ANY($1)`,
        [siteIds]
      );
      const siteMap = new Map(rows.map((s: any) => [s.id, s]));
      for (const t of tickets) {
        t.website = t.websiteId ? siteMap.get(t.websiteId) || null : null;
      }
    } else {
      for (const t of tickets) t.website = null;
    }
  }

  // 6. Workspace
  if (include.workspace) {
    const wsIds = [...new Set(tickets.map((t) => t.workspaceId).filter(Boolean))];
    if (wsIds.length > 0) {
      const { rows } = await getPool().query(
        `SELECT id, name, slug FROM workspaces WHERE id = ANY($1)`,
        [wsIds]
      );
      const wsMap = new Map(rows.map((w: any) => [w.id, w]));
      for (const t of tickets) {
        t.workspace = t.workspaceId ? wsMap.get(t.workspaceId) || null : null;
      }
    } else {
      for (const t of tickets) t.workspace = null;
    }
  }

  // 7. _count
  if (include._count) {
    const msgCountRes = await getPool().query(
      `SELECT "ticketId", count(*)::int as count FROM support_ticket_messages WHERE "ticketId" = ANY($1) GROUP BY "ticketId"`,
      [ticketIds]
    );
    const msgCountMap = new Map(msgCountRes.rows.map((r: any) => [r.ticketId, r.count]));

    const attCountRes = await getPool().query(
      `SELECT "ticketId", count(*)::int as count FROM support_ticket_attachments WHERE "ticketId" = ANY($1) GROUP BY "ticketId"`,
      [ticketIds]
    );
    const attCountMap = new Map(attCountRes.rows.map((r: any) => [r.ticketId, r.count]));

    for (const t of tickets) {
      t._count = {
        messages: msgCountMap.get(t.id) || 0,
        attachments: attCountMap.get(t.id) || 0,
      };
    }
  }

  // 8. Messages
  if (include.messages) {
    const msgWhereParts = [`"ticketId" = ANY($1)`];
    const msgParams: any[] = [ticketIds];
    if (include.messages.where?.type) {
      msgParams.push(include.messages.where.type);
      msgWhereParts.push(`type = $${msgParams.length}`);
    }

    const { rows: msgs } = await getPool().query(
      `SELECT * FROM support_ticket_messages WHERE ${msgWhereParts.join(" AND ")} ORDER BY "createdAt" ASC`,
      msgParams
    );

    // Hydrate author and attachments for messages
    const authorIds = [...new Set(msgs.map((m: any) => m.authorId).filter(Boolean))];
    let authorMap = new Map();
    if (authorIds.length > 0) {
      const { rows: authors } = await getPool().query(
        `SELECT id, "fullName", email, role FROM users WHERE id = ANY($1)`,
        [authorIds]
      );
      authorMap = new Map(authors.map((a: any) => [a.id, a]));
    }

    const msgIds = msgs.map((m: any) => m.id);
    let attMap = new Map();
    if (msgIds.length > 0) {
      const { rows: atts } = await getPool().query(
        `SELECT * FROM support_ticket_attachments WHERE "messageId" = ANY($1)`,
        [msgIds]
      );
      for (const a of atts) {
        if (!attMap.has(a.messageId)) attMap.set(a.messageId, []);
        attMap.get(a.messageId).push(a);
      }
    }

    const msgsByTicket = new Map<string, any[]>();
    for (const m of msgs) {
      m.author = authorMap.get(m.authorId) || null;
      m.attachments = attMap.get(m.id) || [];
      if (!msgsByTicket.has(m.ticketId)) msgsByTicket.set(m.ticketId, []);
      msgsByTicket.get(m.ticketId)!.push(m);
    }

    for (const t of tickets) {
      t.messages = msgsByTicket.get(t.id) || [];
    }
  }

  // 9. Attachments
  if (include.attachments) {
    const { rows: atts } = await getPool().query(
      `SELECT * FROM support_ticket_attachments WHERE "ticketId" = ANY($1) ORDER BY "createdAt" ASC`,
      [ticketIds]
    );
    const attsByTicket = new Map<string, any[]>();
    for (const a of atts) {
      if (!attsByTicket.has(a.ticketId)) attsByTicket.set(a.ticketId, []);
      attsByTicket.get(a.ticketId)!.push(a);
    }
    for (const t of tickets) {
      t.attachments = attsByTicket.get(t.id) || [];
    }
  }

  // 10. Events
  if (include.events) {
    const { rows: events } = await getPool().query(
      `SELECT * FROM support_ticket_events WHERE "ticketId" = ANY($1) ORDER BY "createdAt" ASC`,
      [ticketIds]
    );
    const actorIds = [...new Set(events.map((e: any) => e.actorId).filter(Boolean))];
    let actorMap = new Map();
    if (actorIds.length > 0) {
      const { rows: actors } = await getPool().query(
        `SELECT id, "fullName", role FROM users WHERE id = ANY($1)`,
        [actorIds]
      );
      actorMap = new Map(actors.map((a: any) => [a.id, a]));
    }
    const eventsByTicket = new Map<string, any[]>();
    for (const e of events) {
      e.actor = actorMap.get(e.actorId) || null;
      if (!eventsByTicket.has(e.ticketId)) eventsByTicket.set(e.ticketId, []);
      eventsByTicket.get(e.ticketId)!.push(e);
    }
    for (const t of tickets) {
      t.events = eventsByTicket.get(t.id) || [];
    }
  }

  return tickets;
}

async function hydrateTeams(teams: any[], include: any) {
  if (!teams.length || !include) return teams;
  const teamIds = teams.map((t) => t.id);

  if (include.members) {
    const { rows: members } = await getPool().query(
      `SELECT * FROM support_team_members WHERE "teamId" = ANY($1)`,
      [teamIds]
    );
    const userIds = members.map((m: any) => m.userId);
    let userMap = new Map();
    if (userIds.length > 0) {
      const { rows: users } = await getPool().query(
        `SELECT id, "fullName", email FROM users WHERE id = ANY($1)`,
        [userIds]
      );
      userMap = new Map(users.map((u: any) => [u.id, u]));
    }
    const membersByTeam = new Map<string, any[]>();
    for (const m of members) {
      m.user = userMap.get(m.userId) || null;
      if (!membersByTeam.has(m.teamId)) membersByTeam.set(m.teamId, []);
      membersByTeam.get(m.teamId)!.push(m);
    }
    for (const team of teams) {
      team.members = membersByTeam.get(team.id) || [];
    }
  }

  if (include._count) {
    const memCountRes = await getPool().query(
      `SELECT "teamId", count(*)::int as count FROM support_team_members WHERE "teamId" = ANY($1) GROUP BY "teamId"`,
      [teamIds]
    );
    const memCountMap = new Map(memCountRes.rows.map((r: any) => [r.teamId, r.count]));

    const ticketCountRes = await getPool().query(
      `SELECT "assignedTeamId", count(*)::int as count FROM support_tickets WHERE "assignedTeamId" = ANY($1) GROUP BY "assignedTeamId"`,
      [teamIds]
    );
    const ticketCountMap = new Map(ticketCountRes.rows.map((r: any) => [r.assignedTeamId, r.count]));

    for (const team of teams) {
      team._count = {
        members: memCountMap.get(team.id) || 0,
        tickets: ticketCountMap.get(team.id) || 0,
      };
    }
  }

  return teams;
}

export function createFallbackModelDelegate(modelName: string) {
  const table = MODEL_TO_TABLE[modelName];
  if (!table) return undefined;

  return {
    async count(args?: { where?: any }): Promise<number> {
      const params: any[] = [];
      const whereClause = buildWhereClause(args?.where, params);
      const sql = `SELECT count(*)::int as count FROM ${table} ${whereClause}`;
      const { rows } = await getPool().query(sql, params);
      return rows[0]?.count ?? 0;
    },

    async findMany(args?: {
      where?: any;
      orderBy?: any;
      skip?: number;
      take?: number;
      include?: any;
      select?: any;
    }): Promise<any[]> {
      const params: any[] = [];
      const whereClause = buildWhereClause(args?.where, params);
      const orderByClause = buildOrderBy(args?.orderBy);

      let pagination = "";
      if (args?.take !== undefined) {
        params.push(args.take);
        pagination += ` LIMIT $${params.length}`;
      }
      if (args?.skip !== undefined) {
        params.push(args.skip);
        pagination += ` OFFSET $${params.length}`;
      }

      let selectCols = "*";
      if (args?.select) {
        const cols = Object.keys(args.select).filter((k) => args.select[k] === true);
        if (cols.length > 0) selectCols = cols.map(quoteCol).join(", ");
      }

      const sql = `SELECT ${selectCols} FROM ${table} ${whereClause} ${orderByClause} ${pagination}`;
      const { rows } = await getPool().query(sql, params);

      if (table === "support_tickets") {
        await hydrateTickets(rows, args?.include);
      } else if (table === "support_teams") {
        await hydrateTeams(rows, args?.include);
      }

      return rows;
    },

    async findUnique(args: { where: any; include?: any; select?: any }): Promise<any | null> {
      const params: any[] = [];
      const whereClause = buildWhereClause(args.where, params);

      let selectCols = "*";
      if (args?.select) {
        const cols = Object.keys(args.select).filter((k) => args.select[k] === true);
        if (cols.length > 0) selectCols = cols.map(quoteCol).join(", ");
      }

      const sql = `SELECT ${selectCols} FROM ${table} ${whereClause} LIMIT 1`;
      const { rows } = await getPool().query(sql, params);
      if (!rows.length) return null;

      const record = rows[0];
      if (table === "support_tickets") {
        await hydrateTickets([record], args?.include);
      } else if (table === "support_teams") {
        await hydrateTeams([record], args?.include);
      } else if (table === "support_ticket_messages" && args?.include?.author) {
        const u = await getPool().query(`SELECT id, "fullName", email, role FROM users WHERE id = $1`, [
          record.authorId,
        ]);
        record.author = u.rows[0] || null;
      }
      return record;
    },

    async findFirst(args?: { where?: any; include?: any; select?: any; orderBy?: any }): Promise<any | null> {
      const params: any[] = [];
      const whereClause = buildWhereClause(args?.where, params);
      const orderByClause = buildOrderBy(args?.orderBy);

      let selectCols = "*";
      if (args?.select) {
        const cols = Object.keys(args.select).filter((k) => args.select[k] === true);
        if (cols.length > 0) selectCols = cols.map(quoteCol).join(", ");
      }

      const sql = `SELECT ${selectCols} FROM ${table} ${whereClause} ${orderByClause} LIMIT 1`;
      const { rows } = await getPool().query(sql, params);
      if (!rows.length) return null;

      const record = rows[0];
      if (table === "support_tickets") {
        await hydrateTickets([record], args?.include);
      }
      return record;
    },

    async create(args: { data: any; include?: any }): Promise<any> {
      const cols: string[] = [];
      const placeholders: string[] = [];
      const values: any[] = [];

      for (const [key, val] of Object.entries(args.data)) {
        if (val === undefined) continue;
        cols.push(quoteCol(key));
        values.push(
          typeof val === "object" && val !== null && !(val instanceof Date) && !Array.isArray(val)
            ? JSON.stringify(val)
            : val
        );
        placeholders.push(`$${values.length}`);
      }

      const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`;
      const { rows } = await getPool().query(sql, values);
      const record = rows[0];

      if (table === "support_tickets") {
        await hydrateTickets([record], args?.include);
      } else if (table === "support_ticket_messages" && args?.include?.author) {
        const u = await getPool().query(`SELECT id, "fullName", email, role FROM users WHERE id = $1`, [
          record.authorId,
        ]);
        record.author = u.rows[0] || null;
      }

      return record;
    },

    async update(args: { where: any; data: any; include?: any }): Promise<any> {
      const setParts: string[] = [];
      const values: any[] = [];

      for (const [key, val] of Object.entries(args.data)) {
        if (val === undefined) continue;
        values.push(
          typeof val === "object" && val !== null && !(val instanceof Date) && !Array.isArray(val)
            ? JSON.stringify(val)
            : val
        );
        setParts.push(`${quoteCol(key)} = $${values.length}`);
      }

      // Add updatedAt if table supports it
      setParts.push(`"updatedAt" = now()`);

      const whereClause = buildWhereClause(args.where, values);
      const sql = `UPDATE ${table} SET ${setParts.join(", ")} ${whereClause} RETURNING *`;
      const { rows } = await getPool().query(sql, values);
      const record = rows[0];

      if (table === "support_tickets") {
        await hydrateTickets([record], args?.include);
      }
      return record;
    },

    async delete(args: { where: any }): Promise<any> {
      const params: any[] = [];
      const whereClause = buildWhereClause(args.where, params);
      const sql = `DELETE FROM ${table} ${whereClause} RETURNING *`;
      const { rows } = await getPool().query(sql, params);
      return rows[0] || null;
    },

    async groupBy(args: { by: string[]; where?: any; _count?: Record<string, boolean> }): Promise<any[]> {
      const byCol = args.by[0];
      const params: any[] = [];
      const whereClause = buildWhereClause(args.where, params);
      const sql = `SELECT ${quoteCol(byCol)}, count(*)::int as count FROM ${table} ${whereClause} GROUP BY ${quoteCol(byCol)}`;
      const { rows } = await getPool().query(sql, params);
      return rows.map((r: any) => ({
        [byCol]: r[byCol],
        _count: { [byCol]: r.count },
      }));
    },
  };
}

export function isDynamicFallbackModel(modelName: string): boolean {
  return modelName in MODEL_TO_TABLE;
}
