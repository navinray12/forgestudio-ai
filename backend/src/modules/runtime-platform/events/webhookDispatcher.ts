/**
 * Module 49: Outgoing Webhook Dispatcher
 * Signs payloads with HMAC-SHA256 and captures delivery telemetry.
 */

import crypto from "node:crypto";
import { prisma } from "../../../config/prisma.js";
import { WebhookDeliveryRecord } from "./events.types.js";

export interface DispatchWebhookOptions {
  subscriptionId: string;
  projectId: string;
  eventId?: string;
  endpointUrl: string;
  secret?: string;
  payload: any;
}

export class WebhookDispatcher {
  /**
   * Dispatches an HTTP webhook with HMAC-SHA256 signature and records delivery
   */
  public static async dispatch(options: DispatchWebhookOptions): Promise<WebhookDeliveryRecord> {
    const { subscriptionId, projectId, eventId, endpointUrl, secret = "forge-webhook-default-secret", payload } = options;
    const bodyStr = JSON.stringify(payload);
    const timestamp = new Date().toISOString();

    // Compute HMAC-SHA256 signature
    const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${bodyStr}`).digest("hex");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Forge-Timestamp": timestamp,
      "X-Forge-Signature": `sha256=${signature}`,
      "User-Agent": "ForgeStudio-Webhook-Engine/1.0",
    };

    const startTime = Date.now();
    let status: "SUCCESS" | "FAILED" = "SUCCESS";
    let statusCode = 200;
    let responseBody = "";

    try {
      const resp = await fetch(endpointUrl, {
        method: "POST",
        headers,
        body: bodyStr,
      });

      statusCode = resp.status;
      responseBody = (await resp.text().catch(() => "")).slice(0, 1000);

      if (!resp.ok) {
        status = "FAILED";
      }
    } catch (err: any) {
      status = "FAILED";
      statusCode = 500;
      responseBody = err.message || "Network delivery error";
    }

    const durationMs = Date.now() - startTime;

    // Record delivery in database
    const delivery = await (prisma as any).forgeWebhookDelivery.create({
      data: {
        subscriptionId,
        projectId,
        eventId: eventId || null,
        endpointUrl,
        status,
        statusCode,
        attempt: 1,
        requestHeaders: headers,
        responseBody,
        durationMs,
        deliveredAt: new Date(),
      },
    });

    return delivery;
  }
}
