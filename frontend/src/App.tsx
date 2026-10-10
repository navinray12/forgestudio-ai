import React, { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AuthProvider, useAuth, type UserRole } from "./context/AuthContext";
import { AccessibilityProvider } from "./context/AccessibilityContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import UserDashboard from "./pages/dashboard/UserDashboard";

// Route-based code splitting for optimal initial bundle size and load performance
const AdminDashboard = lazy(() => import("./pages/dashboard/AdminDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/dashboard/SuperAdminDashboard"));
const SubscriptionPage = lazy(() => import("./pages/subscriptions/SubscriptionPage"));
const WebsiteEditor = lazy(() => import("./features/editor-access/EditorRoute"));
const DeveloperWorkspace = lazy(() => import("./features/developer-workspace/pages/DeveloperWorkspace"));
const CustomPostTypesList = lazy(() => import("./pages/dashboard/CustomPostTypesList"));
const CustomPostTypeBuilder = lazy(() => import("./pages/dashboard/CustomPostTypeBuilder"));
const CustomEntriesList = lazy(() => import("./pages/dashboard/CustomEntriesList"));
const CustomEntryEditor = lazy(() => import("./pages/dashboard/CustomEntryEditor"));
const SharedTemplatePreviewPage = lazy(() => import("./pages/templates/SharedTemplatePreviewPage"));
const PublishedSite = lazy(() => import("./pages/published/PublishedSite"));
const PlatformControlPage = lazy(() => import("./features/platform-control/PlatformControlPage"));
const DatabaseStudioPage = lazy(() => import("./features/database-studio/pages/DatabaseStudioPage"));

const TicketListPage = lazy(() => import("./features/support/pages/TicketList").then(m => ({ default: m.TicketListPage })));
const CreateTicketPage = lazy(() => import("./features/support/pages/CreateTicket").then(m => ({ default: m.CreateTicketPage })));
const TicketDetailsPage = lazy(() => import("./features/support/pages/TicketDetails").then(m => ({ default: m.TicketDetailsPage })));
const SupportAdminViewPage = lazy(() => import("./features/support/pages/SupportAdminView").then(m => ({ default: m.SupportAdminViewPage })));
const ForumPage = lazy(() => import("./features/forum/pages/ForumPage"));
interface RoleRouteProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

function RoleRoute({
  allowedRoles,
  children,
}: RoleRouteProps) {
  const { user, loading } = useAuth();

  // Auth state loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Loading...
        </p>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Account is not active
  if (user.status !== "ACTIVE") {
    return <Navigate to="/login" replace />;
  }

  // Role not allowed
  if (!allowedRoles.includes(user.role)) {
    switch (user.role) {
      case "PLATFORM_ADMIN":
        return <Navigate to="/platform-control" replace />;

      case "SUPER_ADMIN":
        return <Navigate to="/super-admin" replace />;

      case "ADMIN":
        return <Navigate to="/admin" replace />;

      case "USER":
      default:
        return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

function LoginRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Loading...
        </p>
      </div>
    );
  }

  if (user) {
    switch (user.role) {
      case "PLATFORM_ADMIN":
        return <Navigate to="/platform-control" replace />;

      case "SUPER_ADMIN":
        return (
          <Navigate
            to="/super-admin"
            replace
          />
        );

      case "ADMIN":
        return (
          <Navigate
            to="/admin"
            replace
          />
        );

      case "USER":
      default:
        return (
          <Navigate
            to="/dashboard"
            replace
          />
        );
    }
  }

  return <LoginPage />;
}

function SignupRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Loading...
        </p>
      </div>
    );
  }

  if (user) {
    switch (user.role) {
      case "SUPER_ADMIN":
        return (
          <Navigate
            to="/super-admin"
            replace
          />
        );

      case "ADMIN":
        return (
          <Navigate
            to="/admin"
            replace
          />
        );

      case "USER":
      default:
        return (
          <Navigate
            to="/dashboard"
            replace
          />
        );
    }
  }

  return <SignupPage />;
}

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Loading...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case "PLATFORM_ADMIN":
      return <Navigate to="/platform-control" replace />;

    case "SUPER_ADMIN":
      return <Navigate to="/super-admin" replace />;

    case "ADMIN":
      return <Navigate to="/admin" replace />;

    case "USER":
    default:
      return <Navigate to="/dashboard" replace />;
  }
}

