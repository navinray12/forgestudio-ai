import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { verifyProjectAccess } from "../../modules/data-platform/common/project-access.js";
import { assertSafeUrl } from "../../utils/ssrf.guard.js";

const tag = z.object({ name: z.string().trim().max(100), id: z.string().trim().regex(/^(G|GT|AW|GTM)-[A-Z0-9]+$/) }).strict();
export const integrationSettingsSchema = z.object({
  googleTags: z.array(tag).max(10), googleMapsApiKey: z.string().trim().max(200).regex(/^[A-Za-z0-9_-]*$/),
  metaPixelId: z.string().trim().regex(/^\d{5,30}$|^$/), delayPixelConsent: z.boolean(),
  blockBots: z.boolean(), filterSpam: z.boolean(), recaptchaSiteKey: z.string().trim().max(200).regex(/^[A-Za-z0-9_-]*$/), recaptchaEnabled: z.boolean(),
  webhooks: z.array(z.object({ id: z.string().uuid(), url: z.string().url().max(2048), event: z.literal("form.submitted") }).strict()).max(20),
}).strict();
export type IntegrationSettings = z.infer<typeof integrationSettingsSchema>;
export const defaultIntegrationSettings: IntegrationSettings = { googleTags: [], googleMapsApiKey: "", metaPixelId: "", delayPixelConsent: false, blockBots: false, filterSpam: false, recaptchaSiteKey: "", recaptchaEnabled: false, webhooks: [] };
export function parseIntegrationSettings(input: unknown): IntegrationSettings {
  const parsed = integrationSettingsSchema.safeParse(input);
  if (!parsed.success) throw new AppError("Check tag IDs, Pixel ID, keys, and webhook URLs.", 400, "VALIDATION_ERROR");
  const settings = parsed.data;
  if ((settings.blockBots || settings.filterSpam) && (!process.env.TURNSTILE_SECRET_KEY || !process.env.TURNSTILE_SITE_KEY)) throw new AppError("Configure TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY on the server before enabling protection.", 409, "PROVIDER_NOT_CONFIGURED");
  if (settings.recaptchaEnabled && (!settings.recaptchaSiteKey || !process.env.RECAPTCHA_SECRET_KEY)) throw new AppError("Provide a reCAPTCHA site key and configure RECAPTCHA_SECRET_KEY on the server first.", 409, "PROVIDER_NOT_CONFIGURED");
  for (const hook of settings.webhooks) { if (new URL(hook.url).protocol !== "https:") throw new AppError("Webhook URLs must use HTTPS.", 400, "VALIDATION_ERROR"); assertSafeUrl(hook.url, "Webhook"); }
  return settings;
}
export async function siteIntegrationSettings(websiteId: string, actorId: string, input?: unknown) {
  if (!z.string().uuid().safeParse(websiteId).success) throw new AppError("Invalid website ID", 400, "VALIDATION_ERROR");
  const access = await verifyProjectAccess(websiteId, actorId);
  if (!access.canAdminister) throw new AppError("Only site owners and admins can manage integrations.", 403, "FORBIDDEN");
  if (input !== undefined) {
    const settings = parseIntegrationSettings(input);
    await prisma.$executeRaw`UPDATE websites SET "editorData"=jsonb_set(COALESCE("editorData",'{}'::jsonb),'{integrations}',${JSON.stringify(settings)}::jsonb), "documentVersion"="documentVersion"+1, "updatedAt"=now() WHERE id=${websiteId}::uuid`;
  }
  const website = await prisma.website.findUnique({ where: { id: websiteId }, select: { editorData: true } });
  if (!website) throw new AppError("Website not found", 404, "NOT_FOUND");
  const data: any = typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData;
  return { settings: { ...defaultIntegrationSettings, ...data?.integrations }, providers: { turnstileConfigured: Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY), recaptchaConfigured: Boolean(process.env.RECAPTCHA_SECRET_KEY) } };
}
export function publicIntegrationSettings(value: any) {
  if (!value || typeof value !== "object") return undefined;
  return { googleTags: value.googleTags || [], googleMapsApiKey: value.googleMapsApiKey || "", metaPixelId: value.metaPixelId || "", delayPixelConsent: Boolean(value.delayPixelConsent), recaptchaSiteKey: value.recaptchaEnabled ? value.recaptchaSiteKey : "", turnstileSiteKey: value.blockBots || value.filterSpam ? process.env.TURNSTILE_SITE_KEY || "" : "" };
}
export async function verifyIntegrationChallenges(settings: any, tokens: { turnstile?: string; recaptcha?: string }, ip?: string) {
  for (const provider of ["turnstile", "recaptcha"] as const) {
    const enabled = provider === "turnstile" ? settings?.blockBots || settings?.filterSpam : settings?.recaptchaEnabled;
    if (!enabled) continue;
    const secret = provider === "turnstile" ? process.env.TURNSTILE_SECRET_KEY : process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) throw new AppError("Form protection is not configured.", 503, "PROVIDER_NOT_CONFIGURED");
    const token = tokens[provider];
    if (!token || token.length > 4096) throw new AppError("Please complete the form verification.", 400, "CHALLENGE_REQUIRED");
    const response = await fetch(provider === "turnstile" ? "https://challenges.cloudflare.com/turnstile/v0/siteverify" : "https://www.google.com/recaptcha/api/siteverify", { method: "POST", body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }), signal: AbortSignal.timeout(10000) });
    const result = await response.json();
    if (!response.ok || !result.success) throw new AppError("Form verification failed. Please try again.", 400, "CHALLENGE_FAILED");
  }
}
