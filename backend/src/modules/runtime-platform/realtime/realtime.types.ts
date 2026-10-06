/**
 * Module 50: Realtime Engine Types
 */

export interface RealtimeChannelConfig {
  id: string;
  projectId: string;
  name: string;
  isPrivate: boolean;
  presenceEnabled: boolean;
  authPolicy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RealtimePresenceUser {
  userId: string;
  userName: string;
  joinedAt: string;
  state: Record<string, any>;
}

export interface RealtimeMessage {
  channel: string;
  event: string;
  data: any;
  senderId?: string;
  timestamp: string;
}
