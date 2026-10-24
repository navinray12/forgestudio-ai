import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { invitationReturnFromDashboard } from "./invitation-context";

export function InvitationAuthReturn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const target = !loading && user?.status === "ACTIVE" ? invitationReturnFromDashboard() : null;
  return target ? <Navigate to={target} replace /> : children;
}
