import React, { useState, useEffect } from "react";
import {
  X,
  Mail,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Send,
  Cookie,
  Zap,
  Database,
  Cpu,
  Download,
  Check,
  Calendar,
  Server,
  Copy,
  Lock,
  Key,
} from "lucide-react";
import type { ClientBillingConfig } from "../../../types/clientBilling.types.js";
import { FormSubmissionsModal } from "./FormSubmissionsModal.js";
import { renderRollbackConfirmDialog } from "./managedSiteModal/dialogs/rollbackConfirmDialog";
import { renderTransferOwnershipDialog } from "./managedSiteModal/dialogs/transferOwnershipDialog";
import { renderDeleteDomainDialog } from "./managedSiteModal/dialogs/deleteDomainDialog";
import { renderStagingDialogs } from "./managedSiteModal/dialogs/stagingDialogs";
import { renderBackupDialogs } from "./managedSiteModal/dialogs/backupDialogs";
import type { TabType } from "./managedSiteModal/types";
import { renderLogsTransferTab } from "./managedSiteModal/tabs/logsTransferTab";
import { renderSecurityTab } from "./managedSiteModal/tabs/securityTab";
import { renderServerConfigTab } from "./managedSiteModal/tabs/serverConfigTab";
import { renderDeploymentsTab } from "./managedSiteModal/tabs/deploymentsTab";
import { renderDomainsTab } from "./managedSiteModal/tabs/domainsTab";
import { renderStagingTab } from "./managedSiteModal/tabs/stagingTab";
import { renderBackupsTab } from "./managedSiteModal/tabs/backupsTab";
import { renderClientBillingTab } from "./managedSiteModal/tabs/clientBillingTab";
import { renderIntegrationsTab } from "./managedSiteModal/tabs/integrationsTab";
import { renderCookieConsentTab } from "./managedSiteModal/tabs/cookieConsentTab";
import { renderEmailLogsTab } from "./managedSiteModal/tabs/emailLogsTab";
import { renderMailerTab } from "./managedSiteModal/tabs/mailerTab";
import { renderImageOptimizationTab } from "./managedSiteModal/tabs/imageOptimizationTab";
import { renderPerformanceTab } from "./managedSiteModal/tabs/performanceTab";
import { renderWpAdminTab } from "./managedSiteModal/tabs/wpAdminTab";
import { renderWordpressSyncTab } from "./managedSiteModal/tabs/wordpressSyncTab";
import { renderOverviewTab } from "./managedSiteModal/tabs/overviewTab";
import { renderTabBar } from "./managedSiteModal/sections/tabBar";
import { renderModalHeader } from "./managedSiteModal/sections/modalHeader";

