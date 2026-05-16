import { Bell, CheckCircle2, LogOut, Menu, Search, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const { notify, t } = useApp();
  const { signOut, profile, isSupabaseEnabled } = useAuth();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileLogoBroken, setMobileLogoBroken] = useState(false);

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
    <header className="sticky top-0 z-30 border-b border-white/10 bg-carbon-950/78 px-4 py-3 backdrop-blur-2xl light:bg-white/78 sm:px-6 lg:px-8">
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
            placeholder={t('search')}
            className="form-control focus-ring h-10 w-full rounded-xl pl-10 pr-4 text-sm light:bg-carbon-950/[0.04] light:text-carbon-950"
          />
        </div>
        <div className="mr-auto md:hidden">
          <span className="flex items-center gap-2 text-lg font-black tracking-wide">
            {profile?.agency?.logoUrl && !mobileLogoBroken ? (
              <img
                src={profile.agency.logoUrl}
                alt="Logo agence"
                className="h-7 w-7 rounded-lg object-contain"
                onError={() => setMobileLogoBroken(true)}
              />
            ) : null}
            MekLoc
          </span>
        </div>
        <div className="relative">
          <button
            aria-label="Notifications"
            className="focus-ring relative grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.055] text-carbon-200 hover:bg-white/10 light:bg-carbon-950/[0.04] light:text-carbon-800"
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
          className="focus-ring hidden h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-3 text-sm font-semibold text-white hover:bg-white/10 light:bg-carbon-950/[0.04] light:text-carbon-950 md:flex"
        >
          <UserRound className="h-5 w-5 text-gold-300" />
          {profile?.fullName || 'Agence MekLoc'}
        </button>
        <button
          aria-label="Logout"
          className="focus-ring grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.055] text-carbon-200 hover:bg-white/10 light:bg-carbon-950/[0.04] light:text-carbon-800"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
