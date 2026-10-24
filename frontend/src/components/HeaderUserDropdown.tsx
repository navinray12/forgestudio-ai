import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, HelpCircle, LogOut, Settings, Shield, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface HeaderUserDropdownProps {
  className?: string;
  avatarStyle?: "pill" | "badge";
}

export const HeaderUserDropdown: React.FC<HeaderUserDropdownProps> = ({
  className = "",
  avatarStyle = "pill",
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const rawName = user?.fullName?.trim() || "";
  const emailPrefix = user?.email ? user.email.split("@")[0] : "";
  const displayName = rawName || emailPrefix || "User";
  const initial = (displayName.charAt(0) || "U").toUpperCase();
  const email = user?.email || "";

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  const handleNavigateAccount = () => {
    setOpen(false);
    navigate("/settings/account");
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      className={className}
    >
      <button
        type="button"
        aria-label="Open profile menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: 8,
          color: "#ffffff",
          transition: "background-color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            backgroundColor: "#9333ea",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initial}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#e2e0ed",
            maxWidth: 140,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {displayName}
        </span>
        <ChevronDown
          size={13}
          style={{
            color: "#9993b4",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="User profile options"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 200,
            backgroundColor: "#141126",
            border: "1px solid #2e284f",
            borderRadius: 12,
            padding: "6px",
            boxShadow: "0 14px 34px rgba(0, 0, 0, 0.55)",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {/* User info summary header */}
          <div
            style={{
              padding: "8px 10px",
              borderBottom: "1px solid #231f3f",
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#ffffff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </div>
            {email && (
              <div
                style={{
                  fontSize: 11,
                  color: "#837d9e",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginTop: 2,
                }}
              >
                {email}
              </div>
            )}
          </div>

          {/* Option: My Account */}
          <button
            type="button"
            role="menuitem"
            onClick={handleNavigateAccount}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "transparent",
              color: "#d8d3e8",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#211a3d";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#d8d3e8";
            }}
          >
            <User size={15} color="#a855f7" />
            <span>My Account</span>
          </button>

          {/* Option: Settings */}
          <button
            type="button"
            role="menuitem"
            onClick={handleNavigateAccount}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "transparent",
              color: "#d8d3e8",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#211a3d";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#d8d3e8";
            }}
          >
            <Settings size={15} color="#a855f7" />
            <span>Settings</span>
          </button>

          {/* Option: Security */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/settings/security");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "transparent",
              color: "#d8d3e8",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#211a3d";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#d8d3e8";
            }}
          >
            <Shield size={15} color="#a855f7" />
            <span>Security</span>
          </button>

          {/* Option: Help & Support */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/settings/help-support");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "transparent",
              color: "#d8d3e8",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#211a3d";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#d8d3e8";
            }}
          >
            <HelpCircle size={15} color="#a855f7" />
            <span>Help &amp; Support</span>
          </button>

          <div
            style={{
              height: 1,
              backgroundColor: "#231f3f",
              margin: "4px 0",
            }}
          />

          {/* Option: Log Out */}
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "transparent",
              color: "#f87171",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#2a1523";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <LogOut size={15} />
            <span>Log Out</span>
          </button>
        </div>
      )}
    </div>
  );
};
