import { Navigate, Route, Routes } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Suspense, lazy, useEffect } from 'react';
import type { ComponentType } from 'react';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ToastViewport from './components/ui/ToastViewport';
import MekLocLoader from './components/ui/MekLocLoader';
import SEO from './components/system/SEO';
import ActivationPage from './pages/ActivationPage';
import LandingPage from './pages/LandingPage';
import SeoLandingPage from './pages/SeoLandingPage';
const AppLayout = lazyWithRetry(() => import('./components/layout/AppLayout'));
const AccountStatusPage = lazyWithRetry(() => import('./pages/AccountStatusPage'));
const AuthPage = lazyWithRetry(() => import('./pages/AuthPage'));
const BlogArticlePage = lazyWithRetry(() => import('./pages/BlogArticlePage'));
const BlogPage = lazyWithRetry(() => import('./pages/BlogPage'));
const ClientProfilePage = lazyWithRetry(() => import('./pages/ClientProfilePage'));
const CalendarPage = lazyWithRetry(() => import('./pages/CalendarPage'));
const ClientsPage = lazyWithRetry(() => import('./pages/ClientsPage'));
const ContractsPage = lazyWithRetry(() => import('./pages/ContractsPage'));
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage'));
const FleetResponsiblesPage = lazyWithRetry(() => import('./pages/FleetResponsiblesPage'));
const MaintenancePage = lazyWithRetry(() => import('./pages/MaintenancePage'));
const AccidentsPage = lazyWithRetry(() => import('./pages/AccidentsPage'));
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'));
const OnboardingPage = lazyWithRetry(() => import('./pages/OnboardingPage'));
const PaymentRequiredPage = lazyWithRetry(() => import('./pages/PaymentRequiredPage'));
const PaymentsPage = lazyWithRetry(() => import('./pages/PaymentsPage'));
const PricingPage = lazyWithRetry(() => import('./pages/PricingPage'));
const PrivacyPage = lazyWithRetry(() => import('./pages/PrivacyPage'));
const PublicBookingPreviewPage = lazyWithRetry(() => import('./pages/PublicBookingPreviewPage'));
const ReportsPage = lazyWithRetry(() => import('./pages/ReportsPage'));
const ReservationsPage = lazyWithRetry(() => import('./pages/ReservationsPage'));
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage'));
const SetPasswordPage = lazyWithRetry(() => import('./pages/SetPasswordPage'));
const SuperAdminPage = lazyWithRetry(() => import('./pages/SuperAdminPage'));
const VehicleDetailsPage = lazyWithRetry(() => import('./pages/VehicleDetailsPage'));
const VehiclesPage = lazyWithRetry(() => import('./pages/VehiclesPage'));
const VerificationEnCoursPage = lazyWithRetry(() => import('./pages/VerificationEnCoursPage'));
const ConditionsPage = lazyWithRetry(() => import('./pages/ConditionsPage'));
const CancellationRefundPage = lazyWithRetry(() => import('./pages/CancellationRefundPage'));
const DemandeAccesPage = lazyWithRetry(() => import('./pages/DemandeAccesPage'));

const CHUNK_RELOAD_KEY = 'mekloc-chunk-reload-attempted';

function lazyWithRetry<T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const module = await importer();
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return module;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isChunkLoadIssue =
        /dynamically imported module|failed to fetch|loading chunk|mime type|text\/html/i.test(message);
      const alreadyRetried = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';

      if (isChunkLoadIssue && !alreadyRetried) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        return new Promise<never>(() => undefined);
      }

      throw error;
    }
  });
}

const pageMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.12, ease: 'easeOut' as const },
};

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return <motion.div {...pageMotion}>{children}</motion.div>;
}

