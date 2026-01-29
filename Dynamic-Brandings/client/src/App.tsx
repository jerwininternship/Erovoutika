import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { SystemSettingsProvider } from "@/hooks/use-system-settings";
import { Loader2 } from "lucide-react";

// Pages
import Login from "@/pages/auth/Login";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import Dashboard from "@/pages/dashboard/Dashboard";
import SubjectList from "@/pages/subjects/SubjectList";
import UserManagement from "@/pages/admin/UserManagement";
import SystemSettings from "@/pages/settings/SystemSettings"; {/* added new vince */ }
import Attendance from "@/pages/attendance/Attendance";
import AttendanceHistory from "@/pages/attendance/AttendanceHistory";
import StudentAttendance from "@/pages/attendance/StudentAttendance";
import Reports from "@/pages/reports/Reports";
import Profile from "@/pages/profile/Profile";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout/Layout";

function ProtectedRoute({ component: Component, allowedRoles }: { component: any; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user ? <Redirect to="/dashboard" /> : <Redirect to="/login" />;
}

// Role-based attendance component
function AttendanceRouter() {
  const { user } = useAuth();

  if (user?.role === 'student') {
    return <StudentAttendance />;
  }

  // Teachers and admins see the teacher attendance page
  return <Attendance />;
}

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Protected Routes */}
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>

      <Route path="/subjects">
        <ProtectedRoute component={SubjectList} />
      </Route>

      <Route path="/attendance">
        <ProtectedRoute component={AttendanceRouter} />
      </Route>

      <Route path="/attendance/history">
        <ProtectedRoute component={AttendanceHistory} allowedRoles={['teacher', 'superadmin']} />
      </Route>

      <Route path="/reports">
        <ProtectedRoute component={Reports} allowedRoles={['teacher', 'superadmin']} />
      </Route>

      <Route path="/users">
        <ProtectedRoute component={UserManagement} allowedRoles={['superadmin']} />
      </Route>

      <Route path="/settings">
        <ProtectedRoute component={SystemSettings} allowedRoles={['superadmin']} />
      </Route>

      <Route path="/profile">
        <ProtectedRoute component={Profile} />
      </Route>

      {/* Default Route */}
      <Route path="/" component={RootRedirect} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SystemSettingsProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </SystemSettingsProvider>
    </QueryClientProvider>
  );
}

export default App;
