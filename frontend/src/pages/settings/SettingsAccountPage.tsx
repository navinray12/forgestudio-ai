import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe, Trash2, User as UserIcon, Check, Loader2, Save } from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { useAuth } from "../../context/AuthContext";
import "./Settings.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function SettingsAccountPage() {
  const { user, checkAuth } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile fields initialized from authenticated user
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Preferences
  const [city, setCity] = useState("New York");
  const [timezone, setTimezone] = useState("UTC/GMT -4 hours");
  const [dateTimeFormat, setDateTimeFormat] = useState("dd/mm/yyyy 00:00");

  const [dailyUtilization, setDailyUtilization] = useState(7);
  const [coreWorkMin, setCoreWorkMin] = useState(3);
  const [coreWorkMax, setCoreWorkMax] = useState(6);

  const [jobFunction, setJobFunction] = useState("Design");
  const [jobTitle, setJobTitle] = useState("Team Lead designer");

  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Sync state with current authenticated user
  useEffect(() => {
    if (user && !isInitialized) {
      const full = (user.fullName || "").trim();
      if (full) {
        const parts = full.split(/\s+/);
        setName(parts[0] || "");
        setSurname(parts.slice(1).join(" ") || "");
      } else if (user.email) {
        setName(user.email.split("@")[0] || "");
        setSurname("");
      }
      if (user.email) {
        setEmail(user.email);
      }
      setIsInitialized(true);
    }
  }, [user, isInitialized]);

  // Load preferences from backend
  useEffect(() => {
    async function loadPreferences() {
      try {
        const token = localStorage.getItem("token");
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
          headers,
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          const u = data.data?.user;
          if (u) {
            if (u.fullName) {
              const parts = u.fullName.trim().split(/\s+/);
              setName(parts[0] || "");
              setSurname(parts.slice(1).join(" ") || "");
            }
            if (u.email) {
              setEmail(u.email);
            }
            if (u.preferences) {
              if (u.preferences.city) setCity(u.preferences.city);
              if (u.preferences.timezone) setTimezone(u.preferences.timezone);
              if (u.preferences.dateTimeFormat) setDateTimeFormat(u.preferences.dateTimeFormat);
              if (u.preferences.dailyUtilization) setDailyUtilization(u.preferences.dailyUtilization);
              if (Array.isArray(u.preferences.coreWorkRange)) {
                setCoreWorkMin(u.preferences.coreWorkRange[0] || 3);
                setCoreWorkMax(u.preferences.coreWorkRange[1] || 6);
              }
              if (u.preferences.function) setJobFunction(u.preferences.function);
              if (u.preferences.jobTitle) setJobTitle(u.preferences.jobTitle);
            }
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
    void loadPreferences();
  }, []);

  const showNotification = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showNotification("First name cannot be empty.", true);
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      showNotification("A valid email address is required.", true);
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const fullName = `${name.trim()} ${surname.trim()}`.trim();
      const payload = {
        fullName,
        email: email.trim().toLowerCase(),
        city,
        timezone,
        dateTimeFormat,
        dailyUtilization,
        coreWorkRange: [coreWorkMin, coreWorkMax],
        function: jobFunction,
        jobTitle,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // Try /api/v1/auth/me then /api/v1/me
      let res = await fetch(`${API_BASE}/api/v1/auth/me`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok && res.status === 404) {
        res = await fetch(`${API_BASE}/api/v1/me`, {
          method: "PATCH",
          headers,
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }

      const resData = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(resData?.message || resData?.error?.message || "Failed to save profile");
      }

      // Re-fetch current user through shared AuthContext so header updates immediately
      await checkAuth();

      showNotification("Account settings saved successfully");
    } catch (err: any) {
      showNotification(err?.message || "Failed to save account settings", true);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
      showNotification("Profile photo updated");
    }
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    showNotification("Profile photo removed");
  };

  // Slider position calculations (scale 1 to 12)
  const utilPercent = Math.max(0, Math.min(100, ((dailyUtilization - 1) / 11) * 100));
  const coreMinPercent = Math.max(0, Math.min(100, ((coreWorkMin - 1) / 11) * 100));
  const coreMaxPercent = Math.max(0, Math.min(100, ((coreWorkMax - 1) / 11) * 100));

  const displayInitial = (name.trim() || user?.fullName?.trim() || user?.email || "U").charAt(0).toUpperCase();

  return (
    <SettingsLayout activeTab="account">
      <div className="ws-account-container">
        {/* Page Title & Subtitle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <h1 className="ws-page-title">Settings</h1>
            <p className="ws-page-subtitle" style={{ margin: "6px 0 0" }}>
              Manage your account settings and preferences
            </p>
          </div>
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

        {/* SECTION 1: Profile */}
        <section className="ws-section-row divided" aria-label="Profile">
          <div className="ws-section-info">
            <h2 className="ws-section-title">Profile</h2>
            <p className="ws-section-desc">Set your account details</p>

            <div className="ws-avatar-container">
              <div className="ws-avatar-ring">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile Avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      fontWeight: 700,
                      color: "#ffffff",
                      backgroundColor: "#9333ea",
                    }}
                  >
                    {displayInitial}
                  </div>
                )}
              </div>

              <div className="ws-avatar-controls">
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept="image/*"
                  onChange={handlePhotoSelect}
                />
                <button
                  type="button"
                  className="ws-btn-pill"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Edit photo
                </button>
                <button
                  type="button"
                  className="ws-btn-icon-sq"
                  onClick={handleRemovePhoto}
                  aria-label="Delete photo"
                  title="Remove photo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="ws-section-content">
            <div className="ws-form-grid-2">
              <div className="ws-field-group">
                <label className="ws-label" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  className="ws-input"
                  placeholder="First name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="ws-field-group">
                <label className="ws-label" htmlFor="surname">
                  Surname
                </label>
                <input
                  id="surname"
                  className="ws-input"
                  placeholder="Last name"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                />
              </div>
            </div>

            <div className="ws-field-group" style={{ marginTop: 20 }}>
              <label className="ws-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="ws-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* SECTION 2: Timezone & preferences */}
        <section className="ws-section-row divided" aria-label="Timezone and preferences">
          <div className="ws-section-info">
            <h2 className="ws-section-title">Timezone &amp; preferences</h2>
            <p className="ws-section-desc">
              Let us know the time zone and{"\n"}format
            </p>
          </div>

          <div className="ws-section-content">
            <div className="ws-form-grid-3">
              <div className="ws-field-group">
                <label className="ws-label" htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  className="ws-input"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div className="ws-field-group">
                <label className="ws-label" htmlFor="timezone">
                  Timezone
                </label>
                <div className="ws-select-wrap">
                  <select
                    id="timezone"
                    className="ws-select"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    <option value="UTC/GMT -4 hours">UTC/GMT -4 hours</option>
                    <option value="UTC/GMT -5 hours">UTC/GMT -5 hours</option>
                    <option value="UTC/GMT +0 hours">UTC/GMT +0 hours</option>
                    <option value="UTC/GMT +1 hours">UTC/GMT +1 hours</option>
                    <option value="UTC/GMT +5:30 hours">UTC/GMT +5:30 hours</option>
                  </select>
                  <ChevronDown size={14} className="ws-select-chevron" />
                </div>
              </div>

              <div className="ws-field-group">
                <label className="ws-label" htmlFor="dateTimeFormat">
                  Date &amp; Time format
                </label>
                <div className="ws-select-wrap">
                  <select
                    id="dateTimeFormat"
                    className="ws-select"
                    value={dateTimeFormat}
                    onChange={(e) => setDateTimeFormat(e.target.value)}
                  >
                    <option value="dd/mm/yyyy 00:00">dd/mm/yyyy 00:00</option>
                    <option value="mm/dd/yyyy 00:00">mm/dd/yyyy 00:00</option>
                    <option value="yyyy-mm-dd 00:00">yyyy-mm-dd 00:00</option>
                    <option value="dd MMM yyyy 12:00 AM">dd MMM yyyy 12:00 AM</option>
                  </select>
                  <ChevronDown size={14} className="ws-select-chevron" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: Motivation & Performance setup */}
        <section className="ws-section-row divided" aria-label="Motivation and Performance setup">
          <div className="ws-section-info">
            <h2 className="ws-section-title">
              Motivation &amp; Performance{"\n"}setup
            </h2>
            <p className="ws-section-desc">Calibrate your desired activity levels</p>

            <div
              className="ws-learn-badge"
              role="button"
              tabIndex={0}
              onClick={() => showNotification("Work time classification opened")}
            >
              <span>Learn more about work time{"\n"}classification</span>
              <Globe size={15} style={{ flexShrink: 0 }} />
            </div>
          </div>

          <div className="ws-section-content">
            <div className="ws-form-grid-2" style={{ gap: 36 }}>
              {/* Slider 1: Desired daily time utilization */}
              <div className="ws-slider-card">
                <span className="ws-slider-title">
                  Desired daily time utilization: {dailyUtilization} hrs
                </span>
                <div
                  className="ws-slider-track"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const val = Math.round(1 + ratio * 11);
                    setDailyUtilization(val);
                  }}
                >
                  <div
                    className="ws-slider-fill"
                    style={{ left: 0, width: `${utilPercent}%` }}
                  />
                  <div
                    className="ws-slider-thumb"
                    style={{ left: `${utilPercent}%` }}
                    title={`${dailyUtilization} hrs`}
                  />
                </div>
                <p className="ws-slider-desc">
                  Find the perfect allocation that suits your workflow and{"\n"}maximizes your potential.
                </p>
              </div>

              {/* Slider 2: Desired daily core work range */}
              <div className="ws-slider-card">
                <span className="ws-slider-title">
                  Desired daily core work range: {coreWorkMin}-{coreWorkMax} hrs
                </span>
                <div
                  className="ws-slider-track"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const val = Math.round(1 + ratio * 11);
                    if (Math.abs(val - coreWorkMin) < Math.abs(val - coreWorkMax)) {
                      setCoreWorkMin(Math.min(val, coreWorkMax - 1));
                    } else {
                      setCoreWorkMax(Math.max(val, coreWorkMin + 1));
                    }
                  }}
                >
                  <div
                    className="ws-slider-fill"
                    style={{
                      left: `${coreMinPercent}%`,
                      width: `${coreMaxPercent - coreMinPercent}%`,
                    }}
                  />
                  <div
                    className="ws-slider-thumb"
                    style={{ left: `${coreMinPercent}%` }}
                    title={`${coreWorkMin} hrs`}
                  />
                  <div
                    className="ws-slider-thumb"
                    style={{ left: `${coreMaxPercent}%` }}
                    title={`${coreWorkMax} hrs`}
                  />
                </div>
                <p className="ws-slider-desc">
                  Define the critical hours dedicated to your most important tasks,{"\n"}ensuring heightened focus and productivity during peak{"\n"}performance times.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: Your work */}
        <section className="ws-section-row" aria-label="Your work">
          <div className="ws-section-info">
            <h2 className="ws-section-title">Your work</h2>
            <p className="ws-section-desc">Add info about your position</p>
          </div>

          <div className="ws-section-content">
            <div className="ws-form-grid-2">
              <div className="ws-field-group">
                <label className="ws-label" htmlFor="function">
                  Function
                </label>
                <input
                  id="function"
                  className="ws-input"
                  value={jobFunction}
                  onChange={(e) => setJobFunction(e.target.value)}
                />
              </div>

              <div className="ws-field-group">
                <label className="ws-label" htmlFor="jobTitle">
                  Job Title
                </label>
                <input
                  id="jobTitle"
                  className="ws-input"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Live Feedback Toast */}
        {toastMsg && (
          <div
            className="ws-toast"
            style={toastMsg.isError ? { borderColor: "#ef4444", color: "#fca5a5" } : {}}
          >
            <Check size={16} color={toastMsg.isError ? "#ef4444" : "#c084fc"} />
            <span>{toastMsg.text}</span>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
