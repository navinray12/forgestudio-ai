// The management tabs of ManagedSiteModal (activeTab). Moved verbatim from ManagedSiteModal.tsx, where it was
// a module-local type; the tab render functions use it in their dependency types.
export type TabType =
  | "overview"
  | "deployments"
  | "domains"
  | "server-config"
  | "security"
  | "backups"
  | "staging"
  | "logs-transfer"
  | "wordpress"
  | "wp-admin"
  | "performance"
  | "image-optimization"
  | "mailer"
  | "email-logs"
  | "forms"
  | "cookie-consent"
  | "integrations"
  | "client-billing"
  | "activity";
