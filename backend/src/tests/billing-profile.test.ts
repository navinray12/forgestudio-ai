import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), membership: vi.fn() }));
vi.mock("../platform/tenancy/tenant-unit-of-work.js", () => ({
  requireOrganizationMembership: mocks.membership,
  withTenantTransaction: async (_scope: unknown, work: (client: unknown) => unknown) => work({ query: mocks.query }),
}));
import { billingProfile } from "../modules/billing/billing-profile.service.js";
const profile = { organizationName: "Test", companyName: "Test", billingEmail: "billing@example.com", taxId: "", address: "123 Main Street", phone: "+91 98765 43210", website: "https://example.com", paymentMethod: "bank" };
beforeEach(() => { vi.clearAllMocks(); mocks.membership.mockResolvedValue({ role: "OWNER" }); });
describe("organization billing profile", () => {
  it("loads organization defaults without writing", async () => {
    mocks.query.mockResolvedValue({ rows: [{ name: "Company", profile: null }] });
    expect(await billingProfile("org", "actor")).toMatchObject({ organizationName: "Company", paymentMethod: "card" });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it("persists validated preferences without changing subscriptions or unrelated settings", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ profile }] });
    expect(await billingProfile("org", "actor", profile)).toEqual(profile);
    expect(mocks.query.mock.calls[0][0]).toContain("jsonb_set");
    expect(mocks.query.mock.calls[0][1][0]).toBe("org");
    expect(JSON.parse(mocks.query.mock.calls[0][1][1])).toEqual(profile);
    expect(mocks.membership).toHaveBeenCalledWith(expect.anything(), "org", "actor", ["OWNER", "ADMIN"]);
  });
  it("denies unauthorized reads and writes before accessing profiles", async () => {
    mocks.membership.mockRejectedValue(new Error("Access denied"));
    await expect(billingProfile("other-org", "actor")).rejects.toThrow("Access denied");
    await expect(billingProfile("other-org", "actor", profile)).rejects.toThrow("Access denied");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it.each([{ billingEmail: "invalid" }, { website: "javascript:alert(1)" }, { paymentMethod: "cash" }, { companyName: " " }, { phone: "abcdef" }, { cardNumber: "4111111111111111" }])("rejects malformed or unexpected input %j", async patch => {
    await expect(billingProfile("org", "actor", { ...profile, ...patch })).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
