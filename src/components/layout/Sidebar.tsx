import {
  BarChart3,
  CalendarDays,
  Car,
  CreditCard,
  FileSignature,
  LayoutDashboard,
  Settings,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { canAccess, type AppPermission } from '../../lib/permissions';
import BrandLogo from '../ui/BrandLogo';

const navItems = [
  { label: 'dashboard', to: '/dashboard', icon: LayoutDashboard, permission: 'dashboard' as AppPermission },
  { label: 'calendar', to: '/calendar', icon: CalendarDays, permission: 'reservations' as AppPermission },
  { label: 'reservations', to: '/reservations', icon: CalendarDays, permission: 'reservations' as AppPermission },
  { label: 'vehicles', to: '/vehicles', icon: Car, permission: 'vehicles' as AppPermission },
  { label: 'clients', to: '/clients', icon: Users, permission: 'clients' as AppPermission },
  { label: 'contracts', to: '/contracts', icon: FileSignature, permission: 'contracts' as AppPermission },
  { label: 'payments', to: '/payments', icon: CreditCard, permission: 'payments' as AppPermission },
  { label: 'maintenance', to: '/maintenance', icon: Wrench, permission: 'maintenance' as AppPermission },
  { label: 'reports', to: '/reports', icon: BarChart3, permission: 'reports' as AppPermission },
  { label: 'settings', to: '/settings', icon: Settings, permission: 'settings' as AppPermission },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { t } = useApp();
  const { profile } = useAuth();
  const logoUrl = profile?.agency?.logoUrl;
  const [logoBroken, setLogoBroken] = useState(false);

  useEffect(() => {
    setLogoBroken(false);
  }, [logoUrl]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <div className="flex items-center justify-between rounded-3xl border border-white/[0.07] bg-white/[0.025] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.035)] light:bg-carbon-950/[0.025]">
        <NavLink to="/" className="flex min-w-0 items-center gap-3" onClick={onClose}>
          <BrandLogo logoUrl={logoUrl} broken={logoBroken} onError={() => setLogoBroken(true)} />
          <span className="min-w-0">
            <span className="block text-xl font-black leading-6 text-white light:text-carbon-950">
              MekLoc
            </span>
            <span className="block max-w-[170px] text-xs font-medium leading-4 text-carbon-400">Gestion location automobile</span>
          </span>
        </NavLink>
        <button
          aria-label="Close sidebar"
          className="rounded-xl p-2 text-carbon-300 hover:bg-white/10 lg:hidden"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
        </div>
      </div>
      <nav className="grid gap-1.5 px-3 py-2">
        {navItems
          .filter((item) => canAccess(profile?.role, item.permission))
          .map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'border-gold-200/20 bg-gold-400/[0.095] text-gold-100 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] light:text-gold-800'
                  : 'border-transparent text-carbon-300 hover:border-white/10 hover:bg-white/[0.045] hover:text-white light:text-carbon-700 light:hover:bg-carbon-950/5'
              }`
            }
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.035] text-carbon-300 transition group-hover:text-gold-100 light:bg-carbon-950/[0.035]">
              <Icon className="h-4 w-4" />
            </span>
            {t(label)}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto p-4">
        <div className="rounded-3xl border border-gold-200/12 bg-[linear-gradient(180deg,rgba(212,160,23,.08),rgba(255,255,255,.025))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gold-300" />
            <p className="text-sm font-bold text-white light:text-carbon-950">MekLoc Pro</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-carbon-300 light:text-carbon-700">
            Suivi flotte, contrats et paiements dans un espace sécurisé.
          </p>
          <div className="mt-3 h-px bg-gradient-to-r from-gold-200/30 via-white/10 to-transparent" />
          <p className="mt-3 text-[11px] font-semibold uppercase text-carbon-500">Rental Management Platform</p>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-white/10 bg-carbon-950/88 backdrop-blur-2xl light:bg-white/90 lg:block">
        <SidebarContent />
      </aside>
      <div
        className={`fixed inset-0 z-40 bg-carbon-950/70 backdrop-blur-sm transition lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[86vw] border-r border-white/10 bg-carbon-950/95 backdrop-blur-2xl transition-transform light:bg-white ${open ? 'translate-x-0' : '-translate-x-full'} lg:hidden`}
      >
        <SidebarContent onClose={onClose} />
      </aside>
    </>
  );
}
