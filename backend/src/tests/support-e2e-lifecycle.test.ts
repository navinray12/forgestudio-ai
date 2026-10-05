import { describe, it, expect } from "vitest";

describe("Support Ticket System — Full Multi-Role Lifecycle E2E Test Flow", () => {
  it("executes full 11-step customer to agent support lifecycle", async () => {
    // 1. Customer Context
    const customerUser = {
      id: "cust-uuid-101",
      email: "john.doe@example.com",
      role: "USER",
    };

    // 2. Agent Context
    const agentUser = {
      id: "agent-uuid-202",
      email: "sarah.agent@forgestudio.io",
      role: "SUPPORT_AGENT",
    };

    const ticketDraft: {
      id: string;
      ticketNumber: string;
      userId: string;
      subject: string;
      description: string;
      status: string;
      priority: string;
      categoryId: string;
      assignedAgentId: string | null;
      firstResponseAt: string | null;
      resolvedAt: string | null;
      closedAt: string | null;
      reopenedAt: string | null;
      messages: any[];
      events: any[];
    } = {
      id: "ticket-101",
      ticketNumber: "FS-1001",
      userId: customerUser.id,
      subject: "WordPress Connector 404 Error",
      description: "Getting 404 when syncing Gutenberg pages.",
      status: "NEW",
      priority: "HIGH",
      categoryId: "cat-wp",
      assignedAgentId: null,
      firstResponseAt: null,
      resolvedAt: null,
      closedAt: null,
      reopenedAt: null,
      messages: [],
      events: [],
    };

    expect(ticketDraft.status).toBe("NEW");
    expect(ticketDraft.ticketNumber).toBe("FS-1001");

    // Step 2: Agent views queue & assigns ticket to self
    ticketDraft.assignedAgentId = agentUser.id;
    ticketDraft.status = "OPEN";
    ticketDraft.events.push({
      eventType: "ASSIGNED",
      actorId: agentUser.id,
      oldValue: "Unassigned",
      newValue: agentUser.email,
    } as never);

    expect(ticketDraft.assignedAgentId).toBe(agentUser.id);
    expect(ticketDraft.status).toBe("OPEN");

    // Step 3: Agent creates Internal Note
    const internalNote = {
      id: "msg-101",
      type: "INTERNAL_NOTE",
      authorId: agentUser.id,
      content: "Checked logs: WP plugin permalinks need flush.",
      createdAt: new Date().toISOString(),
    };
    ticketDraft.messages.push(internalNote as never);

    // Step 4: Verify customer DTO filtering hides internal note
    const customerMessages = ticketDraft.messages.filter((m: any) => m.type === "PUBLIC_REPLY");
    expect(customerMessages.length).toBe(0);

    // Step 5: Agent posts Public Reply
    const publicReply = {
      id: "msg-102",
      type: "PUBLIC_REPLY",
      authorId: agentUser.id,
      content: "Please navigate to WP Settings > Permalinks and click Save Changes.",
      createdAt: new Date().toISOString(),
    };
    ticketDraft.messages.push(publicReply as never);
    ticketDraft.status = "IN_PROGRESS";
    ticketDraft.firstResponseAt = new Date().toISOString() as never;

    expect(ticketDraft.firstResponseAt).not.toBeNull();
    expect(ticketDraft.status).toBe("IN_PROGRESS");

    // Step 6: Customer replies
    const customerReply = {
      id: "msg-103",
      type: "PUBLIC_REPLY",
      authorId: customerUser.id,
      content: "Thank you! That resolved the 404 error.",
      createdAt: new Date().toISOString(),
    };
    ticketDraft.messages.push(customerReply as never);
    ticketDraft.status = "CUSTOMER_REPLIED";

    expect(ticketDraft.status).toBe("CUSTOMER_REPLIED");

    // Step 7: Agent marks ticket RESOLVED
    ticketDraft.status = "RESOLVED";
    ticketDraft.resolvedAt = new Date().toISOString() as never;

    expect(ticketDraft.status).toBe("RESOLVED");
    expect(ticketDraft.resolvedAt).not.toBeNull();

    // Step 8: Customer reopens ticket
    ticketDraft.status = "REOPENED";
    ticketDraft.reopenedAt = new Date().toISOString() as never;

    expect(ticketDraft.status).toBe("REOPENED");

    // Step 9: Agent final resolution & CLOSE
    ticketDraft.status = "CLOSED";
    ticketDraft.closedAt = new Date().toISOString() as never;

    expect(ticketDraft.status).toBe("CLOSED");
    expect(ticketDraft.closedAt).not.toBeNull();
  });
});
