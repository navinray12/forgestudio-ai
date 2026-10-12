/**
 * Modules 46–52: Application Runtime Platform Controller
 */

import { Request, Response } from "express";
import { serverlessFunctionService } from "../modules/runtime-platform/functions/serverlessFunction.service.js";
import { taskQueueService } from "../modules/runtime-platform/queues/taskQueue.service.js";
import { cronEngineService } from "../modules/runtime-platform/scheduler/cronEngine.service.js";
import { eventBusService } from "../modules/runtime-platform/events/eventBus.service.js";
import { realtimeEngineService } from "../modules/runtime-platform/realtime/realtimeEngine.service.js";
import { kvLayerService } from "../modules/runtime-platform/kv/kvLayer.service.js";
import { apiGatewayService } from "../modules/runtime-platform/gateway/apiGateway.service.js";
import { schemaRegistryService } from "../modules/runtime-platform/gateway/schemaRegistry.service.js";

export class RuntimePlatformController {
  // ------------------------------------------------------------
  // MODULE 46: Serverless Functions
  // ------------------------------------------------------------
  public static async listFunctions(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const env = req.query.environment as string | undefined;
      const functions = await serverlessFunctionService.listFunctions(projectId, env);
      res.json({ functions });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async createFunction(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const fn = await serverlessFunctionService.createFunction(projectId, req.body);
      res.status(201).json({ function: fn });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async getFunction(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const fn = await serverlessFunctionService.getFunction(projectId, req.params.fnId as string);
      res.json({ function: fn });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async updateFunction(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const fn = await serverlessFunctionService.updateFunction(projectId, req.params.fnId as string, req.body);
      res.json({ function: fn });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async deleteFunction(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      await serverlessFunctionService.deleteFunction(projectId, req.params.fnId as string);
      res.json({ success: true });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async invokeFunction(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const result = await serverlessFunctionService.invokeFunction(
        projectId,
        req.params.fnId as string,
        req.body,
        "HTTP",
        {
          headers: req.headers as Record<string, string>,
          query: req.query as Record<string, string>,
        }
      );
      if (result.statusCode && result.statusCode >= 400) {
        res.status(result.statusCode).json({ error: result.error, result });
        return;
      }
      res.json({ result });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async getFunctionLogs(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const limit = Number(req.query.limit || 20);
      const logs = await serverlessFunctionService.getInvocationLogs(projectId, req.params.fnId as string, limit);
      res.json({ logs });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  // ------------------------------------------------------------
  // MODULE 47: Background Jobs & Queue
  // ------------------------------------------------------------
  public static async listQueues(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const queues = await taskQueueService.listQueues(projectId);
      res.json({ queues });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async createQueue(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const queue = await taskQueueService.createQueue(projectId, req.body.name, req.body);
      res.status(201).json({ queue });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async getQueueMetrics(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const metrics = await taskQueueService.getQueueMetrics(projectId, req.params.queueId as string);
      res.json({ metrics });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async listJobs(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const status = req.query.status as string | undefined;
      const limit = Number(req.query.limit || 50);
      const jobs = await taskQueueService.listJobs(projectId, req.params.queueId as string, status, limit);
      res.json({ jobs });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async enqueueJob(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const job = await taskQueueService.enqueueJob(projectId, req.params.queueId as string, req.body);
      res.status(201).json({ job });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async replayDlqJob(req: Request, res: Response): Promise<void> {
    try {
      const job = await taskQueueService.replayDlqJob(req.params.jobId as string);
      res.json({ job });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  // ------------------------------------------------------------
  // MODULE 48: Scheduler / Cron Engine
  // ------------------------------------------------------------
  public static async listSchedules(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const schedules = await cronEngineService.listSchedules(projectId);
      res.json({ schedules });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async createSchedule(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const schedule = await cronEngineService.createSchedule(projectId, req.body);
      res.status(201).json({ schedule });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async triggerSchedule(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const execution = await cronEngineService.executeSchedule(projectId, req.params.scheduleId as string, true);
      res.json({ execution });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async deleteSchedule(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      await cronEngineService.deleteSchedule(projectId, req.params.scheduleId as string);
      res.json({ success: true });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async getScheduleHistory(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const limit = Number(req.query.limit || 20);
      const history = await cronEngineService.getExecutionHistory(projectId, req.params.scheduleId as string, limit);
      res.json({ history });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  // ------------------------------------------------------------
  // MODULE 49: Event Bus & Webhook Platform
  // ------------------------------------------------------------
  public static async listTopics(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const topics = await eventBusService.listTopics(projectId);
      res.json({ topics });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async createTopic(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const topic = await eventBusService.createTopic(projectId, req.body.name, req.body.description, req.body.schemaDefinition);
      res.status(201).json({ topic });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async publishEvent(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const result = await eventBusService.publishEvent(projectId, req.params.topicId as string, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async listSubscriptions(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const topicId = req.query.topicId as string | undefined;
      const subscriptions = await eventBusService.listSubscriptions(projectId, topicId);
      res.json({ subscriptions });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async createSubscription(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const subscription = await eventBusService.createSubscription(projectId, req.body.topicNameOrId, req.body);
      res.status(201).json({ subscription });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async listWebhookDeliveries(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const subscriptionId = req.query.subscriptionId as string | undefined;
      const deliveries = await eventBusService.listWebhookDeliveries(projectId, subscriptionId);
      res.json({ deliveries });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  // ------------------------------------------------------------
  // MODULE 50: Realtime Engine
  // ------------------------------------------------------------
  public static async listChannels(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const channels = await realtimeEngineService.listChannels(projectId);
      res.json({ channels });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async createChannel(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const channel = await realtimeEngineService.createChannel(projectId, req.body.name, req.body);
      res.status(201).json({ channel });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async joinChannel(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const channelName = req.params.channel as string;
      const presence = await realtimeEngineService.joinChannel(projectId, channelName, req.body);
      res.json({ presence });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async broadcastMessage(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const channelName = req.params.channel as string;
      const msg = realtimeEngineService.broadcast(
        projectId,
        channelName,
        req.body.event || "message",
        req.body.data,
        req.body.senderId
      );
      res.json({ message: msg });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async getChannelPresence(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const presence = realtimeEngineService.getPresence(projectId, req.params.channel as string);
      res.json({ presence });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async getChannelMessages(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const messages = realtimeEngineService.getRecentMessages(projectId, req.params.channel as string);
      res.json({ messages });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  // ------------------------------------------------------------
  // MODULE 51: Cache / KV Layer
  // ------------------------------------------------------------
  public static async listKvNamespaces(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const namespaces = await kvLayerService.listNamespaces(projectId);
      res.json({ namespaces });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async createKvNamespace(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const ns = await kvLayerService.createNamespace(projectId, req.body.name, req.body.description, req.body.isEncrypted);
      res.status(201).json({ namespace: ns });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async listKvKeys(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const prefix = req.query.prefix as string || "";
      const keys = await kvLayerService.listKeys(projectId, req.params.namespace as string, prefix);
      res.json({ keys });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async getKvKey(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const value = await kvLayerService.get(projectId, req.params.namespace as string, req.params.key as string);
      res.json({ key: req.params.key, value });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async setKvKey(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const entry = await kvLayerService.set(projectId, req.params.namespace as string, {
        key: req.params.key as string,
        value: req.body.value,
        ttlSeconds: req.body.ttlSeconds,
        tags: req.body.tags,
      });
      res.json({ entry });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async deleteKvKey(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const deleted = await kvLayerService.delete(projectId, req.params.namespace as string, req.params.key as string);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async invalidateKvTag(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const count = await kvLayerService.invalidateByTag(projectId, req.params.namespace as string, req.body.tag);
      res.json({ invalidatedCount: count });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  // ------------------------------------------------------------
  // MODULE 52: API Gateway & Schema Registry
  // ------------------------------------------------------------
  public static async listGatewayRoutes(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const routes = await apiGatewayService.listRoutes(projectId);
      res.json({ routes });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async createGatewayRoute(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const route = await apiGatewayService.createRoute(projectId, req.body);
      res.status(201).json({ route });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async deleteGatewayRoute(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      await apiGatewayService.deleteRoute(projectId, req.params.routeId as string);
      res.json({ success: true });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async dispatchGatewayRequest(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const splat = (req.params as any).splat || (req.params as any)[0] || "";
      const targetPath = splat.startsWith("/") ? splat : "/" + splat;
      const result = await apiGatewayService.dispatchRequest(
        projectId,
        targetPath,
        req.method,
        {
          headers: req.headers as Record<string, string>,
          body: req.body,
          query: req.query as Record<string, string>,
          clientIp: req.ip,
          authUserId: (req as any).user?.id,
        }
      );

      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v);
      }
      res.status(result.statusCode).json(result.body);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async listSchemas(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const schemas = await schemaRegistryService.listSchemas(projectId);
      res.json({ schemas });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async registerSchema(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const schema = await schemaRegistryService.registerSchema(
        projectId,
        req.body.name,
        req.body.version || "v1",
        req.body.schemaDefinition,
        req.body.schemaType
      );
      res.status(201).json({ schema });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }
}
