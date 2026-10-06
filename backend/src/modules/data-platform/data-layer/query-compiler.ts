import { AppError } from "../../../utils/app-error.js";

/**
 * Validates a SQL identifier (table or column name).
 * Strict defense against SQL injection: allows only alphanumeric characters and underscores.
 * Max identifier length in PostgreSQL is 63 characters.
 */
export function validateIdentifier(name: string): string {
  if (!name || typeof name !== "string") {
    throw new AppError(
      "Invalid SQL identifier: must be a non-empty string",
      400,
      "INVALID_IDENTIFIER"
    );
  }
  const trimmed = name.trim();
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    throw new AppError(
      `Invalid SQL identifier "${name}". Only alphanumeric characters and underscores are allowed.`,
      400,
      "INVALID_IDENTIFIER"
    );
  }
  return trimmed.slice(0, 63);
}

export interface CompiledQuery {
  sql: string;
  values: any[];
  countSql?: string;
}

const RESERVED_PARAMS = new Set([
  "select",
  "order",
  "limit",
  "offset",
  "page",
  "apiKey",
  "apikey",
  "environment",
  "env",
]);

interface FilterCondition {
  column: string;
  operatorSql: string;
  value?: any;
  hasParam: boolean;
}

/**
 * Parses PostgREST-style filter string or plain value:
 * - eq.val     -> = $i
 * - neq.val    -> <> $i
 * - gt.val     -> > $i
 * - gte.val    -> >= $i
 * - lt.val     -> < $i
 * - lte.val    -> <= $i
 * - like.val   -> LIKE $i
 * - ilike.val  -> ILIKE $i
 * - is.null    -> IS NULL
 * - is.notnull -> IS NOT NULL
 * - in.(a,b,c) -> = ANY($i)
 * - plain_val  -> = $i (fallback)
 */
function parseOperator(rawVal: any): { operatorSql: string; value?: any; hasParam: boolean } {
  if (rawVal === null || rawVal === undefined) {
    return { operatorSql: "IS NULL", hasParam: false };
  }

  const str = String(rawVal);
  const dotIndex = str.indexOf(".");

  if (dotIndex > 0) {
    const op = str.substring(0, dotIndex).toLowerCase();
    const rest = str.substring(dotIndex + 1);

    switch (op) {
      case "eq":
        return { operatorSql: "= $INDEX", value: rest, hasParam: true };
      case "neq":
        return { operatorSql: "<> $INDEX", value: rest, hasParam: true };
      case "gt":
        return { operatorSql: "> $INDEX", value: rest, hasParam: true };
      case "gte":
        return { operatorSql: ">= $INDEX", value: rest, hasParam: true };
      case "lt":
        return { operatorSql: "< $INDEX", value: rest, hasParam: true };
      case "lte":
        return { operatorSql: "<= $INDEX", value: rest, hasParam: true };
      case "like":
        return { operatorSql: "LIKE $INDEX", value: rest, hasParam: true };
      case "ilike":
        return { operatorSql: "ILIKE $INDEX", value: rest, hasParam: true };
      case "is": {
        const lowerRest = rest.toLowerCase();
        if (lowerRest === "null") {
          return { operatorSql: "IS NULL", hasParam: false };
        }
        if (lowerRest === "notnull" || lowerRest === "not.null") {
          return { operatorSql: "IS NOT NULL", hasParam: false };
        }
        return { operatorSql: "= $INDEX", value: rest, hasParam: true };
      }
      case "in": {
        // e.g. in.(val1,val2,val3) or (val1,val2)
        let listStr = rest;
        if (listStr.startsWith("(") && listStr.endsWith(")")) {
          listStr = listStr.slice(1, -1);
        }
        const items = listStr
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        return { operatorSql: "= ANY($INDEX)", value: items, hasParam: true };
      }
      default:
        // Not a recognized operator prefix, treat as exact string equality
        return { operatorSql: "= $INDEX", value: str, hasParam: true };
    }
  }

  // Plain string or number equality
  return { operatorSql: "= $INDEX", value: rawVal, hasParam: true };
}

/**
 * Extracts filter conditions from query parameters.
 */
function extractFilters(
  query: Record<string, any>,
  paramStartIndex = 1
): { conditions: string[]; values: any[]; nextIndex: number } {
  const conditions: string[] = [];
  const values: any[] = [];
  let currentIndex = paramStartIndex;

  for (const [key, rawValue] of Object.entries(query)) {
    if (RESERVED_PARAMS.has(key)) continue;

    const column = validateIdentifier(key);
    const parsed = parseOperator(rawValue);

    if (parsed.hasParam) {
      const conditionSql = `"${column}" ${parsed.operatorSql.replace("$INDEX", `$${currentIndex}`)}`;
      conditions.push(conditionSql);
      values.push(parsed.value);
      currentIndex++;
    } else {
      const conditionSql = `"${column}" ${parsed.operatorSql}`;
      conditions.push(conditionSql);
    }
  }

  return { conditions, values, nextIndex: currentIndex };
}

/**
 * Compiles a PostgREST-style GET query into SELECT and COUNT SQL.
 */
