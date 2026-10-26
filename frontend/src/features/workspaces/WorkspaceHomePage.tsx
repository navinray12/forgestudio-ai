import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { WorkspaceDashboardView } from "./WorkspaceDashboardView";
import { workspaceIdPattern } from "./invitation-context";

export default function WorkspaceHomePage() {
  const { workspaceId = "" } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return <p role="status" className="p-6">Loading workspace…</p>;
  if (!user || user.status !== "ACTIVE") return <Navigate to="/login" replace />;
  return <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
    <div className="mx-auto max-w-5xl space-y-5">
      <Link to="/dashboard" className="underline">Back to dashboard</Link>
      <h1 className="text-2xl font-semibold">Workspace dashboard</h1>
      {workspaceIdPattern.test(workspaceId) ? <WorkspaceDashboardView key={workspaceId}
        apiUrl={import.meta.env.VITE_API_URL || "http://localhost:5000"} workspaceId={workspaceId}
        onOpenWebsite={id => navigate(`/editor/${id}`)} /> : <p role="alert">Workspace not found.</p>}
    </div>
  </main>;
}
