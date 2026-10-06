/**
 * ForgeStudio Module 42: Event Bus & Real-Time SSE Streamer
 */

import { EventEmitter } from "node:events";
import { Response } from "express";
import { prisma } from "../../../config/prisma.js";
import { AgentEventEntity, AgentEventType } from "./taskManager.types.js";

const db = prisma as any;

class EventBusService extends EventEmitter {
  private subscribers: Map<string, Set<Response>> = new Map();

  /**
   * Emit an agent event, persist in DB, and broadcast to SSE listeners
   */
  public async emitEvent(params: {
    projectId: string;
    taskId?: string;
    runId?: string;
    stepId?: string;
    agentId?: string;
    eventType: AgentEventType;
    payload?: Record<string, any>;
    correlationId?: string;
  }): Promise<AgentEventEntity> {
    const payload = params.payload || {};

    let eventRecord: any;
    try {
      eventRecord = await db.forgeAiEvent.create({
        data: {
          projectId: params.projectId,
          taskId: params.taskId || null,
          runId: params.runId || null,
          stepId: params.stepId || null,
          agentId: params.agentId || null,
          eventType: params.eventType,
          payload,
          correlationId: params.correlationId || null,
        },
      });
    } catch {
      eventRecord = {
        id: `evt-${Date.now()}`,
        ...params,
        payload,
        createdAt: new Date().toISOString(),
      };
    }

    // Broadcast to SSE stream subscribers for this run or project
    const eventData = JSON.stringify(eventRecord);
    if (params.runId) {
      const runSubs = this.subscribers.get(params.runId);
      if (runSubs) {
        for (const res of runSubs) {
          try {
            res.write(`data: ${eventData}\n\n`);
          } catch {}
        }
      }
    }

    const projSubs = this.subscribers.get(params.projectId);
    if (projSubs) {
      for (const res of projSubs) {
        try {
          res.write(`data: ${eventData}\n\n`);
        } catch {}
      }
    }

    return eventRecord;
  }

  /**
   * Register an SSE client response stream for a run or project
   */
  public addSubscriber(channelKey: string, res: Response): void {
    if (!this.subscribers.has(channelKey)) {
      this.subscribers.set(channelKey, new Set());
    }
    this.subscribers.get(channelKey)!.add(res);

    res.on("close", () => {
      this.subscribers.get(channelKey)?.delete(res);
      if (this.subscribers.get(channelKey)?.size === 0) {
        this.subscribers.delete(channelKey);
      }
    });
  }

  /**
   * Fetch recent event history for a run
   */
  public async getRunEvents(runId: string): Promise<AgentEventEntity[]> {
    return await db.forgeAiEvent.findMany({
      where: { runId },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
  }
}

export const eventBusService = new EventBusService();
