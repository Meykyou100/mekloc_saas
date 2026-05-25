import { Bell, CheckCircle2, ChevronDown, LogOut, Menu, Search, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../ui/BrandLogo';

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const { notify } = useApp();
  const { signOut, profile, isSupabaseEnabled } = useAuth();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileLogoBroken, setMobileLogoBroken] = useState(false);
  const initials = (profile?.fullName || profile?.agency?.name || 'AG')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AG';

  useEffect(() => {
    setMobileLogoBroken(false);
  }, [profile?.agency?.logoUrl]);

  async function handleLogout() {
    await signOut();
    notify({
      title: isSupabaseEnabled ? 'Déconnexion effectuée' : 'Session démo fermée',
      message: isSupabaseEnabled ? 'Vous êtes déconnecté de MekLoc.' : 'Supabase n’est pas configuré, c’est une déconnexion en mode démo.',
      type: 'info',
    });
    navigate('/auth');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-carbon-950/72 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,.18)] backdrop-blur-2xl light:bg-white/78 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          aria-label="Open sidebar"
          className="focus-ring rounded-xl p-2 text-carbon-200 hover:bg-white/10 lg:hidden"
          onClick={onMenu}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative hidden flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-400" />
          <input
            aria-label="Search"
            placeholder="Rechercher une réservation, un client, un véhicule..."
            className="form-control focus-ring h-11 w-full rounded-2xl border-white/10 bg-zinc-950/80 pl-10 pr-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.04)] placeholder:text-carbon-500 light:bg-carbon-950/[0.04] light:text-carbon-950"
          />
        </div>
        <div className="mr-auto md:hidden">
          <span className="flex items-center gap-2 text-lg font-black">
            <BrandLogo
              size="sm"
              logoUrl={profile?.agency?.logoUrl}
              broken={mobileLogoBroken}
              onError={() => setMobileLogoBroken(true)}
            />
            <span>MekLoc</span>
          </span>
        </div>
        <div className="relative">
          <button
            aria-label="Notifications"
            className="focus-ring relative grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-zinc-950/70 text-carbon-200 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-gold-300/25 hover:bg-gold-400/10 hover:text-white light:bg-carbon-950/[0.04] light:text-carbon-800"
            onClick={() => setNotificationsOpen((current) => !current)}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-gold-400" />
          </button>
          {notificationsOpen ? (
            <div className="glass-card absolute right-0 mt-3 w-80 rounded-2xl p-3">
              <div className="mb-2 flex items-center justify-between px-2">
                <p className="font-semibold text-white light:text-carbon-950">Notifications</p>
                <CheckCircle2 className="h-4 w-4 text-mint-400" />
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-carbon-300">
                Aucune notification pour le moment.
              </div>
            </div>
          ) : null}
        </div>
        <button
          aria-label="Profile"
          className="focus-ring hidden h-11 items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/70 px-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-gold-300/25 hover:bg-white/[0.08] light:bg-carbon-950/[0.04] light:text-carbon-950 md:flex"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full border border-gold-300/20 bg-gold-400/12 text-xs font-black text-gold-100">
            {initials}
          </span>
          <span className="min-w-0 text-left">
            <span className="block max-w-36 truncate leading-4">{profile?.fullName || 'Agence MekLoc'}</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-carbon-500">{profile?.role || 'Compte'}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-carbon-500" />
        </button>
        <button
          aria-label="Logout"
          className="focus-ring grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-zinc-950/70 text-carbon-200 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-rose-300/25 hover:bg-rose-400/10 hover:text-white light:bg-carbon-950/[0.04] light:text-carbon-800"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
