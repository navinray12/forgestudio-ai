/**
 * LoginWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// 16. Login Inspector
export function LoginWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
        <span>🔐</span> Login Widget Settings
      </h3>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Card Title</label>
        <input
          type="text"
          value={el.loginTitle || "Welcome Back"}
          onChange={(e) => updateProp("loginTitle", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Subtitle</label>
        <input
          type="text"
          value={el.loginSubtitle || "Sign in to your account..."}
          onChange={(e) => updateProp("loginSubtitle", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Email Label</label>
          <input
            type="text"
            value={el.loginEmailLabel || "Email Address"}
            onChange={(e) => updateProp("loginEmailLabel", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Password Label</label>
          <input
            type="text"
            value={el.loginPasswordLabel || "Password"}
            onChange={(e) => updateProp("loginPasswordLabel", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Submit Button Text</label>
        <input
          type="text"
          value={el.loginButtonText || "Sign In"}
          onChange={(e) => updateProp("loginButtonText", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
        />
      </div>

      <div className="pt-2 border-t border-slate-100 space-y-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={el.loginShowRememberMe !== false}
            onChange={(e) => updateProp("loginShowRememberMe", e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Show "Remember me" Checkbox</span>
        </label>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={el.loginShowForgotPassword !== false}
            onChange={(e) => updateProp("loginShowForgotPassword", e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Show "Forgot password" Link</span>
        </label>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={el.loginShowSocialButtons !== false}
            onChange={(e) => updateProp("loginShowSocialButtons", e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Show Social Login Buttons</span>
        </label>
      </div>

      {el.loginShowForgotPassword !== false && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Forgot Password Text</label>
            <input
              type="text"
              value={el.loginForgotPasswordText || "Forgot password?"}
              onChange={(e) => updateProp("loginForgotPasswordText", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Forgot Password URL</label>
            <input
              type="text"
              value={el.loginForgotPasswordUrl || "#"}
              onChange={(e) => updateProp("loginForgotPasswordUrl", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
