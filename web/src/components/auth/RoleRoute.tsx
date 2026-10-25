import React from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types/database';

export interface AccessDeniedViewProps {
  title?: string;
  message?: string;
  buttonText?: string;
  redirectTo?: string;
}

export function AccessDeniedView({
  title = 'Access Denied',
  message = "You don't have permission to access this page.",
  buttonText = 'Back to Dashboard',
  redirectTo = '/dashboard',
}: AccessDeniedViewProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full text-center bg-white border border-border rounded-2xl shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-destructive flex items-center justify-center mx-auto mb-4 border border-red-100">
          <ShieldAlert className="w-7 h-7 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted text-sm mb-6">{message}</p>
        <button
          onClick={() => navigate(redirectTo)}
          className="btn-primary w-full py-2.5 px-4 rounded-xl font-medium"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}

interface RoleRouteProps {
  allowedRoles: UserRole[];
  children?: React.ReactNode;
}

export default function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  const userRole = profile?.role;
  const isAllowed = !!userRole && allowedRoles.includes(userRole);

  if (!isAllowed) {
    return <AccessDeniedView />;
  }

  return children ? <>{children}</> : <Outlet />;
}
