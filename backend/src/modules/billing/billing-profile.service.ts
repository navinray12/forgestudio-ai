import { z } from "zod";
import { AppError } from "../../utils/app-error.js";
import { requireOrganizationMembership, withTenantTransaction } from "../../platform/tenancy/tenant-unit-of-work.js";

export const billingProfileSchema = z.object({
  organizationName: z.string().trim().min(1).max(255),
  billingEmail: z.string().trim().email().max(254),
  taxId: z.string().trim().max(100),
  companyName: z.string().trim().min(1).max(255),
  address: z.string().trim().min(1).max(500),
  phone: z.string().trim().min(5).max(40).regex(/^[+\d\s().-]+$/),
  website: z.union([z.literal(""), z.string().trim().max(2048).url().refine(value => ["http:", "https:"].includes(new URL(value).protocol))]),
  paymentMethod: z.enum(["card", "bank", "paypal"]),
}).strict();

export async function billingProfile(organizationId: string, actorId: string, input?: unknown) {
  let profile: z.infer<typeof billingProfileSchema> | undefined;
  if (input !== undefined) {
    const parsed = billingProfileSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Please provide valid billing details, email, phone, and website.", 400, "VALIDATION_ERROR");
    profile = parsed.data;
  }
  return withTenantTransaction({ organizationId, actorId }, async client => {
    await requireOrganizationMembership(client, organizationId, actorId, ["OWNER", "ADMIN"]);
    if (profile) {
      await client.query(`UPDATE organizations SET settings=jsonb_set(COALESCE(settings,'{}'::jsonb),'{billingProfile}',$2::jsonb), "updatedAt"=now() WHERE id=$1::uuid`, [organizationId, JSON.stringify(profile)]);
    }
    const result = await client.query(`SELECT name, settings->'billingProfile' AS profile FROM organizations WHERE id=$1::uuid`, [organizationId]);
    const row = result.rows[0];
    if (!row) throw new AppError("Organization not found", 404, "NOT_FOUND");
    return row.profile || { organizationName: row.name, billingEmail: "", taxId: "", companyName: row.name, address: "", phone: "", website: "", paymentMethod: "card" };
  });
}
