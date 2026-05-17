import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccess, type AppPermission } from '../../lib/permissions';
import { isSubscriptionAllowed } from '../../lib/subscription';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

export default function ProtectedRoute({
  requireAgency = true,
  requireSuperAdmin = false,
  requiredPermission,
}: {
  requireAgency?: boolean;
  requireSuperAdmin?: boolean;
  requiredPermission?: AppPermission;
}) {
  const { isSupabaseEnabled, loading, session, agencyId, profile, user } = useAuth();
  const location = useLocation();

  if (!isSupabaseEnabled) {
    return requireSuperAdmin ? <Navigate to="/auth" replace state={{ from: location }} /> : <Outlet />;
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-carbon-950 px-4 light:bg-carbon-50">
        <Card className="w-full max-w-md p-6">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-5 h-10 w-full" />
          <Skeleton className="mt-3 h-10 w-5/6" />
        </Card>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (requireSuperAdmin) {
    return profile?.isSuperAdmin ? <Outlet /> : <Navigate to="/dashboard" replace />;
  }

  if (profile?.isSuperAdmin) {
    return <Navigate to="/super-admin" replace />;
  }

  if (requireAgency && !agencyId) {
    return <Navigate to={`/demande-acces?from=login${user?.email ? `&email=${encodeURIComponent(user.email)}` : ''}`} replace />;
  }

  if (requireAgency && profile?.accountStatus && profile.accountStatus !== 'active') {
    return <Navigate to="/account-status" replace />;
  }

  if (requireAgency && !isSubscriptionAllowed(profile?.agency)) {
    return <Navigate to="/payment-required" replace />;
  }

  if (requiredPermission && !canAccess(profile?.role, requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
