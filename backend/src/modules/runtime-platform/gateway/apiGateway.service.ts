/**
 * Module 52: API Gateway Service
 * Handles unified routing, authentication checks, schema enforcement, rate-limits, and upstream dispatch.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  ApiGatewayRouteConfig,
  CreateRouteDto,
  GatewayInvocationResult,
} from "./gateway.types.js";
import { schemaRegistryService } from "./schemaRegistry.service.js";
import { serverlessFunctionService } from "../functions/serverlessFunction.service.js";
import { dataApiService } from "../../data-platform/api-layer/dataApi.service.js";

export class ApiGatewayService {
  // Simple in-memory rate-limiter: `${projectId}:${routeId}:${ip}` -> { count: number, resetAt: number }
  private rateLimitMap: Map<string, { count: number; resetAt: number }> = new Map();

  /**
   * Register a gateway route
   */
  public async createRoute(
    projectId: string,
    dto: CreateRouteDto
  ): Promise<ApiGatewayRouteConfig> {
    const method = (dto.method || "GET").toUpperCase();

    const route = await (prisma as any).forgeApiGatewayRoute.create({
      data: {
        projectId,
        path: dto.path,
        method,
        targetType: dto.targetType,
        targetDestination: dto.targetDestination,
        requireAuth: dto.requireAuth ?? false,
        rateLimitPerMin: dto.rateLimitPerMin || 120,
        corsOrigins: dto.corsOrigins || ["*"],
        requestSchemaId: dto.requestSchemaId || null,
        responseSchemaId: dto.responseSchemaId || null,
        isActive: true,
      },
    });

    return route;
  }

  /**
   * List all routes for a project
   */
  public async listRoutes(projectId: string): Promise<ApiGatewayRouteConfig[]> {
    return (prisma as any).forgeApiGatewayRoute.findMany({
      where: { projectId },
      orderBy: { path: "asc" },
    });
  }

  /**
   * Delete a route
   */
  public async deleteRoute(projectId: string, routeId: string): Promise<void> {
    await (prisma as any).forgeApiGatewayRoute.deleteMany({
      where: { id: routeId, projectId },
    });
  }

  /**
   * Match route for incoming HTTP request
   */
  public async matchRoute(
    projectId: string,
    path: string,
    method: string
  ): Promise<ApiGatewayRouteConfig | null> {
    const normalizedMethod = method.toUpperCase();

    const routes = await (prisma as any).forgeApiGatewayRoute.findMany({
      where: { projectId, isActive: true },
    });

    for (const route of routes) {
      if (route.method !== "*" && route.method !== normalizedMethod) {
        continue;
      }

      // Check path match (exact match or prefix wildcard: /api/v1/*)
      if (route.path === path) return route;
      if (route.path.endsWith("/*")) {
        const prefix = route.path.slice(0, -2);
        if (path.startsWith(prefix)) return route;
      }
    }

    return null;
  }

  /**
   * Dispatch an incoming request through the API Gateway pipeline
   */
  public async dispatchRequest(
    projectId: string,
    path: string,
    method: string,
    options: {
      headers?: Record<string, string>;
      body?: any;
      query?: Record<string, string>;
      clientIp?: string;
      authUserId?: string;
    } = {}
  ): Promise<GatewayInvocationResult> {
    const startTime = Date.now();
    const route = await this.matchRoute(projectId, path, method);

    if (!route) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: { error: `Gateway 404: No route configured for [${method}] ${path}` },
        durationMs: Date.now() - startTime,
        routedTo: "NONE",
      };
    }

    // 1. Rate Limiting Check
    const ip = options.clientIp || "127.0.0.1";
    const rlKey = `${projectId}:${route.id}:${ip}`;
    const now = Date.now();
    const rlEntry = this.rateLimitMap.get(rlKey);

    if (rlEntry && rlEntry.resetAt > now) {
      if (rlEntry.count >= route.rateLimitPerMin) {
        return {
          statusCode: 429,
          headers: { "Retry-After": "60", "Content-Type": "application/json" },
          body: { error: "RATE_LIMIT_EXCEEDED: Too many requests" },
          durationMs: Date.now() - startTime,
          routedTo: route.targetDestination,
        };
      }
      rlEntry.count++;
    } else {
      this.rateLimitMap.set(rlKey, { count: 1, resetAt: now + 60000 });
    }

    // 2. Authentication Check
    if (route.requireAuth && !options.authUserId) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: { error: "UNAUTHORIZED: Authentication required for this endpoint" },
        durationMs: Date.now() - startTime,
        routedTo: route.targetDestination,
      };
    }

    // 3. Schema Validation Check
    if (route.requestSchemaId) {
      const schema = await (prisma as any).forgeSchemaRegistry.findUnique({
        where: { id: route.requestSchemaId },
      });
      if (schema) {
        const valRes = schemaRegistryService.validatePayload(schema.schemaDefinition, options.body);
        if (!valRes.valid) {
          return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: { error: "SCHEMA_VALIDATION_FAILED", details: valRes.errors },
            durationMs: Date.now() - startTime,
            routedTo: route.targetDestination,
          };
        }
      }
    }

    // 4. Target Execution Dispatch
    let statusCode = 200;
    let body: any = null;
    const resHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": route.corsOrigins[0] || "*",
    };

    try {
      if (route.targetType === "FUNCTION") {
        const fnResult = await serverlessFunctionService.invokeFunction(
          projectId,
          route.targetDestination,
          options.body || {},
          "HTTP",
          {
            headers: options.headers || {},
            query: options.query || {},
          }
        );
        statusCode = fnResult.statusCode || (fnResult.status === "SUCCESS" ? 200 : 500);
        body = fnResult.responsePayload;
      } else if (route.targetType === "DATA_API") {
        const queryRes = await dataApiService.executeRestQuery(
          projectId,
          "development",
          route.targetDestination,
          { limit: 50, filter: options.query }
        );
        statusCode = 200;
        body = queryRes;
      } else if (route.targetType === "STATIC") {
        statusCode = 200;
        body = JSON.parse(route.targetDestination);
      } else if (route.targetType === "PROXY") {
        const proxyResp = await fetch(route.targetDestination, {
          method,
          headers: options.headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });
        statusCode = proxyResp.status;
        body = await proxyResp.json().catch(() => ({ status: "OK" }));
      }
    } catch (err: any) {
      statusCode = 500;
      body = { error: err.message || "Gateway dispatch error" };
    }

    return {
      statusCode,
      headers: resHeaders,
      body,
      durationMs: Date.now() - startTime,
      routedTo: route.targetDestination,
    };
  }
}

export const apiGatewayService = new ApiGatewayService();
