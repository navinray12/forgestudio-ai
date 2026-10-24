import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const h = vi.hoisted(() => ({ submissions: vi.fn() }));
vi.mock("../services/form/form.service.js", () => ({
  getWebsiteSubmissions: h.submissions,
}));

import { csvCell, exportSubmissionsHandler } from "../controllers/form.controller.js";

beforeEach(() => {
  vi.clearAllMocks();
  h.submissions.mockResolvedValue([]);
});

async function downloadCsv() {
  const req = {
    params: { websiteId: "00000000-0000-4000-8000-000000000001" },
    query: { format: "csv" },
  } as unknown as Request;
  const body = vi.fn();
  const setHeader = vi.fn();
  const status = vi.fn().mockReturnValue({ send: body });
  const res = {
    locals: { user: { id: "user-1" } },
    setHeader, status, send: body,
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  await exportSubmissionsHandler(req, res, next);
  return { csv: String(body.mock.calls[0]?.[0] ?? ""), next, setHeader };
}

describe("WP-04 form CSV export safety", () => {
  it.each([
    "=HYPERLINK(\"https://attacker.test\")",
    "+cmd|'/C calc'",
    "-1+2",
    "@SUM(A1:A2)",
    " \t=2+2",
    "\r\n=HYPERLINK(\"unsafe\")",
  ])("neutralizes spreadsheet formula values: %s", (input) => {
    const result = csvCell(input);
    expect(result.startsWith('\"\'')).toBe(true);
    expect(result).toContain(input.replace(/"/g, '""'));
  });

  it("escapes quotes, commas, line breaks, and object values", () => {
    expect(csvCell('Hello, "World"')).toBe('"Hello, ""World"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
    expect(csvCell(null)).toBe('""');
  });

  it("quotes untrusted form field keys and submitted values", async () => {
    h.submissions.mockResolvedValue([{
      id: "entry-1", formName: '=IMPORTXML("https://evil.test")',
      createdAt: "2026-10-24T12:00:00Z",
      data: { "=HYPERLINK": "+1+2", email: 'person,"name"@example.test' },
    }]);
    const { csv, next, setHeader } = await downloadCsv();
    expect(next).not.toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
    expect(csv).toContain('"\'=HYPERLINK"');
    expect(csv).toContain('"\'=IMPORTXML(""https://evil.test"")"');
    expect(csv).toContain('"\'+1+2"');
    expect(csv).toContain('"person,""name""@example.test"');
    expect(csv).not.toContain(',"=HYPERLINK"');
  });

  it("keeps a consistent header even when no submissions exist", async () => {
    const { csv } = await downloadCsv();
    expect(csv).toBe('"ID","Form Name","Submitted At"\n');
  });
});
