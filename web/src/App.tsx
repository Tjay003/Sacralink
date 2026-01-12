import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Pages
import LoginPage from './pages/auth/LoginPage.tsx';
import RegisterPage from './pages/auth/RegisterPage.tsx';
import DashboardPage from './pages/dashboard/DashboardPage.tsx';
import ChurchesPage from './pages/churches/ChurchesPage.tsx';
import AppointmentsPage from './pages/appointments/AppointmentsPage.tsx';
import DonationsPage from './pages/donations/DonationsPage.tsx';
import AnnouncementsPage from './pages/announcements/AnnouncementsPage.tsx';
import UsersPage from './pages/admin/UsersPage.tsx';

// Layout
import DashboardLayout from './components/layout/DashboardLayout.tsx';
import LoadingSpinner from './components/ui/LoadingSpinner.tsx';

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in - show login page
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Logged in - check role-based access
  console.log('🔐 Access Check:', {
    hasUser: !!user,
    hasProfile: !!profile,
    profileRole: profile?.role,
    allowedRoles: ['user', 'admin', 'super_admin'],
    isAllowed: profile && ['user', 'admin', 'super_admin'].includes(profile.role)
  });

  // User doesn't have required role - show access denied
  if (!profile || !['user', 'admin', 'super_admin'].includes(profile.role)) {
    console.warn('❌ Access denied - invalid role');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card p-8 max-w-md">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
          <p className="text-muted mb-4">
            Your account doesn't have permission to access this application.
          </p>
          <p className="text-sm text-muted mb-4">
            Debug: {profile ? `Role: ${profile.role}` : 'No profile loaded'}
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="btn-primary"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // User has valid role - show dashboard
  console.log('✅ Access granted - role:', profile.role);

  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="churches" element={<ChurchesPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="donations" element={<DonationsPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