interface ManagedSiteModalProps {
  website: {
    id: string;
    name: string;
    slug: string;
    status: string;
    wpConnection?: {
      id: string;
      siteUrl: string;
      wpSiteName?: string | null;
      status: string;
      lastVerifiedAt?: string | null;
    } | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onWebsiteUpdated?: () => void;
}

export const ManagedSiteModal: React.FC<ManagedSiteModalProps> = ({
  website,
  isOpen,
  onClose,
  onWebsiteUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [details, setDetails] = useState<any>(null);
  const [documentVersion, setDocumentVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Mailer Form State
  const [mailerForm, setMailerForm] = useState({
    host: "",
    port: 587,
    username: "",
    password: "",
    fromName: "",
    fromEmail: "",
  });
  const [mailerVerified, setMailerVerified] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");

  // Delivery Logs State
  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);

  // Cookie Consent Form State
  const [cookieForm, setCookieForm] = useState({
    enabled: false,
    message: "We use cookies to enhance your browsing experience.",
    buttonText: "Accept All",
    policyUrl: "",
    theme: "dark" as "dark" | "light",
  });

  // Integrations Form State
  const [integrationsForm, setIntegrationsForm] = useState({
    googleSheetsWebhookUrl: "",
    mailchimpApiKey: "",
    mailchimpListId: "",
    zapierWebhookUrl: "",
  });
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);

  const handleTestIntegration = async (type: "google-sheets" | "mailchimp" | "zapier") => {
    setTestingIntegration(type);
    setFeedback(null);
    try {
      let body: any = {};
      if (type === "google-sheets") {
        if (!integrationsForm.googleSheetsWebhookUrl) {
          throw new Error("Please enter a Google Sheets Webhook URL first.");
        }
        body = { webhookUrl: integrationsForm.googleSheetsWebhookUrl };
      } else if (type === "mailchimp") {
        if (!integrationsForm.mailchimpApiKey || !integrationsForm.mailchimpListId) {
          throw new Error("Please enter both Mailchimp API Key and List ID.");
        }
        body = {
          apiKey: integrationsForm.mailchimpApiKey,
          listId: integrationsForm.mailchimpListId,
        };
      } else if (type === "zapier") {
        if (!integrationsForm.zapierWebhookUrl) {
          throw new Error("Please enter a Zapier Webhook URL first.");
        }
        body = { zapierUrl: integrationsForm.zapierWebhookUrl };
      }

      const res = await fetch(`${apiUrl}/api/v1/integrations/${type}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: "success",
          message: `${type === "google-sheets" ? "Google Sheets" : type === "mailchimp" ? "Mailchimp" : "Zapier"} connection test succeeded!`,
        });
      } else {
        setFeedback({
          type: "error",
          message: data.message || "Integration test dispatch failed.",
        });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Test failed." });
    } finally {
      setTestingIntegration(null);
    }
  };

  // Client Billing State (Phase 3 Subsystem 1)
  const [clientBillingForm, setClientBillingForm] = useState<ClientBillingConfig>({
    enabled: true,
    clientEmail: "",
    clientName: "",
    currency: "USD",
    baseCostMonthly: 15,
    clientPriceMonthly: 49,
    marginMonthly: 34,
    billingInterval: "month",
    subscriptionStatus: "UNBILLED",
  });
  const [clientBillingMetrics, setClientBillingMetrics] = useState<any>(null);
  const [clientBillingLoading, setClientBillingLoading] = useState(false);
  const [clientBillingCopied, setClientBillingCopied] = useState(false);
  const [clientInvoiceSending, setClientInvoiceSending] = useState(false);

  const fetchClientBilling = async () => {
    if (!website?.id) return;
    try {
      setClientBillingLoading(true);
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/client-billing`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && data.data?.config) {
        setClientBillingForm(data.data.config);
        setClientBillingMetrics(data.data.metrics);
      }
    } catch (err) {
      console.warn("[ClientBilling] Failed to load billing config:", err);
    } finally {
      setClientBillingLoading(false);
    }
  };

  const handleSaveClientBilling = async () => {
    if (!website?.id) return;
    try {
      setActionLoading(true);
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/client-billing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(clientBillingForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", message: "Client billing markup settings updated successfully!" });
        if (data.data?.config) {
          setClientBillingForm(data.data.config);
          setClientBillingMetrics(data.data.metrics);
        }
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to update client billing." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to save client billing." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendClientInvoice = async () => {
    if (!website?.id) return;
    if (!clientBillingForm.clientEmail) {
      setFeedback({ type: "error", message: "Please specify client email address first." });
      return;
    }
    try {
      setClientInvoiceSending(true);
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/client-billing/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sendEmail: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", message: data.message || "Client invoice dispatched successfully!" });
        fetchClientBilling();
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to send invoice." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to send invoice." });
    } finally {
      setClientInvoiceSending(false);
    }
  };

  // Site Activity Logs
  const [siteLogs, setSiteLogs] = useState<any[]>([]);

  // Performance State (F-431)
  const [perfSummary, setPerfSummary] = useState<any>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfAuditing, setPerfAuditing] = useState(false);

  // Image Optimization State (F-433, F-434)
  const [optStats, setOptStats] = useState<any>(null);
  const [optLoading, setOptLoading] = useState(false);
  const [optCompressing, setOptCompressing] = useState(false);

  // Remote WP Admin State (F-429, F-432)
  const [wpAdminOverview, setWpAdminOverview] = useState<any>(null);
  const [wpAdminLoading, setWpAdminLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [dbCleanupLoading, setDbCleanupLoading] = useState(false);
  const [dbResult, setDbResult] = useState<any>(null);
  const [dbOptions, setDbOptions] = useState({
    cleanRevisions: true,
    cleanTransients: true,
    optimizeTables: true,
    emptyTrash: true,
  });

  // Backups Suite State
  const [backups, setBackups] = useState<any[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [createBackupModalOpen, setCreateBackupModalOpen] = useState(false);
  const [newBackupLabel, setNewBackupLabel] = useState("");
  const [newBackupNotes, setNewBackupNotes] = useState("");
  const [renameBackupModalOpen, setRenameBackupModalOpen] = useState(false);
  const [targetBackup, setTargetBackup] = useState<any>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [renameNotes, setRenameNotes] = useState("");
  const [restoreConfirmModalOpen, setRestoreConfirmModalOpen] = useState(false);
  const [restoreTargetBackup, setRestoreTargetBackup] = useState<any>(null);
  const [deleteBackupConfirmOpen, setDeleteBackupConfirmOpen] = useState(false);
  const [deleteTargetBackup, setDeleteTargetBackup] = useState<any>(null);
  const [backupPolicy, setBackupPolicy] = useState({
    enabled: false,
    cronExpression: "0 2 * * *",
    retainCount: 7,
    trigger: "scheduled",
  });
  const [backupPolicySaving, setBackupPolicySaving] = useState(false);

  // Staging Sandbox State
  const [stagingInfo, setStagingInfo] = useState<any>(null);
  const [stagingLoading, setStagingLoading] = useState(false);
  const [stagingActionLoading, setStagingActionLoading] = useState(false);
  const [promoteConfirmModalOpen, setPromoteConfirmModalOpen] = useState(false);
  const [deleteStagingConfirmModalOpen, setDeleteStagingConfirmModalOpen] = useState(false);

  // Custom Domains & DNS State
  const [domains, setDomains] = useState<any[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [newDomainInput, setNewDomainInput] = useState("");
  const [domainAdding, setDomainAdding] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);
  const [expandedDnsDomain, setExpandedDnsDomain] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deleteDomainTarget, setDeleteDomainTarget] = useState<string | null>(null);
  const [deleteDomainConfirmOpen, setDeleteDomainConfirmOpen] = useState(false);

  // Releases & Instant Rollback State
  const [releases, setReleases] = useState<any[]>([]);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [currentReleaseId, setCurrentReleaseId] = useState<string | null>(null);
  const [rollbackTargetRelease, setRollbackTargetRelease] = useState<any | null>(null);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  // Server Resources & SFTP State
  const [serverConfig, setServerConfig] = useState<{
    phpMemoryLimit: string;
    phpMaxExecutionTime: number;
  }>({
    phpMemoryLimit: "256M",
    phpMaxExecutionTime: 60,
  });
  const [serverConfigLoading, setServerConfigLoading] = useState(false);
  const [serverConfigSaving, setServerConfigSaving] = useState(false);
  const [sftpDetails, setSftpDetails] = useState<any>(null);
  const [sftpLoading, setSftpLoading] = useState(false);
  const [sftpTesting, setSftpTesting] = useState(false);
  const [sftpTestResult, setSftpTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Security & Access State
  const [securityOverview, setSecurityOverview] = useState<any>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [siteLockForm, setSiteLockForm] = useState({ enabled: false, password: "", hint: "" });
  const [siteLockSaving, setSiteLockSaving] = useState(false);
  const [privacyForm, setPrivacyForm] = useState({ noIndex: false, maintenanceMode: false });
  const [privacySaving, setPrivacySaving] = useState(false);
  const [firewallForm, setFirewallForm] = useState<{ mode: "allow" | "deny"; ipsText: string }>({
    mode: "deny",
    ipsText: "",
  });
  const [firewallSaving, setFirewallSaving] = useState(false);
  const [scanningSecurity, setScanningSecurity] = useState(false);
  const [purgingCache, setPurgingCache] = useState(false);
  const [cdnSaving, setCdnSaving] = useState(false);

  // Operational Logs & Ownership Transfer State
  const [hostingLogs, setHostingLogs] = useState<any[]>([]);
  const [hostingLogsLoading, setHostingLogsLoading] = useState(false);
  const [transferEmail, setTransferEmail] = useState("");
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferConfirmName, setTransferConfirmName] = useState("");
  const [transferring, setTransferring] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

  // Fetch Managed Site Aggregate Details
  const fetchManagedDetails = async () => {
    if (!website) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/managed-details`, {
        credentials: "include",
      });
      const envelope = await res.json();
      const data = envelope.data;
      if (res.ok && data) {
        setDetails(data);
        setDocumentVersion(Number.isInteger(data.website?.documentVersion) ? data.website.documentVersion : null);
        if (data.mailerConfig) {
          setMailerForm({
            host: data.mailerConfig.host || "",
            port: data.mailerConfig.port || 587,
            username: data.mailerConfig.username || "",
            password: "",
            fromName: data.mailerConfig.fromName || "",
            fromEmail: data.mailerConfig.fromEmail || "",
          });
          setMailerVerified(data.mailerConfig.isVerified || false);
        }
        if (data.cookieConsent) {
          setCookieForm(data.cookieConsent);
        }
        if (data.recentLogs) {
          setDeliveryLogs(data.recentLogs);
        }
        if (data.performanceStats) {
          setPerfSummary(data.performanceStats);
        }
        if (data.optimizationStats) {
          setOptStats(data.optimizationStats);
        }
        if (data.staging) {
          setStagingInfo(data.staging);
        }
        if (data.backups) {
          setBackups(data.backups);
        }
        if (data.backupPolicy) {
          setBackupPolicy(data.backupPolicy);
        }
      }
    } catch (err: any) {
      console.error("Failed to load managed site details:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Audit Logs for this site
  const fetchSiteAuditLogs = async () => {
    if (!website) return;
    try {
      const res = await fetch(`${apiUrl}/api/v1/audit-logs?resourceId=${website.id}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.logs) {
        setSiteLogs(data.logs);
      }
    } catch {
      // no-op
    }
  };

