import { Outlet } from 'react-router-dom';
import { Suspense, useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { CalendarDays, Car, LayoutDashboard, Settings, Users } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useData } from '../../context/DataContext';

function PageLoadingHint() {
  return (
    <div className="py-10">
      <div className="mx-auto h-1 w-28 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-gold-300" />
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { loading: dataLoading } = useData();

  return (
    <div className="min-h-screen bg-carbon-950 text-white light:bg-carbon-50 light:text-carbon-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-h-screen lg:pl-72">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        <main className="relative px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          <div
            className={`pointer-events-none absolute inset-x-4 top-0 h-0.5 overflow-hidden rounded-full bg-white/5 transition-opacity duration-200 sm:inset-x-6 lg:inset-x-8 ${
              dataLoading ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden="true"
          >
            <div className="h-full w-1/3 animate-pulse rounded-full bg-gold-300" />
          </div>
          <Suspense fallback={<PageLoadingHint />}>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-carbon-950/95 px-2 py-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-6 gap-1">
          {[
            { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau' },
            { to: '/calendar', icon: CalendarDays, label: 'Calend.' },
            { to: '/reservations', icon: CalendarDays, label: 'Réserv.' },
            { to: '/vehicles', icon: Car, label: 'Véhicules' },
            { to: '/clients', icon: Users, label: 'Clients' },
            { to: '/settings', icon: Settings, label: 'Réglages' },
          ].map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center rounded-xl px-1.5 py-2 text-[11px] ${isActive ? 'text-gold-200' : 'text-carbon-400'}`}>
              <Icon className="mb-1 h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
