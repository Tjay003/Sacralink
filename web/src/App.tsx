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

// Layout
import DashboardLayout from './components/layout/DashboardLayout.tsx';
import LoadingSpinner from './components/ui/LoadingSpinner.tsx';

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  // Show loading spinner while checking auth
  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  // Not logged in - show public routes
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Logged in but not admin - redirect to login (or show error)
  console.log('🔐 Access Check:', {
    hasUser: !!user,
    hasProfile: !!profile,
    profileRole: profile?.role,
    isAdmin: profile?.role === 'admin',
    isSuperAdmin: profile?.role === 'super_admin',
    willAllow: profile && ['admin', 'super_admin'].includes(profile.role)
  });

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    console.warn('❌ Access denied - showing error page');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card p-8 max-w-md">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
          <p className="text-muted mb-4">
            You don't have permission to access the admin dashboard.
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

  // Logged in as admin - show dashboard
  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
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
