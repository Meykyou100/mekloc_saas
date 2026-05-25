import { Bell, Building2, CheckCircle2, ChevronDown, HelpCircle, LogOut, Menu, Search, Shield, UserRound, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const { notify } = useApp();
  const { signOut, profile, isSupabaseEnabled } = useAuth();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const initials = (profile?.fullName || profile?.agency?.name || 'AG')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AG';
  const roleLabel = useMemo(() => {
    const role = (profile?.role || '').toLowerCase();
    if (role === 'owner') return 'Propriétaire';
    if (role === 'admin') return 'Admin';
    if (role === 'manager') return 'Manager';
    if (role === 'accountant') return 'Comptable';
    if (role === 'agent' || role === 'member') return 'Membre';
    return profile?.isSuperAdmin ? 'Super Admin' : 'Compte';
  }, [profile?.isSuperAdmin, profile?.role]);

  useEffect(() => {
    if (!profileOpen) return undefined;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  function openSettingsTab(tab: 'Général' | 'Sécurité') {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mekloc-settings-active-tab', tab);
    }
    setProfileOpen(false);
    navigate('/settings');
  }

  function openSupport() {
    setProfileOpen(false);
    window.open(
      'https://wa.me/212762971653?text=Bonjour%20MekLoc%2C%20j%27ai%20besoin%20d%27aide%20sur%20la%20plateforme.',
      '_blank',
      'noopener,noreferrer',
    );
  }

  async function handleLogout() {
    setProfileOpen(false);
    await signOut();
    notify({
      title: isSupabaseEnabled ? 'Déconnexion effectuée' : 'Session démo fermée',
      message: isSupabaseEnabled ? 'Vous êtes déconnecté de MekLoc.' : 'Supabase n’est pas configuré, c’est une déconnexion en mode démo.',
      type: 'info',
    });
    navigate('/auth');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/82 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,.18)] backdrop-blur-2xl light:bg-white/78 sm:px-6 md:bg-carbon-950/72 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4A017]/35 to-transparent lg:hidden" />
      <div className="relative flex min-h-12 items-center gap-3">
        <button
          aria-label="Open sidebar"
          className="focus-ring grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.045] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-gold-300/25 hover:bg-gold-400/10 lg:hidden"
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
          <span className="flex items-center gap-2.5 text-lg font-black">
            <img src="/mekloc-logo-mark.png" alt="MekLoc" className="h-10 w-auto shrink-0 object-contain" />
            <span>MekLoc</span>
          </span>
        </div>
        <div className="relative">
          <button
            aria-label="Notifications"
            className="focus-ring relative grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.045] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-gold-300/25 hover:bg-gold-400/10 light:bg-carbon-950/[0.04] light:text-carbon-800 md:bg-zinc-950/70 md:text-carbon-200"
            onClick={() => {
              setProfileOpen(false);
              setNotificationsOpen((current) => !current);
            }}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#D4A017] text-[10px] font-black text-black md:h-2 md:w-2">
              <span className="md:hidden">3</span>
            </span>
          </button>
          {notificationsOpen ? (
            <div className="glass-card absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-2rem))] rounded-2xl p-3">
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
        <div ref={profileMenuRef} className="relative">
          <button
            aria-label="Profile"
            aria-expanded={profileOpen}
            className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-[#D4A017]/25 bg-[#D4A017]/16 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-gold-300/40 hover:bg-gold-400/20 light:bg-carbon-950/[0.04] light:text-carbon-950 md:flex md:w-auto md:items-center md:gap-3 md:rounded-2xl md:border-white/10 md:bg-zinc-950/70 md:px-3 md:text-sm md:font-semibold"
            onClick={() => {
              setNotificationsOpen(false);
              setProfileOpen((current) => !current);
            }}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full text-xs font-black text-gold-100 md:h-8 md:w-8 md:border md:border-gold-300/20 md:bg-gold-400/12">
              {initials}
            </span>
            <span className="hidden min-w-0 text-left md:block">
              <span className="block max-w-36 truncate leading-4">{profile?.fullName || 'Agence MekLoc'}</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-carbon-500">{roleLabel}</span>
            </span>
            <ChevronDown className={`hidden h-4 w-4 text-carbon-500 transition-transform duration-200 md:block ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen ? (
            <div className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 p-2 text-white shadow-[0_28px_80px_rgba(0,0,0,.48),0_0_40px_rgba(212,160,23,.10)] backdrop-blur-2xl light:bg-white/95 light:text-carbon-950">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#D4A017]/14 via-white/[0.04] to-transparent p-4 light:border-carbon-950/10 light:from-[#D4A017]/18">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-gold-300/25 bg-gold-400/15 text-sm font-black text-gold-100 shadow-[0_0_28px_rgba(212,160,23,.14)]">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white light:text-carbon-950">{profile?.fullName || profile?.agency?.name || 'Agence MekLoc'}</p>
                    <p className="mt-0.5 truncate text-xs text-carbon-400 light:text-carbon-600">{profile?.email || 'Email non renseigné'}</p>
                    <span className="mt-2 inline-flex rounded-full border border-gold-300/25 bg-gold-400/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-gold-100 light:text-[#8a6500]">
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-2 grid gap-1">
                <ProfileMenuItem icon={UserRound} label="Mon profil" onClick={() => openSettingsTab('Général')} />
                <ProfileMenuItem icon={Building2} label="Paramètres agence" onClick={() => openSettingsTab('Général')} />
                <ProfileMenuItem icon={Shield} label="Sécurité & sessions" onClick={() => openSettingsTab('Sécurité')} />
                <ProfileMenuItem icon={HelpCircle} label="Support MekLoc" onClick={openSupport} />
              </div>

              <div className="my-2 h-px bg-white/10 light:bg-carbon-950/10" />

              <button
                type="button"
                onClick={handleLogout}
                className="focus-ring flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold text-rose-100 transition hover:border-rose-300/25 hover:bg-rose-500/10 light:text-rose-700"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-rose-300/20 bg-rose-500/10">
                  <LogOut className="h-4 w-4" />
                </span>
                Se déconnecter
              </button>

              <p className="px-3 pb-2 pt-1 text-[11px] font-medium text-carbon-500">Connecté à MekLoc</p>
            </div>
          ) : null}
        </div>
        <button
          aria-label="Logout"
          className="focus-ring hidden h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-zinc-950/70 text-carbon-200 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-rose-300/25 hover:bg-rose-400/10 hover:text-white light:bg-carbon-950/[0.04] light:text-carbon-800 md:grid"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function ProfileMenuItem({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left text-sm font-semibold text-carbon-200 transition hover:border-gold-300/20 hover:bg-gold-400/10 hover:text-white light:text-carbon-700 light:hover:text-carbon-950"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-gold-200 light:border-carbon-950/10 light:bg-carbon-950/[0.04]">
        <Icon className="h-4 w-4" />
      </span>
      <span>{label}</span>
    </button>
  );
}
