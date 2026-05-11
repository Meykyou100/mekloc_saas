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
import { NavLink } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { label: 'dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'reservations', to: '/reservations', icon: CalendarDays },
  { label: 'vehicles', to: '/vehicles', icon: Car },
  { label: 'clients', to: '/clients', icon: Users },
  { label: 'contracts', to: '/contracts', icon: FileSignature },
  { label: 'payments', to: '/payments', icon: CreditCard },
  { label: 'maintenance', to: '/maintenance', icon: Wrench },
  { label: 'reports', to: '/reports', icon: BarChart3 },
  { label: 'settings', to: '/settings', icon: Settings },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { t } = useApp();
  const { profile } = useAuth();
  const logoUrl = profile?.agency?.logoUrl;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <NavLink to="/" className="flex items-center gap-3" onClick={onClose}>
          {logoUrl ? (
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_10px_22px_rgba(212,160,23,.14)]">
              <img src={logoUrl} alt="Logo agence" className="h-full w-full object-contain" />
            </span>
          ) : (
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#D4A017] text-xl font-black text-carbon-950 shadow-[0_10px_22px_rgba(212,160,23,.14)]">
              M
            </span>
          )}
          <span>
            <span className="block text-xl font-black tracking-wide text-white light:text-carbon-950">
              MekLoc
            </span>
            <span className="text-xs text-carbon-400">Smart Rental Management System</span>
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
      <nav className="grid gap-1.5 px-3 py-3">
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'border-white/10 bg-white/[0.06] text-gold-100 light:text-gold-800'
                  : 'border-transparent text-carbon-300 hover:border-white/10 hover:bg-white/[0.055] hover:text-white light:text-carbon-700 light:hover:bg-carbon-950/5'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {t(label)}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto p-4">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
          <p className="text-sm font-semibold text-white light:text-carbon-950">MekLoc Business</p>
          <p className="mt-2 text-xs leading-5 text-carbon-300 light:text-carbon-700">
            Multi-branch controls, advanced roles, and smart contract automation.
          </p>
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
