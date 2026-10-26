import React from "react";
import type { TabType } from "../types";
import { Activity, Archive, ArrowRightLeft, Cookie, Database, DollarSign, FileText, Gauge, GitBranch, Globe, ImageIcon, Mail, RotateCcw, Send, Server, Share2, Shield } from "lucide-react";

/** What renderTabBar reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface TabBarDeps {
  activeTab: TabType;
  setActiveTab: React.Dispatch<React.SetStateAction<TabType>>;
}

/**
 * Tab bar (one button per management tab).
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 1589-1628 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderTabBar({
  activeTab,
  setActiveTab,
}: TabBarDeps): React.ReactNode {
  return (
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-1 overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: Globe },
            { id: "deployments", label: "Releases & Rollbacks", icon: RotateCcw },
            { id: "domains", label: "Domains & DNS", icon: Globe },
            { id: "server-config", label: "Server & SFTP", icon: Server },
            { id: "security", label: "Security & Access", icon: Shield },
            { id: "backups", label: "Backups", icon: Archive },
            { id: "staging", label: "Staging Sandbox", icon: GitBranch },
            { id: "logs-transfer", label: "Logs & Transfer", icon: ArrowRightLeft },
            { id: "wordpress", label: "WordPress Sync", icon: FileText },
            { id: "wp-admin", label: "WP Admin & DB", icon: Database },
            { id: "performance", label: "Performance", icon: Gauge },
            { id: "image-optimization", label: "Image Optimizer", icon: ImageIcon },
            { id: "mailer", label: "Site Mailer", icon: Mail },
            { id: "email-logs", label: "Email Logs", icon: Send },
            { id: "forms", label: "Form Submissions", icon: FileText },
            { id: "cookie-consent", label: "Cookie Consent", icon: Cookie },
            { id: "integrations", label: "Integrations", icon: Share2 },
            { id: "client-billing", label: "Client Billing", icon: DollarSign },
            { id: "activity", label: "Activity Trail", icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition select-none whitespace-nowrap ${
                  isActive
                    ? "border-blue-500 text-white bg-blue-500/10"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
  );
}
