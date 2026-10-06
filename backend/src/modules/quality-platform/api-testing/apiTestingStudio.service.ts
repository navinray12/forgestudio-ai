/**
 * Module 44: API Testing Studio Service
 * Workbench for HTTP, GraphQL, and WebSocket API requests, assertions, collection runners, and OpenAPI syncing.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  ApiCollectionConfig,
  ApiTestRequestConfig,
  SingleApiExecutionResult,
  ApiCollectionRunRecord,
} from "./apiTesting.types.js";

export class ApiTestingStudioService {
  /**
   * Create a new API testing collection
   */
  public async createCollection(
    projectId: string,
    name: string,
    description?: string,
    variables: Record<string, string> = {}
  ): Promise<ApiCollectionConfig> {
    const coll = await (prisma as any).forgeApiCollection.create({
      data: {
        projectId,
        name,
        description: description || null,
        variables,
      },
    });

    return coll;
  }

  /**
   * List collections for a project
   */
  public async listCollections(projectId: string): Promise<ApiCollectionConfig[]> {
    return (prisma as any).forgeApiCollection.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Create an API test request inside a collection
   */
  public async createRequest(
    projectId: string,
    collectionId: string,
    data: {
      name: string;
      method: string;
      url: string;
      headers?: Record<string, string>;
      params?: Record<string, string>;
      body?: any;
      auth?: any;
      assertions?: any[];
      preRequestScript?: string;
      testScript?: string;
    }
  ): Promise<ApiTestRequestConfig> {
    const req = await (prisma as any).forgeApiTestRequest.create({
      data: {
        projectId,
        collectionId,
        name: data.name,
        method: data.method.toUpperCase(),
        url: data.url,
        headers: data.headers || {},
        params: data.params || {},
        body: data.body || {},
        auth: data.auth || {},
        assertions: data.assertions || [],
        preRequestScript: data.preRequestScript || null,
        testScript: data.testScript || null,
      },
    });

    return req;
  }

  /**
   * List requests in a collection
   */
  public async listRequests(projectId: string, collectionId: string): Promise<ApiTestRequestConfig[]> {
    return (prisma as any).forgeApiTestRequest.findMany({
      where: { projectId, collectionId },
      orderBy: { sortOrder: "asc" },
    });
  }

  /**
   * Execute a single API test request and evaluate assertions
   */
  public async executeRequest(
    projectId: string,
    requestId: string,
    variableOverrides: Record<string, string> = {}
  ): Promise<SingleApiExecutionResult> {
    const req = await (prisma as any).forgeApiTestRequest.findFirst({
      where: { id: requestId, projectId },
    });

    if (!req) {
      throw new AppError("API test request not found", 404);
    }

    const coll = await (prisma as any).forgeApiCollection.findUnique({
      where: { id: req.collectionId },
    });

    const vars: Record<string, string> = {
      ...(coll?.variables || {}),
      ...variableOverrides,
    };

    // 1. Interpolate variables in URL, headers, and body
    const interpolatedUrl = this.interpolateString(req.url, vars);
    const interpolatedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers || {})) {
      interpolatedHeaders[k] = this.interpolateString(String(v), vars);
    }

    // Apply Auth
    if (req.auth?.type === "BEARER" && req.auth.token) {
      interpolatedHeaders["Authorization"] = `Bearer ${this.interpolateString(req.auth.token, vars)}`;
    } else if (req.auth?.type === "API_KEY" && req.auth.apiKey) {
      const header = req.auth.headerName || "X-API-Key";
      interpolatedHeaders[header] = this.interpolateString(req.auth.apiKey, vars);
    }

    let requestBody: any = undefined;
    if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
      if (typeof req.body === "string") {
        requestBody = this.interpolateString(req.body, vars);
      } else {
        requestBody = JSON.stringify(req.body);
        if (!interpolatedHeaders["Content-Type"]) {
          interpolatedHeaders["Content-Type"] = "application/json";
        }
      }
    }

    const startTime = Date.now();
    let statusCode = 200;
    let responseBody: any = null;
    let responseHeaders: Record<string, string> = {};
    let sizeBytes = 0;

    try {
      const fetchResp = await fetch(interpolatedUrl, {
        method: req.method,
        headers: interpolatedHeaders,
        body: requestBody,
      });

      statusCode = fetchResp.status;
      fetchResp.headers.forEach((val, key) => {
        responseHeaders[key] = val;
      });

      const text = await fetchResp.text();
      sizeBytes = Buffer.byteLength(text, "utf8");
      try {
        responseBody = JSON.parse(text);
      } catch {
        responseBody = text;
      }
    } catch (fetchErr: any) {
      statusCode = 500;
      responseBody = { error: fetchErr.message || "Network Error" };
    }

    const durationMs = Date.now() - startTime;

    // 2. Evaluate Assertions
    const assertionResults: any[] = [];
    let allPassed = true;

    for (const a of req.assertions || []) {
      let passed = false;
      let actual: any = null;
      let errorMsg: string | undefined = undefined;

      if (a.type === "STATUS_CODE") {
        actual = statusCode;
        passed = statusCode === Number(a.expected);
      } else if (a.type === "RESPONSE_TIME") {
        actual = durationMs;
        passed = durationMs <= Number(a.expected);
      } else if (a.type === "HEADER_EXISTS") {
        actual = responseHeaders[String(a.expected).toLowerCase()] !== undefined;
        passed = Boolean(actual);
      } else if (a.type === "BODY_CONTAINS") {
        const bodyStr = typeof responseBody === "object" ? JSON.stringify(responseBody) : String(responseBody);
        actual = bodyStr;
        passed = bodyStr.includes(String(a.expected));
      } else if (a.type === "JSON_PATH_EQUALS") {
        const path = a.target || "";
        actual = this.extractJsonPath(responseBody, path);
        passed = JSON.stringify(actual) === JSON.stringify(a.expected);
      }

      if (!passed) {
        allPassed = false;
        errorMsg = `Assertion failed: expected ${JSON.stringify(a.expected)}, got ${JSON.stringify(actual)}`;
      }

      assertionResults.push({
        type: a.type,
        passed,
        expected: a.expected,
        actual,
        error: errorMsg,
      });
    }

    return {
      requestId: req.id,
      name: req.name,
      method: req.method,
      url: interpolatedUrl,
      statusCode,
      durationMs,
      sizeBytes,
      responseHeaders,
      responseBody,
      assertionResults,
      status: allPassed ? "PASSED" : "FAILED",
    };
  }

  /**
   * Run all requests in a collection
   */
  public async runCollection(
    projectId: string,
    collectionId: string,
    variableOverrides: Record<string, string> = {}
  ): Promise<ApiCollectionRunRecord> {
    const startTime = Date.now();
    const requests = await this.listRequests(projectId, collectionId);

    const results: SingleApiExecutionResult[] = [];
    let passedAssertions = 0;
    let failedAssertions = 0;

    for (const req of requests) {
      const res = await this.executeRequest(projectId, req.id, variableOverrides);
      results.push(res);
      for (const a of res.assertionResults) {
        if (a.passed) passedAssertions++;
        else failedAssertions++;
      }
    }

    const durationMs = Date.now() - startTime;
    const status = failedAssertions > 0 ? "FAILED" : "PASSED";

    const runRecord = await (prisma as any).forgeApiTestRun.create({
      data: {
        collectionId,
        projectId,
        status,
        totalRequests: requests.length,
        passedAssertions,
        failedAssertions,
        durationMs,
        results,
      },
    });

    return runRecord;
  }

  /**
   * Import collection from OpenAPI 3.0 specification
   */
  public async importFromOpenApi(
    projectId: string,
    openApiSpec: any,
    collectionName?: string
  ): Promise<ApiCollectionConfig> {
    const name = collectionName || openApiSpec.info?.title || `Imported API Collection ${Date.now()}`;
    const coll = await this.createCollection(projectId, name, openApiSpec.info?.description, {
      baseUrl: openApiSpec.servers?.[0]?.url || "http://localhost:5000",
    });

    const paths = openApiSpec.paths || {};
    let sortOrder = 0;

    for (const [pathKey, pathMethods] of Object.entries<any>(paths)) {
      for (const [methodKey, methodSpec] of Object.entries<any>(pathMethods)) {
        if (!["get", "post", "put", "patch", "delete"].includes(methodKey.toLowerCase())) continue;

        const reqName = methodSpec.summary || `${methodKey.toUpperCase()} ${pathKey}`;
        const url = `{{baseUrl}}${pathKey}`;

        await this.createRequest(projectId, coll.id, {
          name: reqName,
          method: methodKey.toUpperCase(),
          url,
          assertions: [{ id: `a_${Date.now()}`, type: "STATUS_CODE", expected: 200 }],
        });
        sortOrder++;
      }
    }

    return coll;
  }

  private interpolateString(str: string, vars: Record<string, string>): string {
    if (!str) return str;
    return str.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (_, key) => {
      return vars[key] !== undefined ? vars[key] : `{{${key}}}`;
    });
  }

  private extractJsonPath(obj: any, path: string): any {
    if (!path || !obj) return obj;
    const parts = path.split(".").filter(Boolean);
    let cur = obj;
    for (const p of parts) {
      if (cur === undefined || cur === null) return undefined;
      cur = cur[p];
    }
    return cur;
  }
}

export const apiTestingStudioService = new ApiTestingStudioService();
