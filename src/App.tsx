import { Navigate, Route, Routes } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Suspense, lazy, useEffect } from 'react';
import type { ComponentType } from 'react';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ToastViewport from './components/ui/ToastViewport';
import AccountStatusPage from './pages/AccountStatusPage';
import AuthPage from './pages/AuthPage';
const ClientProfilePage = lazyWithRetry(() => import('./pages/ClientProfilePage'));
const CalendarPage = lazyWithRetry(() => import('./pages/CalendarPage'));
const ClientsPage = lazyWithRetry(() => import('./pages/ClientsPage'));
const ContractsPage = lazyWithRetry(() => import('./pages/ContractsPage'));
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage'));
import DemandeAccesPage from './pages/DemandeAccesPage';
import LandingPage from './pages/LandingPage';
const MaintenancePage = lazyWithRetry(() => import('./pages/MaintenancePage'));
import NotFoundPage from './pages/NotFoundPage';
import OnboardingPage from './pages/OnboardingPage';
import PaymentRequiredPage from './pages/PaymentRequiredPage';
const PaymentsPage = lazyWithRetry(() => import('./pages/PaymentsPage'));
import PricingPage from './pages/PricingPage';
import PrivacyPage from './pages/PrivacyPage';
import PublicBookingPreviewPage from './pages/PublicBookingPreviewPage';
const ReportsPage = lazyWithRetry(() => import('./pages/ReportsPage'));
const ReservationsPage = lazyWithRetry(() => import('./pages/ReservationsPage'));
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage'));
import SetPasswordPage from './pages/SetPasswordPage';
const SuperAdminPage = lazyWithRetry(() => import('./pages/SuperAdminPage'));
const VehicleDetailsPage = lazyWithRetry(() => import('./pages/VehicleDetailsPage'));
const VehiclesPage = lazyWithRetry(() => import('./pages/VehiclesPage'));
import VerificationEnCoursPage from './pages/VerificationEnCoursPage';
import ConditionsPage from './pages/ConditionsPage';
import CancellationRefundPage from './pages/CancellationRefundPage';

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

function AppLoadingFallback() {
  return (
    <div className="min-h-screen bg-[#050505] px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-gold-300">Chargement</p>
        <h1 className="mt-3 text-2xl font-bold">MekLoc prépare votre espace</h1>
        <p className="mt-3 text-carbon-300">
          Si votre connexion est lente, le chargement peut prendre quelques secondes.
        </p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-gold-400" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    (window as Window & { __MEKLOC_APP_READY__?: boolean }).__MEKLOC_APP_READY__ = true;
    // Warm frequently used private pages to make route switching feel instant.
    void Promise.all([
      import('./pages/ClientsPage'),
      import('./pages/CalendarPage'),
      import('./pages/ContractsPage'),
      import('./pages/ReservationsPage'),
      import('./pages/VehiclesPage'),
      import('./pages/SettingsPage'),
    ]);
  }, []);

  return (
    <>
      <Suspense fallback={<AppLoadingFallback />}>
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
          <Route path="/demande-acces" element={<AnimatedPage><DemandeAccesPage /></AnimatedPage>} />
          <Route path="/verification-en-cours" element={<AnimatedPage><VerificationEnCoursPage /></AnimatedPage>} />
          <Route path="/conditions-utilisation" element={<AnimatedPage><ConditionsPage /></AnimatedPage>} />
          <Route path="/politique-confidentialite" element={<AnimatedPage><PrivacyPage /></AnimatedPage>} />
          <Route path="/annulation-remboursement" element={<AnimatedPage><CancellationRefundPage /></AnimatedPage>} />
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
            <Route path="/super-admin" element={<SuperAdminPage />} />
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
              </Route>
              <Route element={<ProtectedRoute requiredPermission="reports" />}>
                <Route path="/reports" element={<ReportsPage />} />
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
