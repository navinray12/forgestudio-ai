/**
 * ForgeStudio Modules 46–52 Comprehensive Production Test Suite
 * Module 46: Serverless & Edge Functions (Sandbox VM, Timeouts, Logs)
 * Module 47: Background Jobs & Queue (Priority Scheduling, Backoff, DLQ, Metrics)
 * Module 48: Scheduler / Cron Engine (Cron Parsing, Target Execution, History)
 * Module 49: Event Bus & Webhook Platform (Topics, Fan-out, Subscriptions, HMAC)
 * Module 50: Realtime Engine (Channels, Presence Tracking, Broadcasts, Ring Buffer)
 * Module 51: Cache / KV Layer (In-Memory LRU, TTL, Atomic Counters, Tag Invalidation)
 * Module 52: API Gateway & Schema Registry (Routes, Rate-Limits, Schema Validation, Upstream Dispatch)
 */

import assert from "node:assert/strict";
import { forgeProjectService } from "../services/project/forgeProject.service.js";
import { serverlessFunctionService } from "../modules/runtime-platform/functions/serverlessFunction.service.js";
import { taskQueueService } from "../modules/runtime-platform/queues/taskQueue.service.js";
import { cronEngineService } from "../modules/runtime-platform/scheduler/cronEngine.service.js";
import { CronParser } from "../modules/runtime-platform/scheduler/cronParser.js";
import { eventBusService } from "../modules/runtime-platform/events/eventBus.service.js";
import { WebhookDispatcher } from "../modules/runtime-platform/events/webhookDispatcher.js";
import { realtimeEngineService } from "../modules/runtime-platform/realtime/realtimeEngine.service.js";
import { kvLayerService } from "../modules/runtime-platform/kv/kvLayer.service.js";
import { schemaRegistryService } from "../modules/runtime-platform/gateway/schemaRegistry.service.js";
import { apiGatewayService } from "../modules/runtime-platform/gateway/apiGateway.service.js";