const RouteLoading = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      <span className="text-xs font-mono uppercase tracking-widest text-slate-500">Loading ForgeStudio...</span>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AccessibilityProvider>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<RouteLoading />}>
              <Routes>

          {/* ================= AUTH ================= */}

          <Route
            path="/login"
            element={<LoginRoute />}
          />
          <Route
            path="/signup"
            element={<SignupRoute />}
          />

          {/* ================= PUBLIC SHARED TEMPLATES ================= */}

          <Route
            path="/template/share/:shareToken"
            element={<SharedTemplatePreviewPage />}
          />

          {/* ================= PUBLIC PUBLISHED SITE ================= */}

          <Route
            path="/site/:websiteId"
            element={<PublishedSite />}
          />
          <Route
            path="/site/:websiteId/:pageSlug"
            element={<PublishedSite />}
          />

          {/* ================= AUTHENTICATED DRAFT PREVIEW ================= */}
          <Route
            path="/preview/site/:websiteId"
            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]}>
                <PublishedSite isPreviewMode={true} />
              </RoleRoute>
            }
          />
          <Route
            path="/preview/site/:websiteId/:pageSlug"
            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]}>
                <PublishedSite isPreviewMode={true} />
              </RoleRoute>
            }
          />

          {/* ================= PLATFORM CONTROL (separate auth audience/cookie) ================= */}
          <Route path="/platform-control" element={<PlatformControlPage />} />

          {/* ================= ROOT ================= */}

          <Route
            path="/"
            element={<HomeRedirect />}
          />

          {/* ================= USER ================= */}

          <Route
            path="/dashboard"
            element={
              <RoleRoute allowedRoles={["USER"]}>
                <UserDashboard />
              </RoleRoute>
            }
          />

          <Route
            path="/subscriptions"
            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN"]}>
                <SubscriptionPage />
              </RoleRoute>
            }
          />

          {/* ================= DISCUSSION FORUM SYSTEM ================= */}
          <Route
            path="/forum"
            element={
              <RoleRoute allowedRoles={["USER", "TEAM_MEMBER", "SUPPORT_AGENT", "SUPPORT_MANAGER", "SUPPORT_ADMIN", "ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]}>
                <ForumPage />
              </RoleRoute>
            }
          />
          <Route
            path="/forum/*"
            element={
              <RoleRoute allowedRoles={["USER", "TEAM_MEMBER", "SUPPORT_AGENT", "SUPPORT_MANAGER", "SUPPORT_ADMIN", "ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]}>
                <ForumPage />
              </RoleRoute>
            }
          />

          {/* ================= SUPPORT TICKET SYSTEM ================= */}
          <Route
            path="/support"
            element={
              <RoleRoute allowedRoles={["USER", "TEAM_MEMBER", "SUPPORT_AGENT", "SUPPORT_MANAGER", "SUPPORT_ADMIN", "ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]}>
                <TicketListPage />
              </RoleRoute>
            }
          />
          <Route
            path="/support/new"
            element={
              <RoleRoute allowedRoles={["USER", "TEAM_MEMBER", "SUPPORT_AGENT", "SUPPORT_MANAGER", "SUPPORT_ADMIN", "ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]}>
                <CreateTicketPage />
              </RoleRoute>
            }
          />
          <Route
            path="/support/tickets/:id"
            element={
              <RoleRoute allowedRoles={["USER", "TEAM_MEMBER", "SUPPORT_AGENT", "SUPPORT_MANAGER", "SUPPORT_ADMIN", "ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]}>
                <TicketDetailsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/support/admin"
            element={
              <RoleRoute allowedRoles={["SUPPORT_AGENT", "SUPPORT_MANAGER", "SUPPORT_ADMIN", "ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]}>
                <SupportAdminViewPage />
              </RoleRoute>
            }
          />
          <Route
            path="/subscription"
            element={<Navigate to="/subscriptions" replace />}
          />

          <Route
            path="/editor/:websiteId"

            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN"]}>
                <WebsiteEditor />
              </RoleRoute>
            }
          />

          {/* ================= DATABASE STUDIO (CATEGORY F - MODULE 26) ================= */}
          <Route
            path="/dashboard/projects/:projectId/database"
            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]}>
                <DatabaseStudioPage />
              </RoleRoute>
            }
          />
          <Route
            path="/dashboard/database/:websiteId"
            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]}>
                <DatabaseStudioPage />
              </RoleRoute>
            }
          />

          <Route
            path="/workspace/:projectId"
            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]}>
                <DeveloperWorkspace />
              </RoleRoute>
            }
          />

          <Route
            path="/workspace/website/:websiteId"
            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]}>
                <DeveloperWorkspace />
              </RoleRoute>
            }
          />

          {/* ================= CUSTOM POST TYPES ================= */}

          <Route
            path="/dashboard/cpts/:websiteId"
            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN"]}>
                <CustomPostTypesList />
              </RoleRoute>
            }
          />

          <Route
            path="/dashboard/cpts/:websiteId/builder"
            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN"]}>
                <CustomPostTypeBuilder />
              </RoleRoute>
            }
          />

          <Route
            path="/dashboard/cpts/:websiteId/builder/:cptId"
            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN"]}>
                <CustomPostTypeBuilder />
              </RoleRoute>
            }
          />

          <Route
            path="/dashboard/cpts/:websiteId/entries/:cptId"
            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN"]}>
                <CustomEntriesList />
              </RoleRoute>
            }
          />

          <Route
            path="/dashboard/cpts/:websiteId/entries/:cptId/editor"
            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN"]}>
                <CustomEntryEditor />
              </RoleRoute>
            }
          />

          <Route
            path="/dashboard/cpts/:websiteId/entries/:cptId/editor/:entryId"
            element={
              <RoleRoute allowedRoles={["USER", "ADMIN", "SUPER_ADMIN"]}>
                <CustomEntryEditor />
              </RoleRoute>
            }
          />

          {/* ================= ADMIN ================= */}


          <Route
            path="/admin"
            element={
              <RoleRoute allowedRoles={["ADMIN"]}>
                <AdminDashboard />
              </RoleRoute>
            }
          />

          {/* ================= SUPER ADMIN ================= */}

          <Route
            path="/super-admin"
            element={
              <RoleRoute allowedRoles={["SUPER_ADMIN"]}>
                <SuperAdminDashboard />
              </RoleRoute>
            }
          />

          {/* ================= PLATFORM CONTROL ================= */}

          <Route
            path="/platform-control"
            element={
              <RoleRoute allowedRoles={["PLATFORM_ADMIN", "SUPER_ADMIN"]}>
                <PlatformControlPage />
              </RoleRoute>
            }
          />

          {/* ================= FALLBACK ================= */}

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

        </Routes>
        </Suspense>
        </ErrorBoundary>
        </AuthProvider>
      </AccessibilityProvider>
    </BrowserRouter>
  );
}

export default App;