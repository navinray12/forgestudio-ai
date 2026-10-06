/**
 * Module 49: Event Bus & Webhook Platform Types
 */

export interface EventTopicConfig {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  schemaDefinition?: any;
  createdAt: string;
  updatedAt: string;
}

export interface EventSubscriptionConfig {
  id: string;
  topicId: string;
  projectId: string;
  name: string;
  destinationType: "FUNCTION" | "QUEUE_JOB" | "WEBHOOK";
  destinationConfig: {
    functionName?: string;
    queueName?: string;
    webhookUrl?: string;
    webhookSecret?: string;
  };
  filterPolicy?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublishedEventRecord {
  id: string;
  topicId: string;
  projectId: string;
  eventName: string;
  payload: any;
  metadata?: any;
  publishedAt: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  subscriptionId: string;
  projectId: string;
  eventId?: string;
  endpointUrl: string;
  status: "SUCCESS" | "FAILED" | "RETRYING";
  statusCode?: number;
  attempt: number;
  requestHeaders?: any;
  responseBody?: string;
  durationMs?: number;
  deliveredAt: string;
}

export interface PublishEventDto {
  eventName: string;
  payload: any;
  metadata?: Record<string, any>;
}
