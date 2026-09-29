import path from "path";
import express, { type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { protectCookieMutations } from "./middlewares/browser-origin.js";

import {
  loginRoutes,
  signupRoutes,
  authRoutes,
  oauthRoutes,
  meRoutes,
  subscriptionRoutes,
  websiteRoutes,
  teamRoutes,
  uploadRoutes,
  apiKeysRoutes,
  developerRoutes,
  composerRoutes,
  customPostTypeRoutes,
  customCodeRoutes,
  pluginCompatRoutes,
  designNotesRoutes,
  componentAccessRoutes,
  templateRoutes,
  formRoutes,
  integrationRoutes,
  sftpRoutes,
  pluginIntegrationRoutes,
  multisiteRoutes,
  designTokenRoutes,
  designSystemRoutes,
  commerceRoutes,
  enterpriseMultisiteRoutes,
  licenseRoutes,
  whitelabelRoutes,
  usageRoutes,
  stagingRoutes,
  serverConfigRoutes,
  hostingRoutes,
  performanceRoutes,
  imageOptimizationRoutes,
  aiHostingRoutes,
  elementorCloudRoutes,
  exportRoutes,
} from "./routes/index.js";

import identityRoutes from "./modules/identity/http/oidc.routes.js";
import apiV1Routes from "./routes/api-v1.routes.js";
import tenantWorkspaceRoutes from "./routes/tenant-workspace.routes.js";
import operationsRoutes from "./routes/operations.routes.js";
import auditLogRoutes from "./routes/auditLog.routes.js";
import mediaRoutes from "./routes/media.routes.js";
import { downloadWordPressPluginHandler } from "./controllers/wordpress.controller.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import healthRoutes from "./routes/health.routes.js";
import mailerRoutes from "./routes/mailer.routes.js";
import clientBillingRoutes from "./routes/clientBilling.routes.js";
import experimentRoutes from "./routes/experiment.routes.js";
import organizationBillingRoutes from "./modules/billing/http/routes.js";
import billingWebhookRoutes from "./modules/billing/http/webhook.routes.js";
import platformControlRoutes from "./platform/control/routes.js";
import platformAuthRoutes from "./routes/platform-auth.routes.js";
import organizationFileRoutes from "./modules/files/http/routes.js";
import connectorCredentialRoutes from "./platform/integrations/connector-credential.routes.js";
import { rateLimit } from "express-rate-limit";
import saasOrganizationBillingRoutes, { billingWebhookRouter } from "./services/billing/billing.routes.js";
import governedFileRoutes from "./services/files/file.routes.js";
import integrationSecretRoutes from "./services/integrations/secret-reference.routes.js";
import saasPlatformControlRoutes from "./services/control/control.routes.js";
import tenantCapabilityRoutes from "./services/capabilities/tenant-capabilities.routes.js";
import aiRoutes from "./routes/ai.routes.js";

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many authentication requests, please try again after 15 minutes.",
    },
  },
});

/** Composition boundary: tests can supply a delivery-backed identity router without
 * changing any production route or enabling a bypass through configuration. */
export function createApplication(
  localIdentityRouter: express.Router = loginRoutes,
  managedIdentityRouter: express.Router = identityRoutes,
) {
const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

// Billing provider signatures are calculated over exact raw bytes. Mount this
// route before any JSON parser; successful verification never trusts a body-supplied tenant alone.
app.use("/api/v1/billing/webhooks/stripe", express.raw({ type: "application/json", limit: "256kb" }), billingWebhookRoutes);
// SaaS qualification ingress remains available on its versioned legacy path.
app.use("/api/v1/billing/webhooks", express.raw({ type: "application/json", limit: "256kb" }), billingWebhookRouter);

const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "10mb";
app.use(["/api/v1/auth", "/api/auth"], (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); },
  express.json({ limit: "16kb" }));
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));
app.use(cookieParser());
app.use(protectCookieMutations);


app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
  });
});

// Auth & Session Rate Limiting (F-439)
app.use("/api/v1/auth/login", authRateLimiter);
app.use("/api/auth/login", authRateLimiter);
app.use("/api/v1/auth/signup", authRateLimiter);
app.use("/api/auth/signup", authRateLimiter);

