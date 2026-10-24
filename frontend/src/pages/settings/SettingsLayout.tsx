import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Blocks,
  FileText,
  HelpCircle,
  Home,
  Layout,
  Plus,
  Puzzle,
  RotateCcw,
  RotateCw,
  Settings as SettingsIcon,
  Shapes,
  Shield,
  Sparkles,
} from "lucide-react";
import { HeaderUserDropdown } from "../../components/HeaderUserDropdown";
import "./Settings.css";

interface SettingsLayoutProps {
  activeTab: "account" | "community" | "notifications" | "security" | "support";
  children: React.ReactNode;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  activeTab,
  children,
}) => {
  const navigate = useNavigate();

  return (
    <div className="ws-root">
      {/* Top Header */}
      <header className="ws-header">
        <div className="ws-header-left">
          <button
            className="ws-back-btn"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <Link to="/dashboard" className="ws-brand">
            web studio
          </Link>
          <div className="ws-header-sep" />
        </div>

        <div className="ws-header-right">
          <button className="ws-header-icon-btn" aria-label="Undo" title="Undo">
            <RotateCcw size={16} />
          </button>
          <button className="ws-header-icon-btn" aria-label="Redo" title="Redo">
            <RotateCw size={16} />
          </button>
          <button
            className="ws-header-icon-btn"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell size={16} />
            <span className="ws-notification-dot" />
          </button>
          <Link to="/subscriptions" className="ws-upgrade-btn">
            Upgrade <span>→</span>
          </Link>
          <HeaderUserDropdown />
        </div>
      </header>

      {/* Main Layout */}
      <div className="ws-layout">
        {/* Left Primary Icon Rail */}
        <aside className="ws-rail" aria-label="Primary tools">
          <div className="ws-rail-top">
            <button
              className="ws-add-button"
              onClick={() => navigate("/dashboard")}
              title="Add"
            >
              <Plus size={16} />
              <span>Add</span>
            </button>

            <nav className="ws-rail-nav">
              <button
                className="ws-rail-item"
                onClick={() => navigate("/dashboard")}
                title="Pages"
              >
                <FileText size={18} />
                <span>Pages</span>
              </button>
              <button
                className="ws-rail-item"
                onClick={() => navigate("/dashboard")}
                title="Blocks"
              >
                <Blocks size={18} />
                <span>Blocks</span>
              </button>
              <button
                className="ws-rail-item"
                onClick={() => navigate("/dashboard")}
                title="Templates"
              >
                <Layout size={18} />
                <span>Templates</span>
              </button>
              <button
                className="ws-rail-item"
                onClick={() => navigate("/dashboard")}
                title="Elements"
              >
                <Shapes size={18} />
                <span>Elements</span>
              </button>
              <button
                className="ws-rail-item"
                onClick={() => navigate("/settings/community")}
                title="Plugin"
              >
                <Puzzle size={18} />
                <span>Plugin</span>
              </button>
              <button
                className="ws-rail-item"
                onClick={() => navigate("/ai")}
                title="AI"
              >
                <Sparkles size={18} />
                <span>AI</span>
              </button>
            </nav>
          </div>

          <div className="ws-rail-bottom">
            <Link
              to="/settings/account"
              className="ws-settings-btn"
              title="Settings"
            >
              <SettingsIcon size={18} />
              <span>Settings</span>
            </Link>
          </div>
        </aside>

        {/* Secondary Navigation Sidebar */}
        <aside className="ws-secondary-sidebar" aria-label="Settings navigation">
          <Link
            to="/settings/account"
            className={`ws-subnav-link ${activeTab === "account" ? "active" : ""}`}
          >
            <Home size={16} />
            <span>Account</span>
          </Link>
          <Link
            to="/settings/community"
            className={`ws-subnav-link ${activeTab === "community" ? "active" : ""}`}
          >
            <FileText size={16} />
            <span>Community</span>
          </Link>
          <Link
            to="/settings/notifications"
            className={`ws-subnav-link ${activeTab === "notifications" ? "active" : ""}`}
          >
            <Bell size={16} />
            <span>Notifications</span>
          </Link>
          <Link
            to="/settings/security"
            className={`ws-subnav-link ${activeTab === "security" ? "active" : ""}`}
          >
            <Shield size={16} />
            <span>Security</span>
          </Link>
          <Link
            to="/settings/help-support"
            className={`ws-subnav-link ${activeTab === "support" ? "active" : ""}`}
          >
            <HelpCircle size={16} />
            <span>Help &amp; Support</span>
          </Link>
        </aside>

        {/* Dynamic Page Content */}
        <main className="ws-main">{children}</main>
      </div>
    </div>
  );
};
