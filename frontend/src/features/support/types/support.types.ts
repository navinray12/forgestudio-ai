export type SupportTicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_CUSTOMER"
  | "CUSTOMER_REPLIED"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED";

export type SupportTicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT" | "CRITICAL";

export type SupportTicketSource = "WEB" | "EMAIL" | "API" | "SYSTEM";

export type SupportTicketMessageType = "PUBLIC_REPLY" | "INTERNAL_NOTE" | "SYSTEM_EVENT";

export interface SupportCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SupportTeamMember {
  id: string;
  teamId: string;
  userId: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
}

export interface SupportTeam {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  members?: SupportTeamMember[];
}

export interface SupportSlaPolicy {
  id: string;
  name: string;
  priority: SupportTicketPriority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  businessHoursEnabled: boolean;
  isActive: boolean;
}

export interface SupportTicketAttachment {
  id: string;
  ticketId: string;
  messageId?: string;
  uploadedById: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  type: SupportTicketMessageType;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
  attachments?: SupportTicketAttachment[];
}

export interface SupportTicketEvent {
  id: string;
  ticketId: string;
  actorId: string;
  eventType: string;
  oldValue?: string;
  newValue?: string;
  metadata?: any;
  createdAt: string;
  actor?: {
    id: string;
    fullName: string;
    role: string;
  };
}

export interface SupportCannedResponse {
  id: string;
  title: string;
  shortcut: string;
  content: string;
  categoryId?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportSavedView {
  id: string;
  userId: string;
  name: string;
  filters: any;
  isShared: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  workspaceId?: string;
  userId: string;
  websiteId?: string;
  categoryId: string;
  assignedTeamId?: string;
  assignedAgentId?: string;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  source: SupportTicketSource;
  slaPolicyId?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  reopenedAt?: string;
  slaDueAt?: string;
  slaPaused?: boolean;
  slaPausedAt?: string;
  slaBreached?: boolean;
  csatScore?: number;
  csatComment?: string;
  csatRatedAt?: string;
  isMerged?: boolean;
  mergedIntoTicketId?: string;
  parentTicketId?: string;
  tags?: string[];
  contextData?: any;
  wordpressContext?: any;
  environmentContext?: any;
  createdAt: string;
  updatedAt: string;

  user?: { id: string; fullName: string; email: string };
  assignedAgent?: { id: string; fullName: string; email: string; role?: string };
  assignedTeam?: { id: string; name: string };
  category?: SupportCategory;
  website?: { id: string; name: string; slug: string };
  workspace?: { id: string; name: string; slug: string };
  messages?: SupportTicketMessage[];
  attachments?: SupportTicketAttachment[];
  events?: SupportTicketEvent[];
  _count?: { messages: number; attachments: number };
  sla?: {
    status: "ON_TRACK" | "WARNING" | "BREACHED" | "COMPLETED";
    firstResponseDue: string;
    resolutionDue: string;
    isFirstResponseBreached: boolean;
    isResolutionBreached: boolean;
  };
}

export interface TicketSearchFilters {
  query?: string;
  status?: string | string[];
  priority?: string | string[];
  categoryId?: string;
  assignedAgentId?: string;
  assignedTeamId?: string;
  workspaceId?: string;
  websiteId?: string;
  userId?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface AnalyticsMetrics {
  totalTickets: number;
  newTickets: number;
  openTickets: number;
  inProgressTickets: number;
  waitingCustomerTickets: number;
  customerRepliedTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  reopenedTickets: number;
  avgFirstResponseMinutes: number;
  avgResolutionMinutes: number;
  slaCompliancePercentage: number;
  csatAverageScore?: number;
  csatCount?: number;
}
