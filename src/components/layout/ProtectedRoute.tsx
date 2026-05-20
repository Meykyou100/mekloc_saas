import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { canAccess, type AppPermission } from '../../lib/permissions';
import { isSubscriptionAllowed } from '../../lib/subscription';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

function RouteLoadingState() {
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

export default function ProtectedRoute({
  requireAgency = true,
  requireSuperAdmin = false,
  requiredPermission,
}: {
  requireAgency?: boolean;
  requireSuperAdmin?: boolean;
  requiredPermission?: AppPermission;
}) {
  const {
    isSupabaseEnabled,
    loading,
    session,
    agencyId,
    profile,
    profileLoadError,
    refreshProfile,
    user,
    getAccessRequestStatusByEmail,
    isInitialized,
  } = useAuth();
  const location = useLocation();
  const [accessStatus, setAccessStatus] = useState<string | null>(null);
  const [accessStatusLoading, setAccessStatusLoading] = useState(false);
  const [accessStatusChecked, setAccessStatusChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const email = user?.email;

    if (!isSupabaseEnabled || !requireAgency || !isInitialized || loading || !session || agencyId || profile || !email) {
      setAccessStatus(null);
      setAccessStatusLoading(false);
      setAccessStatusChecked(false);
      return undefined;
    }

    setAccessStatusLoading(true);
    setAccessStatusChecked(false);
    getAccessRequestStatusByEmail(email)
      .then((request) => {
        if (!cancelled) {
          setAccessStatus(request?.status ?? null);
          if (import.meta.env.DEV) {
            console.log('MekLoc route access lookup', {
              userId: user?.id,
              email,
              profileFound: Boolean(profile),
              agencyId,
              accessStatus: request?.status ?? null,
              reason: request?.status ? 'access_request_found' : 'no_profile_no_access_request',
            });
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAccessStatus('lookup_error');
          if (import.meta.env.DEV) {
            console.log('MekLoc route access lookup failed', {
              userId: user?.id,
              email,
              error: error instanceof Error ? error.message : error,
              reason: 'access_lookup_failed_no_redirect',
            });
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAccessStatusChecked(true);
          setAccessStatusLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [agencyId, getAccessRequestStatusByEmail, isInitialized, isSupabaseEnabled, loading, profile, requireAgency, session, user?.email]);

  if (!isSupabaseEnabled) {
    return requireSuperAdmin ? <Navigate to="/auth" replace state={{ from: location }} /> : <Outlet />;
  }

  if (!isInitialized || (loading && !session && !profile)) {
    return <RouteLoadingState />;
  }

  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (profileLoadError) {
    return (
      <div className="grid min-h-screen place-items-center bg-carbon-950 px-4 light:bg-carbon-50">
        <Card className="w-full max-w-md p-6 text-center">
          <p className="text-lg font-semibold text-white light:text-carbon-950">Connexion conservée</p>
          <p className="mt-2 text-sm text-carbon-400">
            Votre session est active, mais le profil agence n’a pas pu être chargé. Vérifiez votre connexion puis réessayez.
          </p>
          <button
            type="button"
            className="focus-ring mt-5 rounded-xl bg-gold-400 px-4 py-2 text-sm font-semibold text-carbon-950"
            onClick={() => refreshProfile().catch(() => undefined)}
          >
            Réessayer
          </button>
        </Card>
      </div>
    );
  }

  if (requireSuperAdmin) {
    return profile?.isSuperAdmin ? <Outlet /> : <Navigate to="/dashboard" replace />;
  }

  if (profile?.isSuperAdmin) {
    return <Navigate to="/super-admin" replace />;
  }

  if (requireAgency && !agencyId) {
    if (!profile && user?.email && (accessStatusLoading || !accessStatusChecked)) {
      return <RouteLoadingState />;
    }
    if (!profile && accessStatus === 'approved') {
      return (
        <div className="grid min-h-screen place-items-center bg-carbon-950 px-4 light:bg-carbon-50">
          <Card className="w-full max-w-md p-6 text-center">
            <p className="text-lg font-semibold text-white light:text-carbon-950">Accès approuvé</p>
            <p className="mt-2 text-sm text-carbon-400">
              Votre session est active et votre demande est approuvée. Le profil agence n’est pas encore disponible.
            </p>
            <button
              type="button"
              className="focus-ring mt-5 rounded-xl bg-gold-400 px-4 py-2 text-sm font-semibold text-carbon-950"
              onClick={() => refreshProfile().catch(() => undefined)}
            >
              Recharger le profil
            </button>
          </Card>
        </div>
      );
    }
    if (!profile && accessStatus === 'lookup_error') {
      return (
        <div className="grid min-h-screen place-items-center bg-carbon-950 px-4 light:bg-carbon-50">
          <Card className="w-full max-w-md p-6 text-center">
            <p className="text-lg font-semibold text-white light:text-carbon-950">Vérification impossible</p>
            <p className="mt-2 text-sm text-carbon-400">
              Votre connexion est active, mais MekLoc n’a pas pu vérifier le profil agence. Réessayez dans quelques secondes.
            </p>
            <button
              type="button"
              className="focus-ring mt-5 rounded-xl bg-gold-400 px-4 py-2 text-sm font-semibold text-carbon-950"
              onClick={() => refreshProfile().catch(() => undefined)}
            >
              Réessayer
            </button>
          </Card>
        </div>
      );
    }
    if (!profile && accessStatus && ['pending', 'pending_verification', 'contacted', 'verified'].includes(accessStatus)) {
      return <Navigate to={`/verification-en-cours?email=${encodeURIComponent(user?.email || '')}&status=${encodeURIComponent(accessStatus)}`} replace />;
    }
    if (!profile && accessStatus === 'payment_pending') {
      return <Navigate to="/payment-required" replace />;
    }
    if (!profile && accessStatus === 'rejected') {
      return <Navigate to="/account-status" replace />;
    }
    if (import.meta.env.DEV) {
      console.log('MekLoc route redirect decision', {
        userId: user?.id,
        email: user?.email,
        profileFound: Boolean(profile),
        agencyId,
        accessStatus,
        reason: 'no_profile_no_approved_access_redirect_demande_acces',
      });
    }
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