export function compileSelect(
  table: string,
  query: Record<string, any> = {}
): CompiledQuery {
  const safeTable = validateIdentifier(table);

  // 1. Projection (select=col1,col2)
  let projection = "*";
  if (query.select && typeof query.select === "string" && query.select.trim() !== "*") {
    const rawCols = query.select.split(",").map((c: string) => c.trim()).filter(Boolean);
    if (rawCols.length > 0) {
      projection = rawCols.map((c: string) => `"${validateIdentifier(c)}"`).join(", ");
    }
  }

  // 2. Filters
  const { conditions, values, nextIndex } = extractFilters(query, 1);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // 3. Sorting (order=col.asc or order=col.desc)
  let orderClause = "";
  if (query.order && typeof query.order === "string") {
    const orderParts = query.order.split(",").map((p: string) => p.trim()).filter(Boolean);
    const orderItems: string[] = [];

    for (const part of orderParts) {
      const dotIdx = part.lastIndexOf(".");
      if (dotIdx > 0) {
        const col = validateIdentifier(part.substring(0, dotIdx));
        const direction = part.substring(dotIdx + 1).toUpperCase();
        const dirSafe = direction === "DESC" ? "DESC" : "ASC";
        orderItems.push(`"${col}" ${dirSafe}`);
      } else {
        const col = validateIdentifier(part);
        orderItems.push(`"${col}" ASC`);
      }
    }

    if (orderItems.length > 0) {
      orderClause = `ORDER BY ${orderItems.join(", ")}`;
    }
  }

  // 4. Pagination (limit, offset)
  let limit = 50;
  if (query.limit !== undefined) {
    const parsedLimit = parseInt(String(query.limit), 10);
    if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, 500); // Strict safety cap: 500
    }
  }

  let offset = 0;
  if (query.offset !== undefined) {
    const parsedOffset = parseInt(String(query.offset), 10);
    if (!Number.isNaN(parsedOffset) && parsedOffset >= 0) {
      offset = parsedOffset;
    }
  } else if (query.page !== undefined) {
    const parsedPage = parseInt(String(query.page), 10);
    if (!Number.isNaN(parsedPage) && parsedPage > 1) {
      offset = (parsedPage - 1) * limit;
    }
  }

  const valuesWithPagination = [...values, limit, offset];
  const limitIndex = nextIndex;
  const offsetIndex = nextIndex + 1;

  const sql = `
    SELECT ${projection}
    FROM "public"."${safeTable}"
    ${whereClause}
    ${orderClause}
    LIMIT $${limitIndex} OFFSET $${offsetIndex};
  `.trim();

  const countSql = `
    SELECT count(*)::bigint AS count
    FROM "public"."${safeTable}"
    ${whereClause};
  `.trim();

  return {
    sql,
    values: valuesWithPagination,
    countSql,
  };
}

/**
 * Compiles an INSERT query for single or bulk records with RETURNING *.
 */
export function compileInsert(
  table: string,
  data: Record<string, any> | Record<string, any>[]
): CompiledQuery {
  const safeTable = validateIdentifier(table);

  const records = Array.isArray(data) ? data : [data];
  if (records.length === 0) {
    throw new AppError("No data provided for insertion", 400, "BAD_REQUEST");
  }

  // Collect all unique column names from all records
  const columnSet = new Set<string>();
  for (const record of records) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new AppError("Insert data must consist of key-value objects", 400, "BAD_REQUEST");
    }
    for (const key of Object.keys(record)) {
      columnSet.add(validateIdentifier(key));
    }
  }

  const columns = Array.from(columnSet);
  if (columns.length === 0) {
    throw new AppError("Cannot insert empty object", 400, "BAD_REQUEST");
  }

  const quotedColumns = columns.map((col) => `"${col}"`).join(", ");
  const rowPlaceholders: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const record of records) {
    const placeholders: string[] = [];
    for (const col of columns) {
      placeholders.push(`$${paramIndex}`);
      values.push(record[col] !== undefined ? record[col] : null);
      paramIndex++;
    }
    rowPlaceholders.push(`(${placeholders.join(", ")})`);
  }

  const sql = `
    INSERT INTO "public"."${safeTable}" (${quotedColumns})
    VALUES ${rowPlaceholders.join(", ")}
    RETURNING *;
  `.trim();

  return { sql, values };
}

/**
 * Compiles an UPDATE query with filters and RETURNING *.
 */
export function compileUpdate(
  table: string,
  query: Record<string, any>,
  data: Record<string, any>
): CompiledQuery {
  const safeTable = validateIdentifier(table);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new AppError("Update payload must be a non-empty key-value object", 400, "BAD_REQUEST");
  }

  const setKeys = Object.keys(data);
  if (setKeys.length === 0) {
    throw new AppError("No fields specified to update", 400, "BAD_REQUEST");
  }

  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const key of setKeys) {
    const col = validateIdentifier(key);
    setClauses.push(`"${col}" = $${paramIndex}`);
    values.push(data[key]);
    paramIndex++;
  }

  // Compile filters using the continuing paramIndex
  const { conditions, values: filterValues } = extractFilters(query, paramIndex);
  if (conditions.length === 0) {
    throw new AppError(
      "Unconditional updates are prohibited. Please supply at least one filter query parameter.",
      400,
      "MISSING_FILTER"
    );
  }

  values.push(...filterValues);

  const sql = `
    UPDATE "public"."${safeTable}"
    SET ${setClauses.join(", ")}
    WHERE ${conditions.join(" AND ")}
    RETURNING *;
  `.trim();

  return { sql, values };
}

/**
 * Compiles a DELETE query with filters and RETURNING *.
 */
export function compileDelete(
  table: string,
  query: Record<string, any>
): CompiledQuery {
  const safeTable = validateIdentifier(table);

  const { conditions, values } = extractFilters(query, 1);
  if (conditions.length === 0) {
    throw new AppError(
      "Unconditional deletions are prohibited. Please supply at least one filter query parameter.",
      400,
      "MISSING_FILTER"
    );
  }

  const sql = `
    DELETE FROM "public"."${safeTable}"
    WHERE ${conditions.join(" AND ")}
    RETURNING *;
  `.trim();

  return { sql, values };
}
