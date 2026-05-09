import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { CalendarDays, Car, LayoutDashboard, Settings, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-carbon-950 text-white light:bg-carbon-50 light:text-carbon-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-h-screen lg:pl-72">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        <main className="px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-carbon-950/95 px-2 py-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {[
            { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau' },
            { to: '/reservations', icon: CalendarDays, label: 'Réserv.' },
            { to: '/vehicles', icon: Car, label: 'Véhicules' },
            { to: '/clients', icon: Users, label: 'Clients' },
            { to: '/settings', icon: Settings, label: 'Réglages' },
          ].map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center rounded-xl px-2 py-2 text-xs ${isActive ? 'text-gold-200' : 'text-carbon-400'}`}>
              <Icon className="mb-1 h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
