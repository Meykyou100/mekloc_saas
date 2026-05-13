import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, lazy, useEffect } from 'react';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ToastViewport from './components/ui/ToastViewport';
import AccountStatusPage from './pages/AccountStatusPage';
import AuthPage from './pages/AuthPage';
const ClientProfilePage = lazy(() => import('./pages/ClientProfilePage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const ContractsPage = lazy(() => import('./pages/ContractsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
import DemandeAccesPage from './pages/DemandeAccesPage';
import LandingPage from './pages/LandingPage';
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
import NotFoundPage from './pages/NotFoundPage';
import OnboardingPage from './pages/OnboardingPage';
import PaymentRequiredPage from './pages/PaymentRequiredPage';
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
import PricingPage from './pages/PricingPage';
import PrivacyPage from './pages/PrivacyPage';
import PublicBookingPreviewPage from './pages/PublicBookingPreviewPage';
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ReservationsPage = lazy(() => import('./pages/ReservationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
import SetPasswordPage from './pages/SetPasswordPage';
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));
const VehicleDetailsPage = lazy(() => import('./pages/VehicleDetailsPage'));
const VehiclesPage = lazy(() => import('./pages/VehiclesPage'));
import VerificationEnCoursPage from './pages/VerificationEnCoursPage';
import ConditionsPage from './pages/ConditionsPage';
import CancellationRefundPage from './pages/CancellationRefundPage';

const pageMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: 'easeOut' as const },
};

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return <motion.div {...pageMotion}>{children}</motion.div>;
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    (window as Window & { __MEKLOC_APP_READY__?: boolean }).__MEKLOC_APP_READY__ = true;
  }, []);

  return (
    <>
      <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
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
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/reservations" element={<ReservationsPage />} />
              <Route path="/vehicles" element={<VehiclesPage />} />
              <Route path="/vehicles/:id" element={<VehicleDetailsPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/:id" element={<ClientProfilePage />} />
              <Route path="/contracts" element={<ContractsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
      <ToastViewport />
    </>
  );
}
