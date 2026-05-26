import { Outlet } from 'react-router-dom';
import { Suspense, useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { CalendarDays, Car, LayoutDashboard, MoreHorizontal, Plus, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
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
            <Outlet />
          </Suspense>
        </main>
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[28px] border border-white/10 bg-black/82 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_0_50px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-2xl lg:hidden">
        <div className="grid grid-cols-6 items-end gap-1">
          {[
            { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau' },
            { to: '/calendar', icon: CalendarDays, label: 'Calendrier' },
            { to: '/reservations', icon: CalendarDays, label: 'Réserv.' },
            { to: '/vehicles', icon: Car, label: 'Véhicules' },
            { to: '/clients', icon: Users, label: 'Clients' },
            { to: '/settings', icon: MoreHorizontal, label: 'Plus' },
          ].map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center text-[10px] font-bold transition ${isActive ? 'bg-[#D4A017]/12 text-gold-100 shadow-[inset_0_0_0_1px_rgba(212,160,23,.22)]' : 'text-carbon-400 hover:text-white'}`}>
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
        <NavLink
          to="/reservations?create=1"
          aria-label="Nouvelle réservation"
          className="absolute left-1/2 top-0 grid h-14 w-14 -translate-x-1/2 -translate-y-6 place-items-center rounded-full bg-[#D4A017] text-black shadow-[0_0_38px_rgba(212,160,23,.38)] transition active:scale-95"
        >
          <Plus className="h-7 w-7" />
        </NavLink>
      </nav>
    </div>
  );
}
