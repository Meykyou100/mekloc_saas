import { Outlet } from 'react-router-dom';
import { Suspense, useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { CalendarDays, Car, LayoutDashboard, MoreHorizontal, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useApp } from '../../context/AppContext';
import SEO from '../system/SEO';

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
  const { loading: dataLoading } = useData();
  const { theme } = useApp();

  return (
    <div
      data-app-theme={theme}
      className={`min-h-screen overflow-x-hidden ${
        theme === 'light'
          ? 'app-theme-light light bg-[var(--app-bg)] text-[var(--app-text)]'
          : 'app-theme-dark dark bg-[var(--app-bg)] text-[var(--app-text)]'
      }`}
    >
      <SEO title="MekLoc – Espace agence" description="Espace privé MekLoc pour la gestion de votre agence." canonical="/dashboard" noindex />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-h-screen lg:pl-72">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        <main className="relative px-4 pb-[calc(86px+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-5">
          <div
            className={`pointer-events-none absolute inset-x-4 top-0 h-0.5 overflow-hidden rounded-full bg-white/5 transition-opacity duration-200 sm:inset-x-6 lg:inset-x-8 ${
              dataLoading ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden="true"
          >
            <div className="h-full w-1/3 animate-pulse rounded-full bg-gold-300" />
          </div>
          <Suspense fallback={<PageLoadingHint />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <nav className="fixed inset-x-3 bottom-2 z-40 rounded-[22px] border border-[var(--app-border)] bg-[var(--app-bottom-nav)] px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1 shadow-[var(--app-shadow)] backdrop-blur-2xl lg:hidden">
        <div className="grid grid-cols-6 items-center gap-1">
          {[
            { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau' },
            { to: '/calendar', icon: CalendarDays, label: 'Calendrier' },
            { to: '/reservations', icon: CalendarDays, label: 'Réserv.' },
            { to: '/vehicles', icon: Car, label: 'Véhicules' },
            { to: '/clients', icon: Users, label: 'Clients' },
            { to: '/settings', icon: MoreHorizontal, label: 'Plus' },
          ].map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 text-center text-[9px] font-bold transition ${isActive ? 'bg-[var(--app-gold-soft)] text-[var(--app-gold-text)] shadow-[inset_0_0_0_1px_rgba(212,160,23,.22)]' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}>
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
