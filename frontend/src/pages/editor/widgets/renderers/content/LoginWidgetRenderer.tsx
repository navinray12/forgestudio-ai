/**
 * LoginWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

export const LoginWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const title = el.loginTitle || "Welcome Back";
  const subtitle = el.loginSubtitle || "Sign in to your account to access your workspace.";
  const emailLabel = el.loginEmailLabel || "Email Address";
  const emailPlaceholder = el.loginEmailPlaceholder || "name@example.com";
  const passwordLabel = el.loginPasswordLabel || "Password";
  const passwordPlaceholder = el.loginPasswordPlaceholder || "••••••••";
  const showRemember = el.loginShowRememberMe !== false;
  const showForgot = el.loginShowForgotPassword !== false;
  const forgotText = el.loginForgotPasswordText || "Forgot password?";
  const forgotUrl = el.loginForgotPasswordUrl || "#";
  const buttonText = el.loginButtonText || "Sign In";
  const buttonBg = el.loginButtonBg || "#2563eb";
  const buttonColor = el.loginButtonColor || "#ffffff";
  const cardBg = el.loginCardBg || "#ffffff";
  const cardBorder = el.loginCardBorder || "#f1f5f9";
  const showSocial = el.loginShowSocialButtons !== false;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoggedIn(true);
  };

  const handleGoogleLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const apiUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:5000";
    window.location.href = `${apiUrl}/api/v1/auth/google`;
  };

  if (loggedIn) {
    return (
      <div
        className="w-full max-w-md mx-auto rounded-3xl border p-8 sm:p-10 text-center shadow-xl backdrop-blur-md transition-all animate-in fade-in zoom-in-95"
        style={{
          backgroundColor: cardBg,
          borderColor: cardBorder,
        }}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 mb-4 shadow-inner">
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h3 className="text-xl font-extrabold text-slate-900">Welcome Back!</h3>
        <p className="mt-2 text-xs sm:text-sm text-slate-500">
          You have successfully logged in as <span className="font-bold text-slate-800">{email || "user@example.com"}</span>.
        </p>
        <button
          type="button"
          onClick={() => {
            setLoggedIn(false);
            setEmail("");
            setPassword("");
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-200 active:scale-95 cursor-pointer shadow-xs"
        >
          <span>Sign Out / Reset</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-md mx-auto rounded-3xl p-6 sm:p-10 shadow-xl border transition-all duration-300"
      style={{
        backgroundColor: cardBg,
        borderColor: cardBorder,
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3 shadow-xs">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
        </div>
        <h3
          className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight"
          style={{ fontFamily: mergedStyles.fontFamily }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            className="mt-2 text-xs sm:text-sm text-slate-500 font-normal leading-relaxed"
            style={{ fontFamily: mergedStyles.fontFamily }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Social Login Options */}
      {showSocial && (
        <div className="space-y-3 mb-6">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-3 px-4 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:border-slate-300 active:scale-98 cursor-pointer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.4 8.9 5 12 5z" />
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
              <path fill="#FBBC05" d="M5.3 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.4C.6 9.4 0 11.6 0 14s.6 4.6 1.6 6.6l3.7-2.9z" />
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.4-6.7-5.3L1.6 16C3.5 19.8 7.4 23 12 23z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex items-center justify-center my-4">
            <div className="w-full border-t border-slate-200" />
            <span className="absolute bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Or sign in with email
            </span>
          </div>
        </div>
      )}

      {/* Form Inputs */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 tracking-wide">
            {emailLabel}
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-4 text-slate-400 pointer-events-none">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </span>
            <input
              type="email"
              required
              placeholder={emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 pl-11 pr-4 py-3 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition duration-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 tracking-wide">
            {passwordLabel}
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-4 text-slate-400 pointer-events-none">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              type={showPassword ? "text" : "password"}
              required
              placeholder={passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 pl-11 pr-11 py-3 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition duration-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Remember Me & Forgot Password */}
        {(showRemember || showForgot) && (
          <div className="flex items-center justify-between pt-1 text-xs">
            {showRemember ? (
              <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>Remember me</span>
              </label>
            ) : <div />}

            {showForgot && (
              <a
                href={forgotUrl}
                onClick={(e) => e.preventDefault()}
                className="font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                {forgotText}
              </a>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            className="group flex w-full items-center justify-center gap-2.5 rounded-2xl px-8 py-3.5 text-xs sm:text-sm font-extrabold shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
            style={{
              backgroundColor: buttonBg,
              color: buttonColor,
            }}
          >
            <span>{buttonText}</span>
            <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};