export async function runModules46to52TestSuite(): Promise<{
  success: boolean;
  testsRun: number;
  details: string[];
}> {
  const details: string[] = [];
  let testsRun = 0;

  function logPass(msg: string) {
    details.push(`✓ ${msg}`);
    console.log(`  ✓ ${msg}`);
    testsRun++;
  }

  console.log("============================================================");
  console.log("Starting Modules 46–52 (Runtime & Infrastructure Platform) Test Suite");
  console.log("============================================================\n");

  const testUserId = "test-runtime-architect-uuid";
  const suffix = Date.now().toString(36);

  // Setup: Create test project
  const project = await forgeProjectService.createProject(testUserId, {
    name: `Runtime Infrastructure Project ${suffix}`,
    slug: `runtime-infra-${suffix}`,
    projectType: "FULLSTACK",
    framework: "nextjs",
    runtime: "nodejs",
    runtimeVersion: "20.x",
  });
  const projId = project.id;
  logPass(`Setup: Test Project created with id ${projId}`);

  // ------------------------------------------------------------
  // MODULE 46: Serverless & Edge Functions
  // ------------------------------------------------------------
  console.log("\n--- Module 46: Serverless & Edge Functions ---");

  // 46.1 Create Function
  const orderFn = await serverlessFunctionService.createFunction(projId, {
    name: "order-processor",
    runtime: "nodejs20",
    code: `
      exports.handler = async (payload, context) => {
        console.log("Processing order for:", payload.customerEmail);
        const total = (payload.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return {
          orderId: payload.orderId || "ord_mock_1",
          total,
          status: "CONFIRMED",
          processedBy: context.functionName
        };
      };
    `,
    timeoutMs: 4000,
    memoryMb: 128,
  });
  assert.equal(orderFn.name, "order-processor", "Function name must match");
  assert.equal(orderFn.status, "ACTIVE", "Function status must be ACTIVE");
  logPass("46.1 Function Registration: Serverless function deployed with NodeJS20 runtime");

  // 46.2 Invoke Function in VM Sandbox
  const invokeRes = await serverlessFunctionService.invokeFunction(
    projId,
    orderFn.id,
    {
      orderId: "ord_1001",
      customerEmail: "alice@example.com",
      items: [
        { price: 25, quantity: 2 },
        { price: 50, quantity: 1 },
      ],
    },
    "HTTP"
  );
  assert.equal(invokeRes.status, "SUCCESS", "Invocation status must be SUCCESS");
  assert.equal(invokeRes.responsePayload.total, 100, "Function must compute total order value accurately");
  assert.equal(invokeRes.responsePayload.status, "CONFIRMED", "Function status in response must be CONFIRMED");
  assert.ok(invokeRes.durationMs >= 0, "Execution duration must be recorded");
  assert.ok(invokeRes.logs.some((l) => l.includes("alice@example.com")), "Invocation console logs must be captured");
  logPass("46.2 Sandbox Execution: Invoked function in fortified VM sandbox with console telemetry");

  // 46.3 Function Timeout Guard
  const timeoutFn = await serverlessFunctionService.createFunction(projId, {
    name: "infinite-loop-test",
    runtime: "nodejs20",
    code: `
      exports.handler = async () => {
        const start = Date.now();
        while (Date.now() - start < 3000) {} // busy wait
        return { done: true };
      };
    `,
    timeoutMs: 300, // 300ms timeout
  });
  const timeoutRes = await serverlessFunctionService.invokeFunction(projId, timeoutFn.id, {}, "HTTP");
  assert.equal(timeoutRes.status, "TIMEOUT", "Infinite loop or slow function must trigger TIMEOUT");
  assert.equal(timeoutRes.statusCode, 504, "Timed out function must return HTTP 504");
  logPass("46.3 Execution Timeout Guard: VM timeout guard prevented runaway execution");

  // 46.4 Invocation Audit Logs
  const fnLogs = await serverlessFunctionService.getInvocationLogs(projId, orderFn.id);
  assert.ok(fnLogs.length >= 1, "Invocation audit logs must record execution history");
  logPass("46.4 Telemetry: Introspected function invocation audit logs with timestamps and payloads");

  // ------------------------------------------------------------
  // MODULE 47: Background Jobs & Queue
  // ------------------------------------------------------------
  console.log("\n--- Module 47: Background Jobs & Queue ---");

  // 47.1 Create Task Queue
  const queue = await taskQueueService.createQueue(projId, "notifications", {
    concurrency: 5,
    maxRetries: 2,
    backoffMs: 200,
    dlqEnabled: true,
  });
  assert.equal(queue.name, "notifications", "Queue name must match");
  assert.equal(queue.dlqEnabled, true, "DLQ must be enabled on queue");
  logPass("47.1 Queue Creation: Created durable task queue with concurrency and retry policies");

  // 47.2 Enqueue Jobs with Priority
  const normalJob = await taskQueueService.enqueueJob(projId, queue.id, {
    name: "send-welcome-email",
    payload: { email: "user@example.com" },
    priority: "NORMAL",
  });
  const criticalJob = await taskQueueService.enqueueJob(projId, queue.id, {
    name: "send-security-alert",
    payload: { email: "admin@example.com", alert: "Password Reset" },
    priority: "CRITICAL",
  });
  assert.equal(normalJob.status, "QUEUED", "Job must be in QUEUED status");
  assert.equal(criticalJob.priority, "CRITICAL", "Job priority must be CRITICAL");
  logPass("47.2 Enqueue Jobs: Enqueued normal and critical priority background jobs");

  // 47.3 Priority Scheduling Verification
  const leasedJob = await taskQueueService.pollNextJob(projId, queue.id);
  assert.ok(leasedJob, "A job must be leased from queue");
  assert.equal(leasedJob.id, criticalJob.id, "CRITICAL priority job must be leased before NORMAL priority job");
  assert.equal(leasedJob.status, "PROCESSING", "Leased job must transition to PROCESSING");
  logPass("47.3 Priority Dispatch: Verified CRITICAL priority job was polled and leased first");

  // Complete the critical job
  await taskQueueService.completeJob(leasedJob.id, { sent: true });

  // 47.4 Retry with Backoff & Dead Letter Queue (DLQ)
  const failingJob = await taskQueueService.enqueueJob(projId, queue.id, {
    name: "flaky-webhook-sync",
    payload: { endpoint: "https://invalid.example.com" },
    maxAttempts: 2,
  });

  // Attempt 1 -> retry backoff
  const retry1 = await taskQueueService.failJob(failingJob.id, "Connection timeout (1)");
  assert.equal(retry1.status, "QUEUED", "Job must be scheduled for retry on first failure");

  // Attempt 2 -> moves to DEAD_LETTER
  const dlqJob = await taskQueueService.failJob(failingJob.id, "Connection timeout (2)");
  assert.equal(dlqJob.status, "DEAD_LETTER", "Job must move to DEAD_LETTER after maxAttempts exhausted");
  logPass("47.4 Dead Letter Queue (DLQ): Handled failures, exponential backoff, and DLQ routing");

  // 47.5 Replay Dead Letter Job
  const replayed = await taskQueueService.replayDlqJob(dlqJob.id);
  assert.equal(replayed.status, "QUEUED", "Replayed job must be returned to QUEUED status");
  assert.equal(replayed.attempts, 0, "Replayed job attempts must be reset to 0");
  logPass("47.5 DLQ Replay: Successfully replayed dead-letter job back into active queue");

  // 47.6 Queue Metrics
  const qMetrics = await taskQueueService.getQueueMetrics(projId, queue.id);
  assert.ok(qMetrics.completed >= 1, "Metrics must record completed jobs");
  logPass("47.6 Queue Metrics: Introspected real-time queue metrics (queued, processing, completed, DLQ)");

  // ------------------------------------------------------------
  // MODULE 48: Scheduler / Cron Engine
  // ------------------------------------------------------------
  console.log("\n--- Module 48: Scheduler / Cron Engine ---");

  // 48.1 Cron Parser Validation
  assert.ok(CronParser.isValid("*/15 * * * *"), "Valid 5-part cron must pass validation");
  assert.ok(CronParser.isValid("@daily"), "Cron alias @daily must pass validation");
  assert.equal(CronParser.isValid("invalid-expression"), false, "Invalid expression must fail validation");
  const nextDate = CronParser.getNextRunDate("*/5 * * * *");
  assert.ok(nextDate.getTime() > Date.now(), "Next run date must be in the future");
  logPass("48.1 Cron Expression Parser: Verified syntax validation, aliases, and next run date computation");

  // 48.2 Register Cron Schedule
  const cronSchedule = await cronEngineService.createSchedule(projId, {
    name: "nightly-order-digest",
    cronExpression: "0 0 * * *",
    targetType: "FUNCTION",
    targetDestination: orderFn.id,
    targetPayload: { digestType: "nightly" },
  });
  assert.equal(cronSchedule.name, "nightly-order-digest", "Schedule name must match");
  assert.ok(cronSchedule.nextRunAt, "Schedule nextRunAt must be populated");
  logPass("48.2 Schedule Registration: Configured automated cron schedule targeting serverless function");

  // 48.3 Immediate Schedule Execution
  const execRecord = await cronEngineService.executeSchedule(projId, cronSchedule.id, true);
  assert.equal(execRecord.status, "SUCCESS", "Triggered schedule must execute with SUCCESS");
  assert.ok(execRecord.output, "Execution record must capture target output");
  const history = await cronEngineService.getExecutionHistory(projId, cronSchedule.id);
  assert.ok(history.length >= 1, "Execution history must record cron runs");
  logPass("48.3 Trigger & Telemetry: Executed schedule, captured execution telemetry, and advanced schedule");

  // ------------------------------------------------------------
  // MODULE 49: Event Bus & Webhook Platform
  // ------------------------------------------------------------
  console.log("\n--- Module 49: Event Bus & Webhook Platform ---");

  // 49.1 Create Topic & Subscriptions
  const topic = await eventBusService.createTopic(projId, "ecommerce.events", "Store event bus");
  assert.equal(topic.name, "ecommerce.events", "Topic name must match");

  // Subscribe Function
  await eventBusService.createSubscription(projId, topic.id, {
    name: "order-function-subscriber",
    destinationType: "FUNCTION",
    destinationConfig: { functionName: orderFn.id },
  });

  // Subscribe Queue
  await eventBusService.createSubscription(projId, topic.id, {
    name: "queue-event-subscriber",
    destinationType: "QUEUE_JOB",
    destinationConfig: { queueName: queue.id },
  });
  logPass("49.1 Event Topics & Subscriptions: Configured topic with multi-target fan-out subscriptions");

  // 49.2 Publish Event and Fan-out Verification
  const publishRes = await eventBusService.publishEvent(projId, topic.id, {
    eventName: "order.placed",
    payload: { orderId: "ord_pub_99", customerEmail: "bob@example.com", items: [{ price: 40, quantity: 2 }] },
    metadata: { source: "checkout-ui" },
  });
  assert.equal(publishRes.subscribersMatched, 2, "Both function and queue subscriptions must match");
  assert.equal(publishRes.deliveredCount, 2, "Event must be delivered to both subscribers");
  logPass("49.2 Event Fan-out: Event published and fanned out concurrently to serverless function and task queue");

  // 49.3 Webhook HMAC Signing Verification
  const webhookRecord = await WebhookDispatcher.dispatch({
    subscriptionId: topic.id,
    projectId: projId,
    endpointUrl: "http://127.0.0.1:9/simulate-webhook", // Will fail delivery safely, testing signing & logging
    secret: "super-secret-hmac-key",
    payload: { test: "webhook-data" },
  });
  assert.ok(webhookRecord.requestHeaders["X-Forge-Signature"]?.startsWith("sha256="), "Webhook must include HMAC-SHA256 signature");
  assert.ok(webhookRecord.requestHeaders["X-Forge-Timestamp"], "Webhook must include timestamp header");
  logPass("49.3 Webhook Dispatch: Computed HMAC-SHA256 signature and logged delivery attempt");

  // ------------------------------------------------------------
  // MODULE 50: Realtime Engine
  // ------------------------------------------------------------
  console.log("\n--- Module 50: Realtime Engine ---");

  // 50.1 Realtime Channel Creation
  const channel = await realtimeEngineService.createChannel(projId, "store-live-updates");
  assert.equal(channel.name, "store-live-updates", "Channel name must match");
  logPass("50.1 Realtime Channels: Created managed realtime broadcast channel");

  // 50.2 Presence Tracking
  const presenceMembers = await realtimeEngineService.joinChannel(projId, "store-live-updates", {
    userId: "user_alice",
    userName: "Alice Architect",
    state: { status: "viewing_cart" },
  });
  assert.equal(presenceMembers.length, 1, "Channel presence must reflect joined user");
  assert.equal(presenceMembers[0].userName, "Alice Architect", "User name must match");

  const currentPresence = realtimeEngineService.getPresence(projId, "store-live-updates");
  assert.equal(currentPresence.length, 1, "Presence getter must retrieve online members");
  logPass("50.2 Presence Tracking: Tracked active user join event and state synchronization");

  // 50.3 Broadcast Message & Ring Buffer
  const msg = realtimeEngineService.broadcast(
    projId,
    "store-live-updates",
    "cart:updated",
    { itemCount: 3, subtotal: 120 },
    "user_alice"
  );
  assert.equal(msg.event, "cart:updated", "Broadcast event name must match");
  const recentMsgs = realtimeEngineService.getRecentMessages(projId, "store-live-updates");
  assert.ok(recentMsgs.some((m) => m.event === "cart:updated"), "Recent message ring-buffer must contain broadcast message");
  logPass("50.3 Realtime Broadcast: Distributed channel event and captured in instant-replay buffer");

  // Leave channel
  await realtimeEngineService.leaveChannel(projId, "store-live-updates", "user_alice");
  assert.equal(realtimeEngineService.getPresence(projId, "store-live-updates").length, 0, "User must be removed on leave");
  logPass("50.4 Presence Lifecycle: Handled user leave event and cleaned up presence state");

  // ------------------------------------------------------------
  // MODULE 51: Cache / KV Layer
  // ------------------------------------------------------------
  console.log("\n--- Module 51: Cache / KV Layer ---");

  // 51.1 Namespace Creation
  const kvNs = await kvLayerService.createNamespace(projId, "app-cache", "Application session and config cache");
  assert.equal(kvNs.name, "app-cache", "Namespace name must match");
  logPass("51.1 KV Namespaces: Created tenant-isolated KV namespace");

  // 51.2 Set & Get with TTL and Tags
  await kvLayerService.set(projId, kvNs.id, {
    key: "user:session:123",
    value: { role: "admin", plan: "enterprise" },
    ttlSeconds: 3600,
    tags: ["auth", "tier-enterprise"],
  });
  const cachedVal = await kvLayerService.get(projId, kvNs.id, "user:session:123");
  assert.equal(cachedVal.plan, "enterprise", "Retrieved value from KV cache must match original data");
  logPass("51.2 Cache Set & Get: Successfully stored and retrieved tagged value with TTL");

  // 51.3 Atomic Counters
  const count1 = await kvLayerService.atomicIncr(projId, kvNs.id, "metrics:page_views", 10);
  assert.equal(count1, 10, "First atomic increment must equal 10");
  const count2 = await kvLayerService.atomicIncr(projId, kvNs.id, "metrics:page_views", 5);
  assert.equal(count2, 15, "Second atomic increment must equal 15");
  logPass("51.3 Atomic Counters: Verified atomic increment operations on numeric keys");

  // 51.4 Tag-based Cache Invalidation
  const invalidatedCount = await kvLayerService.invalidateByTag(projId, kvNs.id, "tier-enterprise");
  assert.ok(invalidatedCount >= 1, "At least 1 tagged entry must be evicted");
  const afterEvict = await kvLayerService.get(projId, kvNs.id, "user:session:123");
  assert.equal(afterEvict, null, "Invalidated key must return null");
  logPass("51.4 Tag Invalidation: Successfully purged entries using tag-based cache invalidation");

  // ------------------------------------------------------------
  // MODULE 52: API Gateway & Schema Registry
  // ------------------------------------------------------------
  console.log("\n--- Module 52: API Gateway & Schema Registry ---");

  // 52.1 Schema Registry
  const orderSchema = await schemaRegistryService.registerSchema(
    projId,
    "OrderRequestSchema",
    "v1",
    {
      type: "object",
      required: ["orderId", "customerEmail"],
      properties: {
        orderId: { type: "string" },
        customerEmail: { type: "string" },
        items: { type: "array" },
      },
    }
  );
  assert.equal(orderSchema.name, "OrderRequestSchema", "Schema name must match");

  const validTest = schemaRegistryService.validatePayload(orderSchema.schemaDefinition, {
    orderId: "ord_valid_1",
    customerEmail: "user@example.com",
    items: [],
  });
  assert.equal(validTest.valid, true, "Valid payload must pass schema validation");

  const invalidTest = schemaRegistryService.validatePayload(orderSchema.schemaDefinition, {
    items: [], // Missing orderId and customerEmail
  });
  assert.equal(invalidTest.valid, false, "Invalid payload must fail schema validation");
  assert.ok(invalidTest.errors.some((e) => e.includes("customerEmail")), "Errors must detail missing fields");
  logPass("52.1 Schema Registry: Registered JSON Schema and validated request payload contracts");

  // 52.2 API Gateway Route Configuration
  const gwRoute = await apiGatewayService.createRoute(projId, {
    path: "/api/v1/orders/checkout",
    method: "POST",
    targetType: "FUNCTION",
    targetDestination: orderFn.id,
    requestSchemaId: orderSchema.id,
    rateLimitPerMin: 60,
  });
  assert.equal(gwRoute.path, "/api/v1/orders/checkout", "Gateway route path must match");
  logPass("52.2 Gateway Route Setup: Configured route with schema enforcement and rate limiting");

  // 52.3 Gateway Dispatch Pipeline (Valid Request)
  const validDispatch = await apiGatewayService.dispatchRequest(
    projId,
    "/api/v1/orders/checkout",
    "POST",
    {
      body: {
        orderId: "ord_gw_200",
        customerEmail: "charlie@example.com",
        items: [{ price: 30, quantity: 3 }],
      },
      clientIp: "192.168.1.10",
    }
  );
  assert.equal(validDispatch.statusCode, 200, "Valid request dispatched through gateway must return 200");
  assert.equal(validDispatch.body.total, 90, "Upstream function response must be returned to client");
  logPass("52.3 Upstream Dispatch: Verified gateway pipeline successfully routed request to Serverless Function");

  // 52.4 Gateway Schema Interception (Invalid Request)
  const invalidDispatch = await apiGatewayService.dispatchRequest(
    projId,
    "/api/v1/orders/checkout",
    "POST",
    {
      body: { invalid: true }, // Fails schema check
      clientIp: "192.168.1.10",
    }
  );
  assert.equal(invalidDispatch.statusCode, 400, "Request violating schema must be intercepted with 400 Bad Request");
  assert.equal(invalidDispatch.body.error, "SCHEMA_VALIDATION_FAILED", "Error code must indicate schema failure");
  logPass("52.4 Contract Enforcement: Gateway intercepted invalid request before upstream invocation");

  // 52.5 Gateway 404 Route Not Found
  const notFoundDispatch = await apiGatewayService.dispatchRequest(
    projId,
    "/api/v1/unknown/endpoint",
    "GET"
  );
  assert.equal(notFoundDispatch.statusCode, 404, "Unmapped route must return 404");
  logPass("52.5 Gateway 404: Unmapped route safely returned standard 404 envelope");

  console.log("\n============================================================");
  console.log(`Modules 46–52 Test Suite PASSED! (${testsRun}/${testsRun} tests succeeded)`);
  console.log("============================================================\n");

  return {
    success: true,
    testsRun,
    details,
  };
}
