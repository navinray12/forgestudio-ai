import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { identityRequest } from "../features/identity/identity-api";
export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN" | "PLATFORM_ADMIN" | "SUPPORT_ADMIN" | "DEVELOPER" | "AI_CONTENT_ADMIN" | "TEAM_MEMBER";
export interface AuthUser {
  id: string; fullName: string | null; email: string | null; phone: string | null; role: UserRole;
  status: string; emailVerified: boolean; phoneVerified: boolean; lastLoginAt: string | null;
}
interface AuthContextType {
  user: AuthUser | null; loading: boolean; isAuthenticated: boolean;
  checkAuth: () => Promise<void>; logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const checkAuth = useCallback(async () => {
    request.current?.abort(); const abort = new AbortController(); request.current = abort;
    const epoch = ++generation.current;
    try {
      const result = await identityRequest<{ data: { user: AuthUser } }>("/me", undefined, abort.signal);
      if (epoch === generation.current && !abort.signal.aborted) setUser(result.data.user);
    } catch {
      if (epoch === generation.current && !abort.signal.aborted) setUser(null);
    }
  }, []);
  const logout = async () => {
    ++generation.current; request.current?.abort();
    await identityRequest("/logout", {});
    setUser(null); // Do not report logout success while the server-side session remains active.
  };
  useEffect(() => {
    // Remove the obsolete browser-generated support-token cache, not business drafts.
    try { localStorage.removeItem("forgestudio_support_tokens"); } catch { /* Browser storage may be unavailable. */ }
    // StrictMode and remounts can settle an aborted bootstrap after the next
    // setup starts. Only the mounted effect may release the route's loading gate.
    let active = true;
    void checkAuth().finally(() => { if (active) setLoading(false); });
    return () => { active = false; ++generation.current; request.current?.abort(); };
  }, [checkAuth]);
  return <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, checkAuth, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext); if (!context) throw new Error("useAuth requires AuthProvider");
  return context;
}
