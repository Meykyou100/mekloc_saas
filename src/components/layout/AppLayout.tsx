import { Outlet } from 'react-router-dom';
import { Suspense, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { CalendarDays, Car, LayoutDashboard, MoreHorizontal, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useApp } from '../../context/AppContext';
import SEO from '../system/SEO';
import { useAuth } from '../../context/AuthContext';
import { isTrialInGracePeriod, trialGraceHoursRemaining } from '../../lib/subscription';
import { WHATSAPP_URL } from '../../config/app';
import { useSupportMode } from '../../context/SupportModeContext';

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
  const { profile } = useAuth();
  const { supportSession, isSupportMode, isReadOnly, endSupportMode } = useSupportMode();
  const [supportMinutesRemaining, setSupportMinutesRemaining] = useState(0);
  const inTrialGrace = !isSupportMode && isTrialInGracePeriod(profile?.agency);
  const graceHours = !isSupportMode ? trialGraceHoursRemaining(profile?.agency) : 0;

  useEffect(() => {
    if (!supportSession) {
      setSupportMinutesRemaining(0);
      return;
    }
    const updateRemaining = () => {
      setSupportMinutesRemaining(Math.max(0, Math.ceil((new Date(supportSession.expiresAt).getTime() - Date.now()) / 60_000)));
    };
    updateRemaining();
    const interval = window.setInterval(updateRemaining, 15_000);
    return () => window.clearInterval(interval);
  }, [supportSession]);

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
      <div className="min-h-screen lg:pl-[296px]">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        {isSupportMode && supportSession ? (
          <div className="mx-4 mt-4 flex flex-col gap-3 rounded-2xl border border-[#E3B117]/50 bg-gradient-to-r from-rose-950/80 via-carbon-950 to-[#E3B117]/15 px-4 py-3 text-sm text-white shadow-[0_12px_34px_rgba(80,0,0,.18)] sm:mx-6 sm:flex-row sm:items-center sm:justify-between lg:mx-8">
            <div>
              <p className="font-black">
                Mode assistance actif — {supportSession.agencyName} — expire dans {supportMinutesRemaining} min
              </p>
              <p className="mt-0.5 text-xs text-carbon-300">
                {isReadOnly ? 'Lecture seule' : 'Accès complet audité'} · session temporaire et journalisée
              </p>
            </div>
            <button
              type="button"
              className="focus-ring inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-[#F5C542]/60 bg-[#E3B117] px-4 font-black text-carbon-950 transition hover:scale-[1.02] hover:bg-[#F5C542]"
              onClick={() => void endSupportMode()}
            >
              Quitter assistance
            </button>
          </div>
        ) : null}
        {inTrialGrace ? (
          <div className="mx-4 mt-4 flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-[var(--app-text)] sm:mx-6 sm:flex-row sm:items-center sm:justify-between lg:mx-8">
            <p className="font-semibold">
              Votre essai gratuit est terminé. Vous avez encore {graceHours}h pour régulariser votre abonnement.
            </p>
            <a
              href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Bonjour MekLoc, mon essai gratuit est terminé.\nJe souhaite activer mon abonnement.\nAgence: ${profile?.agency?.name || profile?.email || 'Non renseignée'}\nEmail: ${profile?.email || profile?.agency?.email || 'Non renseigné'}\nPlan: ${profile?.agency?.plan || 'Non renseigné'}\nPrix: ${profile?.agency?.monthlyPrice || 0} MAD/mois\nMerci.`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-[var(--app-gold)] px-4 font-black text-carbon-950 transition hover:bg-[var(--app-gold-hover)]"
            >
              Contacter sur WhatsApp
            </a>
          </div>
        ) : null}
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