// Auth & Session
app.use("/api/v1/auth", managedIdentityRouter);
app.use("/api/v1/auth", localIdentityRouter);
app.use("/api/v1/auth", signupRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/v1/auth", oauthRoutes);
app.use("/api/v1/auth", meRoutes);

// Organization-scoped commercial SaaS boundary. Legacy user subscriptions remain
// available during migration but cannot be used to bypass verified provider state.
app.use("/api/v1/organizations/:organizationId/billing", organizationBillingRoutes);

// SaaS foundation routes that do not overlap the consolidated billing module.
app.use("/api/v1/organizations", integrationSecretRoutes);
app.use("/api/v1/organizations", tenantCapabilityRoutes);
app.use("/api/v1/files", governedFileRoutes);
app.use("/platform/v1", saasPlatformControlRoutes);

// Platform-control session upgrade uses a distinct cookie/audience and requires
// recent phishing-resistant OIDC from an already authenticated privileged user.
app.use("/api/v1/platform-auth", platformAuthRoutes);

// Separate privileged control-plane namespace. The router additionally requires a
// PLATFORM audience session and privileged role.
app.use("/api/v1/platform", platformControlRoutes);

// Subscriptions, Licensing, Whitelabel & Usage (F-440 to F-452)
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/v1/licenses", licenseRoutes);
app.use("/api/licenses", licenseRoutes);
app.use("/api/v1/agency", whitelabelRoutes);
app.use("/api/agency", whitelabelRoutes);
app.use("/api/v1/users/me", usageRoutes);
app.use("/api/users/me", usageRoutes);

// Workspace commands have their own validated scope and idempotency contract.
app.use("/api/v1/tenant-workspaces", tenantWorkspaceRoutes);

// Public API v1 Standardized Endpoints
app.use("/api/v1", apiV1Routes);

// Websites & Workspace
app.use("/api/v1/websites", websiteRoutes);
app.use("/api/websites", websiteRoutes);
app.use("/api/v1/websites", mailerRoutes);
app.use("/api/websites", mailerRoutes);
app.use("/api/v1/websites", clientBillingRoutes);
app.use("/api/websites", clientBillingRoutes);
app.use("/api/v1/websites", experimentRoutes);
app.use("/api/websites", experimentRoutes);
app.use("/api/v1/teams", teamRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/v1/workspaces", teamRoutes);
app.use("/api/workspaces", teamRoutes);

// Organization-scoped, quarantine-first object storage API.
app.use("/api/v1/organizations/:organizationId/files", organizationFileRoutes);

// Governed connector credential references. Secret values are never returned by this API.
app.use("/api/v1/organizations/:organizationId/connectors/credentials", connectorCredentialRoutes);

// Media & Uploads
app.use("/api/v1/uploads", uploadRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/v1/media", mediaRoutes);
app.use("/api/media", mediaRoutes);

// API Keys & Developer Access
app.use("/api/v1/apikeys", apiKeysRoutes);
app.use("/api/apikeys", apiKeysRoutes);
app.use("/api/v1/developer", developerRoutes);
app.use("/api/developer", developerRoutes);

// Editor & Custom Content
app.use("/api/v1/composer", composerRoutes);
app.use("/api/composer", composerRoutes);
app.use("/api/v1/cpt", customPostTypeRoutes);
app.use("/api/cpt", customPostTypeRoutes);
app.use("/api/v1/custom-code", customCodeRoutes);
app.use("/api/custom-code", customCodeRoutes);
app.use("/api/v1/design-notes", designNotesRoutes);
app.use("/api/design-notes", designNotesRoutes);
app.use("/api/v1/component-access", componentAccessRoutes);
app.use("/api/component-access", componentAccessRoutes);



app.use("/api/v1/templates", templateRoutes);
app.use("/api/templates", templateRoutes);

// Forms: public submission + protected owner operations are enforced by the router.
app.use("/api/v1/forms", formRoutes);
app.use("/api/forms", formRoutes);

// Plugin compatibility and integrations.
app.get("/api/v1/plugins/wordpress/download", downloadWordPressPluginHandler);
app.get("/api/plugins/wordpress/download", downloadWordPressPluginHandler);
app.use("/api/v1/plugins", pluginCompatRoutes);
app.use("/api/plugins", pluginCompatRoutes);
app.use("/api/v1/plugins-integration", pluginIntegrationRoutes);
app.use("/api/plugins-integration", pluginIntegrationRoutes);

// Deployment, multisite and external integrations.
app.use("/api/v1/sftp", sftpRoutes);
app.use("/api/sftp", sftpRoutes);
app.use("/api/v1/multisite", multisiteRoutes);
app.use("/api/multisite", multisiteRoutes);
app.use("/api/v1/integrations", integrationRoutes);
app.use("/api/integrations", integrationRoutes);

// Phase 17: Design System / Tokens
app.use("/api/v1/websites", designTokenRoutes);
app.use("/api/websites", designTokenRoutes);

// Phase 18: E-Commerce & WooCommerce Parity
app.use("/api/v1/websites", commerceRoutes);
app.use("/api/websites", commerceRoutes);

// Phase 19: Custom Domains & Backups
app.use("/api/v1/websites", enterpriseMultisiteRoutes);
app.use("/api/websites", enterpriseMultisiteRoutes);

// Staging Sandbox Environments
app.use("/api/v1/websites", stagingRoutes);
app.use("/api/websites", stagingRoutes);

// Server Resources & SFTP Configuration
app.use("/api/v1/websites", serverConfigRoutes);
app.use("/api/websites", serverConfigRoutes);

// Security, Privacy, Cache, Transfer & Hosting Logs
app.use("/api/v1/websites", hostingRoutes);
app.use("/api/websites", hostingRoutes);
app.use("/api/v1/websites", performanceRoutes);
app.use("/api/websites", performanceRoutes);
app.use("/api/v1/websites", imageOptimizationRoutes);
app.use("/api/websites", imageOptimizationRoutes);
app.use("/api/v1/websites", designSystemRoutes);
app.use("/api/websites", designSystemRoutes);
app.use("/api/v1/websites", aiHostingRoutes);
app.use("/api/websites", aiHostingRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/ai", aiRoutes);

// Elementor Cloud Managed Hosting Bundles (X-804)
app.use("/api/v1/elementor-cloud", elementorCloudRoutes);
app.use("/api/elementor-cloud", elementorCloudRoutes);

// Code Generation, Multi-Format Exporters & Hello Theme (F-745 to F-755, X-786)
app.use("/api/v1/websites", exportRoutes);
app.use("/api/websites", exportRoutes);
app.use("/api/v1/plugins/wordpress", exportRoutes);
app.use("/api/plugins/wordpress", exportRoutes);

// Audit Logs
app.use("/api/v1/audit-logs", auditLogRoutes);
app.use("/api/audit-logs", auditLogRoutes);

// Operations, Automation & Monitoring
app.use("/api/v1/operations", operationsRoutes);
app.use("/api/operations", operationsRoutes);
app.get("/api/health", (_req, res) => {
  res.redirect("/api/operations/health");
});

// Phase 20: Production Health & Canary
app.use("/api", healthRoutes);

app.use(errorMiddleware);

return app;
}

export default createApplication();
