import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Loader2, Save } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { useAuth } from "../../context/AuthContext";
import "./Settings.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TIMEOUT_OPTIONS = [
  "5 Minutes",
  "10 Minutes",
  "15 Minutes",
  "30 Minutes",
  "Never",
];

export default function SettingsNotificationPage() {
  const { user } = useAuth();

  // State matching exact reference PDF
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [unreadBadge, setUnreadBadge] = useState(true);
  const [pushTimeout, setPushTimeout] = useState("10 Minutes");
  const [isTimeoutMenuOpen, setIsTimeoutMenuOpen] = useState(false);

  const [communicationEmails, setCommunicationEmails] = useState(true);
  const [announcementsUpdates, setAnnouncementsUpdates] = useState(false);

  const [disableAllSounds, setDisableAllSounds] = useState(false);

  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsTimeoutMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load preferences from backend
  useEffect(() => {
    async function loadNotificationSettings() {
      try {
        const token = localStorage.getItem("token");
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
          headers,
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          const notifs = data.data?.user?.preferences?.notificationSettings;
          if (notifs) {
            if (typeof notifs.desktopNotifications === "boolean") setDesktopNotifications(notifs.desktopNotifications);
            if (typeof notifs.unreadBadge === "boolean") setUnreadBadge(notifs.unreadBadge);
            if (typeof notifs.pushTimeout === "string") setPushTimeout(notifs.pushTimeout);
            if (typeof notifs.communicationEmails === "boolean") setCommunicationEmails(notifs.communicationEmails);
            if (typeof notifs.announcementsUpdates === "boolean") setAnnouncementsUpdates(notifs.announcementsUpdates);
            if (typeof notifs.disableAllSounds === "boolean") setDisableAllSounds(notifs.disableAllSounds);
          }
        }
      } catch {
        // Fallback silently
      }
    }
    void loadNotificationSettings();
  }, []);

  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSave = async (override?: Partial<{
    desktopNotifications: boolean;
    unreadBadge: boolean;
    pushTimeout: string;
    communicationEmails: boolean;
    announcementsUpdates: boolean;
    disableAllSounds: boolean;
  }>) => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const payload = {
        preferences: {
          notificationSettings: {
            desktopNotifications: override?.desktopNotifications ?? desktopNotifications,
            unreadBadge: override?.unreadBadge ?? unreadBadge,
            pushTimeout: override?.pushTimeout ?? pushTimeout,
            communicationEmails: override?.communicationEmails ?? communicationEmails,
            announcementsUpdates: override?.announcementsUpdates ?? announcementsUpdates,
            disableAllSounds: override?.disableAllSounds ?? disableAllSounds,
          },
        },
      };

      const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save notification settings");
      }

      showToast("Notification settings saved");
    } catch (err: any) {
      showToast(err?.message || "Failed to save settings", true);
    } finally {
      setSaving(false);
    }
  };

  const toggleDesktop = () => {
    const next = !desktopNotifications;
    setDesktopNotifications(next);
    void handleSave({ desktopNotifications: next });
  };

  const toggleUnreadBadge = () => {
    const next = !unreadBadge;
    setUnreadBadge(next);
    void handleSave({ unreadBadge: next });
  };

  const selectTimeout = (val: string) => {
    setPushTimeout(val);
    setIsTimeoutMenuOpen(false);
    void handleSave({ pushTimeout: val });
  };

  const toggleCommunication = () => {
    const next = !communicationEmails;
    setCommunicationEmails(next);
    void handleSave({ communicationEmails: next });
  };

  const toggleAnnouncements = () => {
    const next = !announcementsUpdates;
    setAnnouncementsUpdates(next);
    void handleSave({ announcementsUpdates: next });
  };

  const toggleSounds = () => {
    const next = !disableAllSounds;
    setDisableAllSounds(next);
    void handleSave({ disableAllSounds: next });
  };

  return (
    <SettingsLayout activeTab="notifications">
      <div className="ws-notification-container">
        {/* Page Title & Save Changes */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <h1 className="ws-page-title" style={{ fontSize: 26, margin: 0 }}>
            Notification Settings
          </h1>

          <button
            type="button"
            className="ws-create-post-btn"
            disabled={saving}
            onClick={() => void handleSave()}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{saving ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>

        {/* Main Settings Card */}
        <div className="ws-notification-card">
          {/* Section 1: Notifications */}
          <div className="ws-notif-section">
            <h2 className="ws-notif-section-title">Notifications</h2>

            {/* Desktop Notification */}
            <div className="ws-notif-row">
              <div className="ws-notif-info">
                <span className="ws-notif-title">Enable Desktop Notification</span>
                <span className="ws-notif-desc">
                  Receive notification all of the messages, contracts, documents.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={desktopNotifications}
                className={`ws-toggle-switch ${desktopNotifications ? "checked" : "unchecked"}`}
                onClick={toggleDesktop}
              >
                <span className="ws-toggle-knob" />
              </button>
            </div>

            {/* Unread Notification Badge */}
            <div className="ws-notif-row">
              <div className="ws-notif-info">
                <span className="ws-notif-title">Enable Unread Notification Badge</span>
                <span className="ws-notif-desc">
                  Shows a red badge on the app icon when you have unread message
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={unreadBadge}
                className={`ws-toggle-switch ${unreadBadge ? "checked" : "unchecked"}`}
                onClick={toggleUnreadBadge}
              >
                <span className="ws-toggle-knob" />
              </button>
            </div>

            {/* Push Notification Timeout */}
            <div style={{ marginTop: 22 }}>
              <span className="ws-notif-title" style={{ display: "block" }}>
                Push Notification Time-out
              </span>
              <div ref={dropdownRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  className="ws-timeout-dropdown-btn"
                  onClick={() => setIsTimeoutMenuOpen((prev) => !prev)}
                >
                  <span>{pushTimeout}</span>
                  <ChevronDown
                    size={16}
                    color="#a855f7"
                    style={{
                      transform: isTimeoutMenuOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </button>

                {isTimeoutMenuOpen && (
                  <div className="ws-timeout-menu">
                    {TIMEOUT_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`ws-timeout-option ${pushTimeout === opt ? "active" : ""}`}
                        onClick={() => selectTimeout(opt)}
                      >
                        <span>{opt}</span>
                        {pushTimeout === opt && <Check size={14} color="#a855f7" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Email Notifications */}
          <div className="ws-notif-section">
            <h2 className="ws-notif-section-title">Email Notifications</h2>

            {/* Communication Emails */}
            <div className="ws-notif-row">
              <div className="ws-notif-info">
                <span className="ws-notif-title">Communication Emails</span>
                <span className="ws-notif-desc">
                  Receive email for messages, contracts, documents.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={communicationEmails}
                className={`ws-toggle-switch ${communicationEmails ? "checked" : "unchecked"}`}
                onClick={toggleCommunication}
              >
                <span className="ws-toggle-knob" />
              </button>
            </div>

            {/* Announcements & Updates */}
            <div className="ws-notif-row">
              <div className="ws-notif-info">
                <span className="ws-notif-title">Announcements &amp; Updates</span>
                <span className="ws-notif-desc">
                  Receive email about product updates, improvements, etc.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={announcementsUpdates}
                className={`ws-toggle-switch ${announcementsUpdates ? "checked" : "unchecked"}`}
                onClick={toggleAnnouncements}
              >
                <span className="ws-toggle-knob" />
              </button>
            </div>
          </div>

          {/* Section 3: Sounds */}
          <div className="ws-notif-section" style={{ marginBottom: 0 }}>
            <h2 className="ws-notif-section-title">Sounds</h2>

            {/* Disable All Notification Sounds */}
            <div className="ws-notif-row">
              <div className="ws-notif-info">
                <span className="ws-notif-title">Disable All Notification Sounds</span>
                <span className="ws-notif-desc">
                  Mute all notification of the messages, contracts, documents.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={disableAllSounds}
                className={`ws-toggle-switch ${disableAllSounds ? "checked" : "unchecked"}`}
                onClick={toggleSounds}
              >
                <span className="ws-toggle-knob" />
              </button>
            </div>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMsg && (
          <div
            style={{
              position: "fixed",
              bottom: 24,
              right: 24,
              backgroundColor: toastMsg.isError ? "#ef4444" : "#10b981",
              color: "#ffffff",
              padding: "10px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {toastMsg.isError ? "⚠" : "✓"} {toastMsg.text}
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
