/**
 * Module 49: Event Bus & Webhook Platform Service
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  EventTopicConfig,
  EventSubscriptionConfig,
  PublishedEventRecord,
  PublishEventDto,
  WebhookDeliveryRecord,
} from "./events.types.js";
import { WebhookDispatcher } from "./webhookDispatcher.js";
import { serverlessFunctionService } from "../functions/serverlessFunction.service.js";
import { taskQueueService } from "../queues/taskQueue.service.js";

export class EventBusService {
  /**
   * Create a new event topic
   */
  public async createTopic(
    projectId: string,
    name: string,
    description?: string,
    schemaDefinition?: any
  ): Promise<EventTopicConfig> {
    const topic = await (prisma as any).forgeEventTopic.create({
      data: {
        projectId,
        name,
        description: description || null,
        schemaDefinition: schemaDefinition || null,
      },
    });

    return topic;
  }

  /**
   * List all topics for a project
   */
  public async listTopics(projectId: string): Promise<EventTopicConfig[]> {
    return (prisma as any).forgeEventTopic.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Get topic by name or ID
   */
  public async getTopic(projectId: string, topicNameOrId: string): Promise<EventTopicConfig> {
    const topic = await (prisma as any).forgeEventTopic.findFirst({
      where: {
        projectId,
        OR: [{ id: topicNameOrId }, { name: topicNameOrId }],
      },
    });

    if (!topic) {
      throw new AppError(`Topic '${topicNameOrId}' not found`, 404);
    }

    return topic;
  }

  /**
   * Create an event subscription
   */
  public async createSubscription(
    projectId: string,
    topicNameOrId: string,
    data: {
      name: string;
      destinationType: "FUNCTION" | "QUEUE_JOB" | "WEBHOOK";
      destinationConfig: {
        functionName?: string;
        queueName?: string;
        webhookUrl?: string;
        webhookSecret?: string;
      };
      filterPolicy?: Record<string, any>;
    }
  ): Promise<EventSubscriptionConfig> {
    const topic = await this.getTopic(projectId, topicNameOrId);

    const subscription = await (prisma as any).forgeEventSubscription.create({
      data: {
        topicId: topic.id,
        projectId,
        name: data.name,
        destinationType: data.destinationType,
        destinationConfig: data.destinationConfig,
        filterPolicy: data.filterPolicy || {},
        isActive: true,
      },
    });

    return subscription;
  }

  /**
   * List subscriptions for a project or specific topic
   */
  public async listSubscriptions(
    projectId: string,
    topicNameOrId?: string
  ): Promise<EventSubscriptionConfig[]> {
    const where: any = { projectId };
    if (topicNameOrId) {
      const topic = await this.getTopic(projectId, topicNameOrId);
      where.topicId = topic.id;
    }

    return (prisma as any).forgeEventSubscription.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Publish an event to a topic and fan-out to all active subscribers
   */
  public async publishEvent(
    projectId: string,
    topicNameOrId: string,
    dto: PublishEventDto
  ): Promise<{
    event: PublishedEventRecord;
    deliveredCount: number;
    subscribersMatched: number;
  }> {
    const topic = await this.getTopic(projectId, topicNameOrId);

    // 1. Persist the event record
    const event = await (prisma as any).forgeEvent.create({
      data: {
        topicId: topic.id,
        projectId,
        eventName: dto.eventName,
        payload: dto.payload || {},
        metadata: dto.metadata || {},
        publishedAt: new Date(),
      },
    });

    // 2. Query active subscriptions
    const subscriptions = await (prisma as any).forgeEventSubscription.findMany({
      where: { topicId: topic.id, projectId, isActive: true },
    });

    let deliveredCount = 0;
    let subscribersMatched = 0;

    for (const sub of subscriptions) {
      // Evaluate filter policy
      if (!this.matchesFilter(dto.payload, sub.filterPolicy)) {
        continue;
      }

      subscribersMatched++;

      try {
        if (sub.destinationType === "FUNCTION" && sub.destinationConfig?.functionName) {
          await serverlessFunctionService.invokeFunction(
            projectId,
            sub.destinationConfig.functionName,
            { event: dto.eventName, payload: dto.payload, metadata: dto.metadata },
            "EVENT",
            { trigger: "EVENT" }
          );
          deliveredCount++;
        } else if (sub.destinationType === "QUEUE_JOB" && sub.destinationConfig?.queueName) {
          await taskQueueService.enqueueJob(projectId, sub.destinationConfig.queueName, {
            name: `event-${dto.eventName}`,
            payload: { event: dto.eventName, payload: dto.payload },
            priority: "NORMAL",
          });
          deliveredCount++;
        } else if (sub.destinationType === "WEBHOOK" && sub.destinationConfig?.webhookUrl) {
          await WebhookDispatcher.dispatch({
            subscriptionId: sub.id,
            projectId,
            eventId: event.id,
            endpointUrl: sub.destinationConfig.webhookUrl,
            secret: sub.destinationConfig.webhookSecret,
            payload: {
              event: dto.eventName,
              payload: dto.payload,
              metadata: dto.metadata,
              publishedAt: event.publishedAt,
            },
          });
          deliveredCount++;
        }
      } catch (err) {
        console.error(`[EventBus] Delivery failed for subscription ${sub.id}:`, err);
      }
    }

    return {
      event,
      deliveredCount,
      subscribersMatched,
    };
  }

  /**
   * Helper to evaluate filter policy keys against payload
   */
  private matchesFilter(payload: any, filterPolicy?: Record<string, any>): boolean {
    if (!filterPolicy || Object.keys(filterPolicy).length === 0) return true;
    for (const [key, expected] of Object.entries(filterPolicy)) {
      if (payload[key] !== expected) return false;
    }
    return true;
  }

  /**
   * List webhook deliveries
   */
  public async listWebhookDeliveries(
    projectId: string,
    subscriptionId?: string,
    limit = 50
  ): Promise<WebhookDeliveryRecord[]> {
    const where: any = { projectId };
    if (subscriptionId) where.subscriptionId = subscriptionId;

    return (prisma as any).forgeWebhookDelivery.findMany({
      where,
      orderBy: { deliveredAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    });
  }
}

export const eventBusService = new EventBusService();
