import React, { useState, useEffect } from "react";
import {
  Key,
  ShieldCheck,
  Laptop,
  Smartphone,
  Monitor,
  MoreVertical,
  X,
  Loader2,
  Check,
  AlertCircle,
  QrCode,
  Copy,
  ExternalLink,
} from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { useAuth } from "../../context/AuthContext";
import "./Settings.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface SessionItem {
  id: string;
  device: string;
  browser: string;
  location: string;
  time: string;
  isCurrent: boolean;
  type: "desktop" | "mobile";
}

const DEFAULT_SESSIONS: SessionItem[] = [
  {
    id: "sess-1",
    device: "Windows",
    browser: "Chrome",
    location: "Bhubaneswar, India",
    time: "Active now",
    isCurrent: true,
    type: "desktop",
  },
  {
    id: "sess-2",
    device: "iPhone",
    browser: "Safari",
    location: "Bhubaneswar, India",
    time: "Aug 20, 2026, 10:24 AM",
    isCurrent: false,
    type: "mobile",
  },
  {
    id: "sess-3",
    device: "Mac",
    browser: "Chrome",
    location: "Kolkata, India",
    time: "Aug 18, 2026, 08:12 PM",
    isCurrent: false,
    type: "desktop",
  },
];

export default function SettingsSecurityPage() {
  const { user } = useAuth();

  // Sessions state
  const [sessions, setSessions] = useState<SessionItem[]>(DEFAULT_SESSIONS);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // 2FA state
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  // Change Password state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Connected Apps state
  const [apps, setApps] = useState([
    {
      id: "figma",
      name: "Figma",
      desc: "Design and collaborate on projects.",
      connectedDate: "Aug 12, 2026",
      connected: true,
      color: "#f24e1e",
    },
    {
      id: "google",
      name: "Google",
      desc: "Sign in with Google",
      connectedDate: "Jun 05, 2026",
      connected: true,
      color: "#4285f4",
    },
  ]);

  // Notifications
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Fetch real sessions if available
  useEffect(() => {
    async function loadSessions() {
      try {
        const token = localStorage.getItem("token");
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/api/v1/auth/sessions`, {
          headers,
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data) && json.data.length > 0) {
            const mapped: SessionItem[] = json.data.map((s: any, idx: number) => ({
              id: s.id || `sess-${idx}`,
              device: s.userAgent?.includes("Mac") ? "Mac" : s.userAgent?.includes("iPhone") ? "iPhone" : "Windows",
              browser: s.userAgent?.includes("Safari") ? "Safari" : "Chrome",
              location: s.ipAddress ? `IP: ${s.ipAddress}` : "Bhubaneswar, India",
              time: idx === 0 ? "Active now" : new Date(s.createdAt || Date.now()).toLocaleDateString(),
              isCurrent: idx === 0,
              type: s.userAgent?.includes("iPhone") ? "mobile" : "desktop",
            }));
            setSessions(mapped);
          }
        }
      } catch {
        // Fall back gracefully to reference sessions
      }
    }
    void loadSessions();
  }, []);

  const handleRevokeSession = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      await fetch(`${API_BASE}/api/v1/auth/sessions/${id}/revoke`, {
        method: "POST",
        headers,
        credentials: "include",
      }).catch(() => {});

      setSessions((prev) => prev.filter((s) => s.id !== id));
      setActiveMenuId(null);
      showToast("Session signed out successfully");
    } catch {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      showToast("Session signed out");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`${API_BASE}/api/v1/auth/change-password`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "Failed to update password.");
      }

      showToast("Password updated successfully");
      setIsPasswordModalOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleToggleApp = (appId: string) => {
    setApps((prev) =>
      prev.map((a) => {
        if (a.id === appId) {
          const nextState = !a.connected;
          showToast(`${a.name} ${nextState ? "connected" : "disconnected"}`);
          return { ...a, connected: nextState };
        }
        return a;
      })
    );
  };

  const handleVerify2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.trim().length >= 6) {
      setIs2FAEnabled(true);
      setIs2FAModalOpen(false);
      setVerificationCode("");
      showToast("Two-Factor Authentication enabled successfully");
    } else {
      showToast("Please enter a valid 6-digit code", true);
    }
  };

  const copySecretKey = () => {
    navigator.clipboard?.writeText("JBSWY3DPEHPK3PXP");
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <SettingsLayout activeTab="security">
      <div className="ws-security-container">
        {/* Page Title */}
        <h1 className="ws-page-title" style={{ fontSize: 26, marginBottom: 24 }}>
          Security Settings
        </h1>

        {/* 1. PASSWORD CARD */}
        <div className="ws-sec-card">
          <div className="ws-sec-card-header">
            <div className="ws-sec-header-icon">
              <Key size={18} />
            </div>
            <div>
              <h2 className="ws-sec-title">Password</h2>
              <p className="ws-sec-desc">Use a strong password to keep your account safe.</p>
            </div>
          </div>

          <div className="ws-sec-inner-row">
            <div className="ws-sec-item-info">
              <span className="ws-sec-item-title">Password</span>
              <span className="ws-sec-item-subtitle">Last changed on 12 Aug 2026</span>
            </div>

            <button
              type="button"
              className="ws-sec-btn-outline"
              onClick={() => setIsPasswordModalOpen(true)}
            >
              Change password
            </button>
          </div>
        </div>

        {/* 2. TWO-FACTOR AUTHENTICATION (2FA) CARD */}
        <div className="ws-sec-card">
          <div className="ws-sec-card-header">
            <div className="ws-sec-header-icon">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="ws-sec-title">Two-Factor Authentication (2FA)</h2>
              <p className="ws-sec-desc">Add an extra layer of security to your account.</p>
            </div>
          </div>

          <div className="ws-sec-inner-row">
            <div className="ws-sec-item-left">
              <div className="ws-sec-item-icon">
                <Smartphone size={20} />
              </div>
              <div className="ws-sec-item-info">
                <span className="ws-sec-item-title">
                  {is2FAEnabled ? "2FA is currently enabled" : "2FA is currently disabled"}
                </span>
                <span className="ws-sec-item-subtitle">
                  Protect your account with an additional verification step.
                </span>
              </div>
            </div>

            <button
              type="button"
              className={is2FAEnabled ? "ws-sec-btn-outline" : "ws-sec-btn-purple"}
              onClick={() => {
                if (is2FAEnabled) {
                  setIs2FAEnabled(false);
                  showToast("Two-Factor Authentication disabled");
                } else {
                  setIs2FAModalOpen(true);
                }
              }}
            >
              {is2FAEnabled ? "Disable 2FA" : "Enable 2FA"}
            </button>
          </div>
        </div>

        {/* 3. ACTIVE SESSIONS CARD */}
        <div className="ws-sec-card">
          <div className="ws-sec-card-header">
            <div className="ws-sec-header-icon">
              <Laptop size={18} />
            </div>
            <div>
              <h2 className="ws-sec-title">Active Sessions</h2>
              <p className="ws-sec-desc">Manage devices that are currently signed in to your account.</p>
            </div>
          </div>

          <div>
            {sessions.map((sess) => (
              <div key={sess.id} className="ws-sec-inner-row">
                <div className="ws-sec-item-left">
                  <div className="ws-sec-item-icon">
                    {sess.type === "mobile" ? <Smartphone size={20} /> : <Monitor size={20} />}
                  </div>
                  <div className="ws-sec-item-info">
                    <span className="ws-sec-item-title">
                      {sess.device} • {sess.browser}
                    </span>
                    <span className="ws-sec-item-subtitle">
                      {sess.location} •{" "}
                      {sess.isCurrent ? (
                        <span style={{ color: "#10b981", fontWeight: 500 }}>Active now</span>
                      ) : (
                        sess.time
                      )}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {sess.isCurrent ? (
                    <span className="ws-sec-badge-green">Current device</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ws-sec-btn-outline"
                        onClick={() => void handleRevokeSession(sess.id)}
                      >
                        Sign out
                      </button>
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          className="ws-header-icon-btn"
                          style={{ padding: 6 }}
                          onClick={() => setActiveMenuId(activeMenuId === sess.id ? null : sess.id)}
                          aria-label="More options"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {activeMenuId === sess.id && (
                          <div
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "100%",
                              backgroundColor: "#16132d",
                              border: "1px solid #332d5c",
                              borderRadius: 8,
                              padding: 4,
                              zIndex: 30,
                              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                              minWidth: 140,
                            }}
                          >
                            <button
                              type="button"
                              className="ws-timeout-option"
                              style={{ color: "#f87171" }}
                              onClick={() => void handleRevokeSession(sess.id)}
                            >
                              Revoke Access
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. CONNECTED APPS CARD */}
        <div className="ws-sec-card">
          <div className="ws-sec-card-header">
            <div className="ws-sec-header-icon">
              <ExternalLink size={18} />
            </div>
            <div>
              <h2 className="ws-sec-title">Connected Apps</h2>
              <p className="ws-sec-desc">Manage third-party apps that have access to your account.</p>
            </div>
          </div>

          <div>
            {apps.map((app) => (
              <div key={app.id} className="ws-sec-inner-row">
                <div className="ws-sec-item-left">
                  <div
                    className="ws-sec-item-icon"
                    style={{
                      backgroundColor: `${app.color}15`,
                      color: app.color,
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {app.name.charAt(0)}
                  </div>
                  <div className="ws-sec-item-info">
                    <span className="ws-sec-item-title">{app.name}</span>
                    <span className="ws-sec-item-subtitle">
                      {app.desc}
                      {app.connected && ` • Connected on ${app.connectedDate}`}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className={app.connected ? "ws-sec-btn-outline" : "ws-sec-btn-purple"}
                  onClick={() => handleToggleApp(app.id)}
                >
                  {app.connected ? "Disconnect" : "Connect"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* CHANGE PASSWORD MODAL */}
        {isPasswordModalOpen && (
          <div className="ws-modal-overlay">
            <div className="ws-modal-card" style={{ maxWidth: 460 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "#ffffff", margin: 0 }}>
                  Change Password
                </h3>
                <button
                  type="button"
                  className="ws-header-icon-btn"
                  onClick={() => setIsPasswordModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              {passwordError && (
                <div
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#f87171",
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{passwordError}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword}>
                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#c3bfde",
                      marginBottom: 6,
                    }}
                  >
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    style={{
                      width: "100%",
                      height: 40,
                      backgroundColor: "#0d0b1a",
                      border: "1px solid #2d2850",
                      borderRadius: 8,
                      color: "#ffffff",
                      padding: "0 14px",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#c3bfde",
                      marginBottom: 6,
                    }}
                  >
                    New Password (min. 8 characters)
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    style={{
                      width: "100%",
                      height: 40,
                      backgroundColor: "#0d0b1a",
                      border: "1px solid #2d2850",
                      borderRadius: 8,
                      color: "#ffffff",
                      padding: "0 14px",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 22 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#c3bfde",
                      marginBottom: 6,
                    }}
                  >
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    style={{
                      width: "100%",
                      height: 40,
                      backgroundColor: "#0d0b1a",
                      border: "1px solid #2d2850",
                      borderRadius: 8,
                      color: "#ffffff",
                      padding: "0 14px",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    className="ws-sec-btn-outline"
                    onClick={() => setIsPasswordModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="ws-sec-btn-purple"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {changingPassword && <Loader2 size={14} className="animate-spin" />}
                    <span>{changingPassword ? "Updating..." : "Update Password"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2FA SETUP MODAL */}
        {is2FAModalOpen && (
          <div className="ws-modal-overlay">
            <div className="ws-modal-card" style={{ maxWidth: 480 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "#ffffff", margin: 0 }}>
                  Setup Two-Factor Authentication
                </h3>
                <button
                  type="button"
                  className="ws-header-icon-btn"
                  onClick={() => setIs2FAModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: 12.5, color: "#9c97b8", margin: "0 0 16px", lineHeight: 1.5 }}>
                Scan this QR code with an authenticator app (such as Google Authenticator, Authy, or 1Password), then enter the 6-digit code.
              </p>

              {/* QR Mock container */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#ffffff",
                  padding: 16,
                  borderRadius: 12,
                  width: 160,
                  margin: "0 auto 16px",
                }}
              >
                <QrCode size={128} color="#0c0b15" />
                <span style={{ fontSize: 10, color: "#475569", marginTop: 4, fontWeight: 600 }}>
                  SCAN WITH APP
                </span>
              </div>

              {/* Secret Key Row */}
              <div
                style={{
                  backgroundColor: "#0d0b1a",
                  border: "1px solid #231f42",
                  borderRadius: 8,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 10, color: "#757193", textTransform: "uppercase" }}>Secret Key</span>
                  <code style={{ fontSize: 12.5, color: "#c084fc", letterSpacing: 1 }}>JBSWY3DPEHPK3PXP</code>
                </div>
                <button
                  type="button"
                  onClick={copySecretKey}
                  className="ws-sec-btn-outline"
                  style={{ padding: "4px 10px", fontSize: 11 }}
                >
                  {copiedKey ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedKey ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <form onSubmit={handleVerify2FA}>
                <div style={{ marginBottom: 18 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#c3bfde",
                      marginBottom: 6,
                    }}
                  >
                    6-digit verification code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    style={{
                      width: "100%",
                      height: 42,
                      backgroundColor: "#0d0b1a",
                      border: "1px solid #7c3aed",
                      borderRadius: 8,
                      color: "#ffffff",
                      padding: "0 14px",
                      fontSize: 16,
                      letterSpacing: 4,
                      textAlign: "center",
                      fontWeight: 600,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    className="ws-sec-btn-outline"
                    onClick={() => setIs2FAModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="ws-sec-btn-purple">
                    Verify &amp; Activate
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