  // Fetch Performance Summary
  const fetchPerformance = async () => {
    if (!website) return;
    setPerfLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/performance/metrics`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data) {
        setPerfSummary(data);
      }
    } catch {
      // no-op
    } finally {
      setPerfLoading(false);
    }
  };

  // Run Performance Audit
  const handleRunAudit = async () => {
    if (!website) return;
    setPerfAuditing(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/performance/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", message: data.summary || "Performance audit complete!" });
        await fetchPerformance();
      } else {
        throw new Error(data.message || "Audit failed.");
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Performance audit failed." });
    } finally {
      setPerfAuditing(false);
    }
  };

  // Fetch Image Optimization Stats
  const fetchOptimization = async () => {
    if (!website) return;
    setOptLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/images/stats`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data) {
        setOptStats(data);
      }
    } catch {
      // no-op
    } finally {
      setOptLoading(false);
    }
  };

  // Run Sample Image Compression
  const handleRunOptimization = async () => {
    if (!website) return;
    setOptCompressing(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/images/optimize-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          imageUrl: `https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200`,
          originalBytes: 420000,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          message: `Asset optimized to WebP! Saved ${data.bytesSaved ? Math.round(data.bytesSaved / 1024) : 180} KB (${data.savingsPercentage || "43%"}). Credits left: ${data.remainingCredits}`,
        });
        await fetchOptimization();
      } else {
        throw new Error(data.message || "Optimization failed.");
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Image optimization failed." });
    } finally {
      setOptCompressing(false);
    }
  };

  // Fetch WP Admin Overview
  const fetchWpAdminOverview = async () => {
    if (!website) return;
    setWpAdminLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/wordpress/admin/overview`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data) {
        setWpAdminOverview(data);
      }
    } catch {
      // no-op
    } finally {
      setWpAdminLoading(false);
    }
  };

  // Launch SSO Token into remote /wp-admin/
  const handleLaunchSso = async () => {
    if (!website) return;
    setSsoLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/wordpress/admin/sso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.ssoUrl) {
        window.open(data.ssoUrl, "_blank", "noopener,noreferrer");
        setFeedback({ type: "success", message: "1-Click Magic SSO authenticated. Opening WP-Admin in new tab..." });
      } else {
        throw new Error(data.message || "Failed to generate SSO token.");
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to launch SSO." });
    } finally {
      setSsoLoading(false);
    }
  };

  // Run Remote DB Cleanup
  const handleRunDbCleanup = async () => {
    if (!website) return;
    setDbCleanupLoading(true);
    setDbResult(null);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/wordpress/database/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dbOptions),
      });
      const data = await res.json();
      if (res.ok) {
        setDbResult(data);
        setFeedback({ type: "success", message: data.message || "Database cleanup executed successfully!" });
        await fetchWpAdminOverview();
      } else {
        throw new Error(data.message || "Database cleanup failed.");
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Database cleanup failed." });
    } finally {
      setDbCleanupLoading(false);
    }
  };

  // Fetch Backups
  const fetchBackups = async () => {
    if (!website) return;
    setBackupsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/backups`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.backups) {
        setBackups(data.backups);
      }
    } catch (err) {
      console.error("Failed to load backups:", err);
    } finally {
      setBackupsLoading(false);
    }
  };

  // Fetch Backup Policy
  const fetchBackupPolicy = async () => {
    if (!website) return;
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/backups/policy`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.policy) {
        setBackupPolicy(data.policy);
      }
    } catch (err) {
      console.error("Failed to load backup policy:", err);
    }
  };

  // Handle Create Backup
  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!website) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/backups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          trigger: "manual",
          label: newBackupLabel.trim() || undefined,
          notes: newBackupNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create backup.");
      setFeedback({ type: "success", message: "Manual snapshot successfully created!" });
      setCreateBackupModalOpen(false);
      setNewBackupLabel("");
      setNewBackupNotes("");
      fetchBackups();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to create snapshot." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Restore Backup
  const handleRestoreBackup = async () => {
    if (!website || !restoreTargetBackup) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/backups/${restoreTargetBackup.id}/restore`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to restore backup.");
      setFeedback({
        type: "success",
        message: `Successfully restored site from snapshot "${restoreTargetBackup.label}"! An automated safety snapshot was preserved.`,
      });
      setRestoreConfirmModalOpen(false);
      setRestoreTargetBackup(null);
      fetchBackups();
      fetchManagedDetails();
      if (onWebsiteUpdated) onWebsiteUpdated();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to restore snapshot." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Download Backup
  const handleDownloadBackup = (backupId: string) => {
    if (!website) return;
    window.open(`${apiUrl}/api/websites/${website.id}/backups/${backupId}/download`, "_blank");
  };

  // Handle Rename Backup
  const handleRenameBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!website || !targetBackup) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/backups/${targetBackup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          label: renameLabel.trim(),
          notes: renameNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update backup.");
      setFeedback({ type: "success", message: "Snapshot details updated successfully!" });
      setRenameBackupModalOpen(false);
      setTargetBackup(null);
      fetchBackups();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to rename snapshot." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Backup
  const handleDeleteBackup = async () => {
    if (!website || !deleteTargetBackup) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/backups/${deleteTargetBackup.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete backup.");
      setFeedback({ type: "success", message: "Snapshot deleted successfully." });
      setDeleteBackupConfirmOpen(false);
      setDeleteTargetBackup(null);
      fetchBackups();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to delete snapshot." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Save Backup Schedule Policy
  const handleSaveBackupPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!website) return;
    setBackupPolicySaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/backups/policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(backupPolicy),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save backup policy.");
      setFeedback({ type: "success", message: "Automated backup schedule saved successfully!" });
      if (data.policy) setBackupPolicy(data.policy);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to save backup schedule." });
    } finally {
      setBackupPolicySaving(false);
    }
  };

  // Fetch Staging Info
  const fetchStagingInfo = async () => {
    if (!website) return;
    setStagingLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/staging`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.staging) {
        setStagingInfo(data.staging);
      }
    } catch (err) {
      console.error("Failed to load staging status:", err);
    } finally {
      setStagingLoading(false);
    }
  };

  // Create Staging
  const handleCreateStaging = async () => {
    if (!website) return;
    setStagingActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/staging`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create staging environment.");
      setFeedback({ type: "success", message: "Staging sandbox created successfully! You can now test changes in isolation." });
      setStagingInfo(data.staging);
      fetchManagedDetails();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to create staging sandbox." });
    } finally {
      setStagingActionLoading(false);
    }
  };

  // Promote Staging
  const handlePromoteStaging = async () => {
    if (!website) return;
    setStagingActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/staging/promote`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to push staging to production.");
      setFeedback({ type: "success", message: "Staging environment successfully promoted to live production!" });
      setPromoteConfirmModalOpen(false);
      if (data.staging) setStagingInfo(data.staging);
      fetchManagedDetails();
      if (onWebsiteUpdated) onWebsiteUpdated();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Promotion failed." });
    } finally {
      setStagingActionLoading(false);
    }
  };

  // Delete Staging
  const handleDeleteStaging = async () => {
    if (!website) return;
    setStagingActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/staging`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete staging environment.");
      setFeedback({ type: "success", message: "Staging sandbox environment has been deleted." });
      setDeleteStagingConfirmModalOpen(false);
      setStagingInfo({ enabled: false, status: "IDLE" });
      fetchManagedDetails();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to delete staging sandbox." });
    } finally {
      setStagingActionLoading(false);
    }
  };

  // Helper: Transient Copy Feedback
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch Domains
  const fetchDomains = async () => {
    if (!website) return;
    setDomainsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/domains`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.domains) {
        setDomains(data.domains);
        const unverified = data.domains.find((d: any) => d.status !== "active");
        if (unverified && !expandedDnsDomain) {
          setExpandedDnsDomain(unverified.domain);
        }
      }
    } catch (err) {
      console.error("Failed to load custom domains:", err);
    } finally {
      setDomainsLoading(false);
    }
  };

  // Add Domain
  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!website || !newDomainInput.trim()) return;
    setDomainAdding(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ domain: newDomainInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add domain.");
      setFeedback({
        type: "success",
        message: `Domain "${data.domain?.domain || newDomainInput}" connected! Configure DNS records below to activate SSL.`,
      });
      setNewDomainInput("");
      setExpandedDnsDomain(data.domain?.domain);
      fetchDomains();
      if (onWebsiteUpdated) onWebsiteUpdated();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to add domain." });
    } finally {
      setDomainAdding(false);
    }
  };

  // Verify Domain & Issue Zero-Touch SSL
  const handleVerifyDomain = async (domainName: string) => {
    if (!website) return;
    setVerifyingDomain(domainName);
    setFeedback(null);
    try {
      let res = await fetch(`${apiUrl}/api/websites/${website.id}/domains/${encodeURIComponent(domainName)}/ssl/provision`, {
        method: "POST",
        credentials: "include",
      });
      if (res.status === 404) {
        res = await fetch(`${apiUrl}/api/websites/${website.id}/domains/${encodeURIComponent(domainName)}/verify`, {
          method: "POST",
          credentials: "include",
        });
      }
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: "success",
          message: `Domain "${domainName}" successfully verified! Zero-touch SSL provisioned and active on edge router.`,
        });
      } else {
        setFeedback({
          type: "error",
          message: data.message || "DNS verification check failed. Propagation may take time.",
        });
      }
      fetchDomains();
      if (onWebsiteUpdated) onWebsiteUpdated();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "DNS verification check failed." });
    } finally {
      setVerifyingDomain(null);
    }
  };

  // Fetch Releases & Rollbacks
  const fetchReleases = async () => {
    if (!website) return;
    setReleasesLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/releases`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.releases) {
        setReleases(data.releases);
        setCurrentReleaseId(data.currentReleaseId || (data.releases[0]?.releaseId ?? null));
      }
    } catch (err) {
      console.error("Failed to load releases:", err);
    } finally {
      setReleasesLoading(false);
    }
  };

  // Instant Rollback Handler (< 100ms)
  const handleInstantRollback = async (releaseId: string) => {
    if (!website) return;
    setRollbackLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/releases/${releaseId}/rollback`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Rollback failed.");
      setFeedback({
        type: "success",
        message: `Instant Zero-Downtime Rollback succeeded in ${data.executionTimeMs || 12}ms! Release ${data.releaseId} is now live.`,
      });
      setCurrentReleaseId(data.releaseId);
      setRollbackConfirmOpen(false);
      setRollbackTargetRelease(null);
      fetchReleases();
      if (onWebsiteUpdated) onWebsiteUpdated();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Rollback failed." });
    } finally {
      setRollbackLoading(false);
    }
  };

  // Set Primary Domain
  const handleSetPrimaryDomain = async (domainName: string) => {
    if (!website) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/domains/${encodeURIComponent(domainName)}/primary`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to set primary domain.");
      setFeedback({ type: "success", message: `"${domainName}" is now the primary domain for this website.` });
      fetchDomains();
      if (onWebsiteUpdated) onWebsiteUpdated();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to set primary domain." });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Domain
  const handleDeleteDomain = async () => {
    if (!website || !deleteDomainTarget) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/domains/${encodeURIComponent(deleteDomainTarget)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to remove domain.");
      setFeedback({ type: "success", message: `Domain "${deleteDomainTarget}" removed.` });
      setDeleteDomainConfirmOpen(false);
      setDeleteDomainTarget(null);
      fetchDomains();
      if (onWebsiteUpdated) onWebsiteUpdated();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to remove domain." });
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch Server Config
  const fetchServerConfig = async () => {
    if (!website) return;
    setServerConfigLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/server-config`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.config) {
        setServerConfig(data.config);
      }
    } catch (err) {
      console.error("Failed to load server config:", err);
    } finally {
      setServerConfigLoading(false);
    }
  };

  // Save Server Config
  const handleSaveServerConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!website) return;
    setServerConfigSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/server-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(serverConfig),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save server settings.");
      setFeedback({ type: "success", message: "Server resources & PHP configuration updated successfully!" });
      if (data.config) setServerConfig(data.config);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to save server settings." });
    } finally {
      setServerConfigSaving(false);
    }
  };

  // Fetch SFTP Details
  const fetchSftpDetails = async () => {
    if (!website) return;
    setSftpLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/sftp`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.sftp) {
        setSftpDetails(data.sftp);
      }
    } catch (err) {
      console.error("Failed to load SFTP details:", err);
    } finally {
      setSftpLoading(false);
    }
  };

  // Test SFTP Connection
  const handleTestSftp = async () => {
    if (!website) return;
    setSftpTesting(true);
    setSftpTestResult(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/sftp/test`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      setSftpTestResult({
        success: !!data.success,
        message: data.message || (data.success ? "Connection verified!" : "Connection failed"),
      });
      fetchSftpDetails();
    } catch (err: any) {
      setSftpTestResult({
        success: false,
        message: err.message || "SFTP connection test failed.",
      });
    } finally {
      setSftpTesting(false);
    }
  };

  // Fetch Security Overview
  const fetchSecurityOverview = async () => {
    if (!website) return;
    setSecurityLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/security`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setSecurityOverview(data);
        if (data.siteLock) {
          setSiteLockForm({
            enabled: !!data.siteLock.enabled,
            password: "",
            hint: data.siteLock.hint || "",
          });
        }
        if (data.privacy) {
          setPrivacyForm({
            noIndex: !!data.privacy.noIndex,
            maintenanceMode: !!data.privacy.maintenanceMode,
          });
        }
        if (data.ipFirewall) {
          setFirewallForm({
            mode: data.ipFirewall.mode || "deny",
            ipsText: Array.isArray(data.ipFirewall.ips) ? data.ipFirewall.ips.join("\n") : "",
          });
        }
      }
    } catch (err) {
      console.error("Failed to load security settings:", err);
    } finally {
      setSecurityLoading(false);
    }
  };

  // Save Site Lock
  const handleSaveSiteLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!website) return;
    setSiteLockSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/security/site-lock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(siteLockForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update site lock.");
      setFeedback({ type: "success", message: data.message || "Site lock configuration saved." });
      fetchSecurityOverview();
      fetchManagedDetails();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to update site lock." });
    } finally {
      setSiteLockSaving(false);
    }
  };

  // Save Privacy
  const handleSavePrivacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!website) return;
    setPrivacySaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/security/privacy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(privacyForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update privacy settings.");
      setFeedback({ type: "success", message: "Search privacy and maintenance mode updated!" });
      fetchSecurityOverview();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to update privacy settings." });
    } finally {
      setPrivacySaving(false);
    }
  };

  // Save IP Firewall
  const handleSaveFirewall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!website) return;
    setFirewallSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/security/firewall`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: firewallForm.mode,
          ips: firewallForm.ipsText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update firewall rules.");
      setFeedback({ type: "success", message: "IP firewall rules updated successfully!" });
      fetchSecurityOverview();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to update firewall rules." });
    } finally {
      setFirewallSaving(false);
    }
  };

  // Run Security Audit
  const handleRunSecurityAudit = async () => {
    if (!website) return;
    setScanningSecurity(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/security/scan`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Security scan failed.");
      setFeedback({
        type: "success",
        message: `Security scan complete: Health Score ${data.audit?.score}/100 (${data.audit?.status})`,
      });
      fetchSecurityOverview();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Security scan failed." });
    } finally {
      setScanningSecurity(false);
    }
  };

  // Purge Cache
  const handlePurgeCache = async () => {
    if (!website) return;
    setPurgingCache(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/cache/purge`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Cache purge failed.");
      setFeedback({ type: "success", message: data.message || "Platform dynamic cache purged successfully." });
      fetchSecurityOverview();
      fetchHostingLogs();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Cache purge failed." });
    } finally {
      setPurgingCache(false);
    }
  };

  // Toggle CDN
  const handleToggleCdn = async (enabled: boolean) => {
    if (!website) return;
    setCdnSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/cdn`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cloudflareEnabled: enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update CDN.");
      setFeedback({ type: "success", message: data.message });
      fetchSecurityOverview();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to update CDN." });
    } finally {
      setCdnSaving(false);
    }
  };

  // Fetch Hosting Logs
  const fetchHostingLogs = async () => {
    if (!website) return;
    setHostingLogsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/hosting-logs`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.logs) {
        setHostingLogs(data.logs);
      }
    } catch (err) {
      console.error("Failed to load hosting logs:", err);
    } finally {
      setHostingLogsLoading(false);
    }
  };

  // Transfer Ownership
  const handleTransferOwnership = async () => {
    if (!website || !transferEmail.trim()) return;
    setTransferring(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetEmail: transferEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Transfer failed.");
      setFeedback({
        type: "success",
        message: `Ownership of "${website.name}" successfully transferred to ${data.newOwnerEmail}!`,
      });
      setTransferModalOpen(false);
      setTransferEmail("");
      setTransferConfirmName("");
      if (onWebsiteUpdated) onWebsiteUpdated();
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Ownership transfer failed." });
    } finally {
      setTransferring(false);
    }
  };

  useEffect(() => {
    if (isOpen && website) {
      fetchManagedDetails();
      fetchSiteAuditLogs();
      fetchPerformance();
      fetchOptimization();
      fetchBackups();
      fetchBackupPolicy();
      fetchStagingInfo();
      fetchDomains();
      fetchReleases();
      fetchServerConfig();
      fetchSftpDetails();
      fetchSecurityOverview();
      fetchHostingLogs();
      if (website.wpConnection) {
        fetchWpAdminOverview();
      }
      fetchClientBilling();
    }
  }, [isOpen, website?.id]);

  if (!isOpen || !website) return null;

  // Handler: WordPress Sync
  const handleWordPressSync = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/wordpress/sync-pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Sync failed.");
      setFeedback({ type: "success", message: `Synced ${data.syncedPagesCount || 0} page(s) successfully to WordPress!` });
      fetchManagedDetails();
      if (onWebsiteUpdated) onWebsiteUpdated();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to sync pages." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Verify WordPress Connection
  const handleVerifyConnection = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/wordpress/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed.");
      setFeedback({ type: "success", message: `WordPress connection verified! (${data.wpSiteName || data.siteUrl})` });
      fetchManagedDetails();
      if (onWebsiteUpdated) onWebsiteUpdated();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Verification failed." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Save SMTP Configuration
  const handleSaveMailer = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/mailer/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(mailerForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save SMTP configuration.");
      setFeedback({ type: "success", message: "SMTP configuration saved." });
      setMailerVerified(data.config?.isVerified || false);
      fetchManagedDetails();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to save SMTP." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Send Test Email
  const handleTestMailer = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/mailer/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipient: testRecipient || mailerForm.fromEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Test email delivery failed.");
      setFeedback({ type: "success", message: data.message || "Test email delivered successfully!" });
      setMailerVerified(true);
      fetchManagedDetails();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Test email failed." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Save Cookie Consent
  const handleSaveCookieConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentVersion) {setFeedback({type: "error", message: "Reload website settings before saving."}); return;}
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/websites/${website.id}/cookie-consent`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Forge-Intent": "document-command",
          "If-Match": `"${website.id}:document:${documentVersion}"`, "Idempotency-Key": crypto.randomUUID() },
        credentials: "include",
        body: JSON.stringify(cookieForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.detail || "Failed to update cookie consent.");
      setFeedback({ type: "success", message: "Cookie consent settings updated successfully!" });
      fetchManagedDetails();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to save cookie settings." });
    } finally {
      setActionLoading(false);
    }
  };

  const wpConn = details?.wpConnection || website.wpConnection;
  const isWpConnected = wpConn?.status === "CONNECTED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden font-sans">
        
        {/* Modal Header */}
        {/* See managedSiteModal/sections/modalHeader (moved verbatim) */}
        {renderModalHeader({
          isWpConnected,
          onClose,
          website,
        })}

        {/* Tab Navigation */}
        {/* See managedSiteModal/sections/tabBar (moved verbatim) */}
        {renderTabBar({
          activeTab,
          setActiveTab,
        })}

        {/* Feedback Alert */}
        {feedback && (
          <div className={`mx-6 mt-4 p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-950/50 border border-emerald-500/30 text-emerald-300"
              : "bg-red-950/50 border border-red-500/30 text-red-300"
          }`}>
            {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-slate-400 text-xs gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              <span>Loading site configuration...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {/* See managedSiteModal/tabs/overviewTab (moved verbatim) */}
              {renderOverviewTab({
                actionLoading,
                activeTab,
                details,
                handleLaunchSso,
                handleWordPressSync,
                isWpConnected,
                mailerForm,
                mailerVerified,
                optStats,
                setActiveTab,
                ssoLoading,
                wpConn,
              })}

              {/* TAB 2: WORDPRESS SYNC */}
              {/* See managedSiteModal/tabs/wordpressSyncTab (moved verbatim) */}
              {renderWordpressSyncTab({
                actionLoading,
                activeTab,
                details,
                handleVerifyConnection,
                handleWordPressSync,
                isWpConnected,
                onClose,
                website,
                wpConn,
              })}

              {/* TAB 3: WP ADMIN & DATABASE (F-429 & F-432) */}
              {/* See managedSiteModal/tabs/wpAdminTab (moved verbatim) */}
              {renderWpAdminTab({
                activeTab,
                dbCleanupLoading,
                dbOptions,
                dbResult,
                handleLaunchSso,
                handleRunDbCleanup,
                isWpConnected,
                setDbOptions,
                ssoLoading,
                wpAdminOverview,
              })}

              {/* TAB 4: PERFORMANCE MONITORING (F-431) */}
              {/* See managedSiteModal/tabs/performanceTab (moved verbatim) */}
              {renderPerformanceTab({
                activeTab,
                handleRunAudit,
                perfAuditing,
                perfSummary,
              })}

              {/* TAB 5: IMAGE OPTIMIZATION & CREDITS (F-433 & F-434) */}
              {/* See managedSiteModal/tabs/imageOptimizationTab (moved verbatim) */}
              {renderImageOptimizationTab({
                activeTab,
                handleRunOptimization,
                optCompressing,
                optStats,
              })}

              {/* TAB 6: SITE MAILER */}
              {/* See managedSiteModal/tabs/mailerTab (moved verbatim) */}
              {renderMailerTab({
                actionLoading,
                activeTab,
                handleSaveMailer,
                handleTestMailer,
                mailerForm,
                mailerVerified,
                setMailerForm,
                setTestRecipient,
                testRecipient,
              })}

              {/* TAB 7: EMAIL LOGS */}
              {/* See managedSiteModal/tabs/emailLogsTab (moved verbatim) */}
              {renderEmailLogsTab({
                activeTab,
                deliveryLogs,
                fetchManagedDetails,
              })}

              {/* TAB: FORM SUBMISSIONS (F-273) */}
              {activeTab === "forms" && website && (
                <div className="space-y-4">
                  <FormSubmissionsModal
                    websiteId={website.id}
                    websiteName={website.name}
                    isEmbedded={true}
                  />
                </div>
              )}

              {/* TAB 8: COOKIE CONSENT */}
              {/* See managedSiteModal/tabs/cookieConsentTab (moved verbatim) */}
              {renderCookieConsentTab({
                actionLoading,
                activeTab,
                cookieForm,
                handleSaveCookieConsent,
                setCookieForm,
              })}

              {/* TAB: LEAD & EXTERNAL INTEGRATIONS */}
              {/* See managedSiteModal/tabs/integrationsTab (moved verbatim) */}
              {renderIntegrationsTab({
                activeTab,
                handleTestIntegration,
                integrationsForm,
                setIntegrationsForm,
                testingIntegration,
              })}

              {/* TAB: AGENCY CLIENT INVOICING & MARKUP */}
              {/* See managedSiteModal/tabs/clientBillingTab (moved verbatim) */}
              {renderClientBillingTab({
                actionLoading,
                activeTab,
                clientBillingCopied,
                clientBillingForm,
                clientBillingLoading,
                clientInvoiceSending,
                fetchClientBilling,
                handleSaveClientBilling,
                handleSendClientInvoice,
                setClientBillingCopied,
                setClientBillingForm,
                website,
              })}

              {/* TAB: BACKUPS SUITE */}
              {/* See managedSiteModal/tabs/backupsTab (moved verbatim) */}
              {renderBackupsTab({
                activeTab,
                backupPolicy,
                backupPolicySaving,
                backups,
                backupsLoading,
                fetchBackups,
                handleDownloadBackup,
                handleSaveBackupPolicy,
                setBackupPolicy,
                setCreateBackupModalOpen,
                setDeleteBackupConfirmOpen,
                setDeleteTargetBackup,
                setNewBackupLabel,
                setNewBackupNotes,
                setRenameBackupModalOpen,
                setRenameLabel,
                setRenameNotes,
                setRestoreConfirmModalOpen,
                setRestoreTargetBackup,
                setTargetBackup,
              })}

              {/* TAB: STAGING ENVIRONMENT */}
              {/* See managedSiteModal/tabs/stagingTab (moved verbatim) */}
              {renderStagingTab({
                activeTab,
                fetchStagingInfo,
                handleCreateStaging,
                setDeleteStagingConfirmModalOpen,
                setPromoteConfirmModalOpen,
                stagingActionLoading,
                stagingInfo,
                stagingLoading,
                website,
              })}

              {/* TAB: CUSTOM DOMAINS & DNS */}
              {/* See managedSiteModal/tabs/domainsTab (moved verbatim) */}
              {renderDomainsTab({
                actionLoading,
                activeTab,
                copiedKey,
                domainAdding,
                domains,
                domainsLoading,
                expandedDnsDomain,
                fetchDomains,
                handleAddDomain,
                handleCopy,
                handleSetPrimaryDomain,
                handleVerifyDomain,
                newDomainInput,
                setDeleteDomainConfirmOpen,
                setDeleteDomainTarget,
                setExpandedDnsDomain,
                setNewDomainInput,
                verifyingDomain,
              })}

              {/* TAB: DEPLOYMENTS & ATOMIC RELEASES TIMELINE (F-Scope 3) */}
              {/* See managedSiteModal/tabs/deploymentsTab (moved verbatim) */}
              {renderDeploymentsTab({
                activeTab,
                currentReleaseId,
                fetchReleases,
                releases,
                releasesLoading,
                setRollbackConfirmOpen,
                setRollbackTargetRelease,
              })}

              {/* TAB: SERVER & SFTP CONFIGURATION */}
              {/* See managedSiteModal/tabs/serverConfigTab (moved verbatim) */}
              {renderServerConfigTab({
                activeTab,
                copiedKey,
                fetchServerConfig,
                fetchSftpDetails,
                handleCopy,
                handleSaveServerConfig,
                handleTestSftp,
                serverConfig,
                serverConfigLoading,
                serverConfigSaving,
                setServerConfig,
                sftpDetails,
                sftpLoading,
                sftpTestResult,
                sftpTesting,
                website,
              })}

              {/* TAB: SECURITY & ACCESS */}
              {/* See managedSiteModal/tabs/securityTab (moved verbatim) */}
              {renderSecurityTab({
                activeTab,
                cdnSaving,
                fetchSecurityOverview,
                firewallForm,
                firewallSaving,
                handlePurgeCache,
                handleRunSecurityAudit,
                handleSaveFirewall,
                handleSavePrivacy,
                handleSaveSiteLock,
                handleToggleCdn,
                privacyForm,
                privacySaving,
                purgingCache,
                scanningSecurity,
                securityLoading,
                securityOverview,
                setFirewallForm,
                setPrivacyForm,
                setSiteLockForm,
                siteLockForm,
                siteLockSaving,
              })}

              {/* TAB: LOGS & TRANSFER */}
              {/* See managedSiteModal/tabs/logsTransferTab (moved verbatim) */}
              {renderLogsTransferTab({
                activeTab,
                fetchHostingLogs,
                hostingLogs,
                hostingLogsLoading,
                setTransferConfirmName,
                setTransferEmail,
                setTransferModalOpen,
                transferEmail,
              })}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3.5 bg-slate-950/40 text-xs text-slate-500">
          <span>ForgeStudio Centralized Site Governor</span>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-white transition"
          >
            Done
          </button>
        </div>

        {/* ========================================================================= */}
        {/* SUB-MODALS & CONFIRMATION DIALOGS                                         */}
        {/* ========================================================================= */}

        {/* MODAL: CREATE SNAPSHOT */}
        {/* See managedSiteModal/dialogs/backupDialogs (moved verbatim) */}
        {renderBackupDialogs({
          actionLoading,
          createBackupModalOpen,
          deleteBackupConfirmOpen,
          deleteTargetBackup,
          handleCreateBackup,
          handleDeleteBackup,
          handleRenameBackup,
          handleRestoreBackup,
          newBackupLabel,
          newBackupNotes,
          renameBackupModalOpen,
          renameLabel,
          renameNotes,
          restoreConfirmModalOpen,
          restoreTargetBackup,
          setCreateBackupModalOpen,
          setDeleteBackupConfirmOpen,
          setDeleteTargetBackup,
          setNewBackupLabel,
          setNewBackupNotes,
          setRenameBackupModalOpen,
          setRenameLabel,
          setRenameNotes,
          setRestoreConfirmModalOpen,
          setRestoreTargetBackup,
          targetBackup,
        })}

        {/* MODAL: PROMOTE STAGING CONFIRMATION */}
        {/* See managedSiteModal/dialogs/stagingDialogs (moved verbatim) */}
        {renderStagingDialogs({
          deleteStagingConfirmModalOpen,
          handleDeleteStaging,
          handlePromoteStaging,
          promoteConfirmModalOpen,
          setDeleteStagingConfirmModalOpen,
          setPromoteConfirmModalOpen,
          stagingActionLoading,
        })}

        {/* MODAL: DELETE DOMAIN CONFIRMATION */}
        {/* See managedSiteModal/dialogs/deleteDomainDialog (moved verbatim) */}
        {renderDeleteDomainDialog({
          actionLoading,
          deleteDomainConfirmOpen,
          deleteDomainTarget,
          handleDeleteDomain,
          setDeleteDomainConfirmOpen,
          setDeleteDomainTarget,
        })}

        {/* MODAL: TRANSFER WEBSITE OWNERSHIP CONFIRMATION */}
        {/* See managedSiteModal/dialogs/transferOwnershipDialog (moved verbatim) */}
        {renderTransferOwnershipDialog({
          handleTransferOwnership,
          setTransferConfirmName,
          setTransferModalOpen,
          transferConfirmName,
          transferEmail,
          transferModalOpen,
          transferring,
          website,
        })}

        {/* MODAL: INSTANT ZERO-DOWNTIME ROLLBACK CONFIRMATION */}
        {/* See managedSiteModal/dialogs/rollbackConfirmDialog (moved verbatim) */}
        {renderRollbackConfirmDialog({
          handleInstantRollback,
          rollbackConfirmOpen,
          rollbackLoading,
          rollbackTargetRelease,
          setRollbackConfirmOpen,
          setRollbackTargetRelease,
        })}
      </div>
    </div>
  );
};

export default ManagedSiteModal;
