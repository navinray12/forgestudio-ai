/**
 * Module 50: Realtime Engine Service
 * Manages Channels, Presence tracking, and Broadcast Event Distribution.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  RealtimeChannelConfig,
  RealtimePresenceUser,
  RealtimeMessage,
} from "./realtime.types.js";

export class RealtimeEngineService {
  // In-memory presence tracker: `${projectId}:${channelName}` -> Map<userId, RealtimePresenceUser>
  private presenceStore: Map<string, Map<string, RealtimePresenceUser>> = new Map();

  // In-memory recent message ring buffer: `${projectId}:${channelName}` -> RealtimeMessage[]
  private messageBuffer: Map<string, RealtimeMessage[]> = new Map();

  /**
   * Create or configure a realtime channel
   */
  public async createChannel(
    projectId: string,
    name: string,
    options: {
      isPrivate?: boolean;
      presenceEnabled?: boolean;
      authPolicy?: string;
    } = {}
  ): Promise<RealtimeChannelConfig> {
    const channel = await (prisma as any).forgeRealtimeChannel.create({
      data: {
        projectId,
        name,
        isPrivate: options.isPrivate || false,
        presenceEnabled: options.presenceEnabled ?? true,
        authPolicy: options.authPolicy || "ALLOW_ALL",
      },
    });

    return channel;
  }

  /**
   * List channels for a project
   */
  public async listChannels(projectId: string): Promise<RealtimeChannelConfig[]> {
    return (prisma as any).forgeRealtimeChannel.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Get channel by name or ID
   */
  public async getChannel(projectId: string, channelNameOrId: string): Promise<RealtimeChannelConfig> {
    const channel = await (prisma as any).forgeRealtimeChannel.findFirst({
      where: {
        projectId,
        OR: [{ id: channelNameOrId }, { name: channelNameOrId }],
      },
    });

    if (!channel) {
      throw new AppError(`Channel '${channelNameOrId}' not found`, 404);
    }

    return channel;
  }

  /**
   * Join a channel and track user presence
   */
  public async joinChannel(
    projectId: string,
    channelName: string,
    user: {
      userId: string;
      userName: string;
      state?: Record<string, any>;
    }
  ): Promise<RealtimePresenceUser[]> {
    const key = `${projectId}:${channelName}`;
    if (!this.presenceStore.has(key)) {
      this.presenceStore.set(key, new Map());
    }

    const channelUsers = this.presenceStore.get(key)!;
    const presenceUser: RealtimePresenceUser = {
      userId: user.userId,
      userName: user.userName,
      joinedAt: new Date().toISOString(),
      state: user.state || {},
    };

    channelUsers.set(user.userId, presenceUser);
    return Array.from(channelUsers.values());
  }

  /**
   * Leave a channel
   */
  public async leaveChannel(
    projectId: string,
    channelName: string,
    userId: string
  ): Promise<void> {
    const key = `${projectId}:${channelName}`;
    const channelUsers = this.presenceStore.get(key);
    if (channelUsers) {
      channelUsers.delete(userId);
    }
  }

  /**
   * Get presence list for a channel
   */
  public getPresence(projectId: string, channelName: string): RealtimePresenceUser[] {
    const key = `${projectId}:${channelName}`;
    const channelUsers = this.presenceStore.get(key);
    return channelUsers ? Array.from(channelUsers.values()) : [];
  }

  /**
   * Broadcast message to a channel
   */
  public broadcast(
    projectId: string,
    channelName: string,
    event: string,
    data: any,
    senderId?: string
  ): RealtimeMessage {
    const message: RealtimeMessage = {
      channel: channelName,
      event,
      data,
      senderId,
      timestamp: new Date().toISOString(),
    };

    const key = `${projectId}:${channelName}`;
    if (!this.messageBuffer.has(key)) {
      this.messageBuffer.set(key, []);
    }

    const buf = this.messageBuffer.get(key)!;
    buf.push(message);
    if (buf.length > 50) {
      buf.shift(); // Keep latest 50 messages
    }

    return message;
  }

  /**
   * Get recent messages for a channel
   */
  public getRecentMessages(projectId: string, channelName: string, limit = 20): RealtimeMessage[] {
    const key = `${projectId}:${channelName}`;
    const buf = this.messageBuffer.get(key) || [];
    return buf.slice(-Math.min(50, Math.max(1, limit)));
  }
}

export const realtimeEngineService = new RealtimeEngineService();
