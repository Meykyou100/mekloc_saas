import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ToastViewport from './components/ui/ToastViewport';
import AccountStatusPage from './pages/AccountStatusPage';
import AuthPage from './pages/AuthPage';
import ClientProfilePage from './pages/ClientProfilePage';
import ClientsPage from './pages/ClientsPage';
import ContractsPage from './pages/ContractsPage';
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import MaintenancePage from './pages/MaintenancePage';
import NotFoundPage from './pages/NotFoundPage';
import OnboardingPage from './pages/OnboardingPage';
import PaymentRequiredPage from './pages/PaymentRequiredPage';
import PaymentsPage from './pages/PaymentsPage';
import PricingPage from './pages/PricingPage';
import PublicBookingPreviewPage from './pages/PublicBookingPreviewPage';
import ReportsPage from './pages/ReportsPage';
import ReservationsPage from './pages/ReservationsPage';
import SettingsPage from './pages/SettingsPage';
import SuperAdminPage from './pages/SuperAdminPage';
import VehicleDetailsPage from './pages/VehicleDetailsPage';
import VehiclesPage from './pages/VehiclesPage';

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

  return (
    <>
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
            path="/pricing"
            element={
              <AnimatedPage>
                <PricingPage />
              </AnimatedPage>
            }
          />
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
      <ToastViewport />
    </>
  );
}