export default function App() {
  useEffect(() => {
    (window as Window & { __MEKLOC_APP_READY__?: boolean }).__MEKLOC_APP_READY__ = true;
  }, []);

  return (
    <>
      <Suspense fallback={<MekLocLoader />}>
          <Routes>
          <Route
            path="/"
            element={
              <AnimatedPage>
                <LandingPage />
              </AnimatedPage>
            }
          />
          <Route
            path="/auth"
            element={
              <AnimatedPage>
                <AuthPage />
              </AnimatedPage>
            }
          />
          <Route
            path="/activation/:token"
            element={
              <AnimatedPage>
                <ActivationPage />
              </AnimatedPage>
            }
          />
          <Route
            path="/set-password"
            element={
              <AnimatedPage>
                <SetPasswordPage />
              </AnimatedPage>
            }
          />
          <Route
            path="/pricing"
            element={
              <AnimatedPage>
                <PricingPage />
              </AnimatedPage>
            }
          />
          <Route path="/tarifs" element={<AnimatedPage><PricingPage /></AnimatedPage>} />
          <Route path="/blog" element={<AnimatedPage><BlogPage /></AnimatedPage>} />
          <Route path="/blog/:slug" element={<AnimatedPage><BlogArticlePage /></AnimatedPage>} />
          <Route path="/contact" element={<AnimatedPage><SeoLandingPage path="/contact" /></AnimatedPage>} />
          <Route path="/logiciel-location-voiture-maroc" element={<AnimatedPage><SeoLandingPage path="/logiciel-location-voiture-maroc" /></AnimatedPage>} />
          <Route path="/contrats-location-voiture-pdf" element={<AnimatedPage><SeoLandingPage path="/contrats-location-voiture-pdf" /></AnimatedPage>} />
          <Route path="/gestion-flotte-location" element={<AnimatedPage><SeoLandingPage path="/gestion-flotte-location" /></AnimatedPage>} />
          <Route path="/demande-acces" element={<AnimatedPage><DemandeAccesPage /></AnimatedPage>} />
          <Route path="/verification-en-cours" element={<AnimatedPage><VerificationEnCoursPage /></AnimatedPage>} />
          <Route path="/conditions-utilisation" element={<AnimatedPage><ConditionsPage /></AnimatedPage>} />
          <Route path="/politique-confidentialite" element={<AnimatedPage><PrivacyPage /></AnimatedPage>} />
          <Route path="/annulation-remboursement" element={<AnimatedPage><CancellationRefundPage /></AnimatedPage>} />
          <Route path="/conditions" element={<AnimatedPage><ConditionsPage /></AnimatedPage>} />
          <Route path="/privacy" element={<AnimatedPage><PrivacyPage /></AnimatedPage>} />
          <Route path="/cancellation-refund" element={<AnimatedPage><CancellationRefundPage /></AnimatedPage>} />
          <Route
            path="/public-booking-preview"
            element={
              <AnimatedPage>
                <PublicBookingPreviewPage />
              </AnimatedPage>
            }
          />
          <Route element={<ProtectedRoute requireAgency={false} />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/account-status" element={<AccountStatusPage />} />
            <Route path="/payment-required" element={<PaymentRequiredPage />} />
          </Route>
          <Route element={<ProtectedRoute requireAgency={false} requireSuperAdmin />}>
            <Route path="/super-admin" element={<><SEO title="MekLoc – Super Admin" description="Espace privé administrateur MekLoc." canonical="/super-admin" noindex /><SuperAdminPage /></>} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route element={<ProtectedRoute requiredPermission="dashboard" />}>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="reservations" />}>
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/reservations" element={<ReservationsPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="vehicles" />}>
                <Route path="/vehicles" element={<VehiclesPage />} />
                <Route path="/vehicles/:id" element={<VehicleDetailsPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="clients" />}>
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/clients/:id" element={<ClientProfilePage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="contracts" />}>
                <Route path="/contracts" element={<ContractsPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="payments" />}>
                <Route path="/payments" element={<PaymentsPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="maintenance" />}>
                <Route path="/maintenance" element={<MaintenancePage />} />
                <Route path="/sinistres" element={<AccidentsPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="reports" />}>
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/responsables" element={<FleetResponsiblesPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="settings" />}>
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          <Route path="*" element={<NotFoundPage />} />
          </Routes>
      </Suspense>
      <ToastViewport />
    </>
  );
}
