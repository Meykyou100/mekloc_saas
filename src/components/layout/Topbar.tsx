import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarClock,
  Car,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  FileWarning,
  HelpCircle,
  LogOut,
  Menu,
  Moon,
  Search,
  Shield,
  Sun,
  UserRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useSupportMode } from '../../context/SupportModeContext';
import { formatMAD, type Client, type MaintenanceItem, type Reservation, type Vehicle } from '../../data/mockData';
import { getReservationPaymentSummary } from '../../lib/paymentBalance';

type NotificationSeverity = 'info' | 'warning' | 'danger';

type AppNotification = {
  id: string;
  title: string;
  description: string;
  context: string;
  href: string;
  severity: NotificationSeverity;
  icon: LucideIcon;
};

const SOON_WINDOW_DAYS = 30;

function toLocalIso(date: Date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function addDaysIso(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return toLocalIso(copy);
}

function daysUntil(dateIso?: string) {
  if (!dateIso) return Number.POSITIVE_INFINITY;
  const target = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function dateContext(dateIso?: string) {
  if (!dateIso) return 'Date non renseignée';
  const delta = daysUntil(dateIso);
  if (delta === 0) return "Aujourd'hui";
  if (delta === 1) return 'Demain';
  if (delta < 0) return `En retard de ${Math.abs(delta)} j`;
  return `Dans ${delta} j`;
}

function isTodayOrTomorrow(dateIso: string, todayIso: string, tomorrowIso: string) {
  return dateIso === todayIso || dateIso === tomorrowIso;
}

function vehicleLabel(vehicle: Vehicle) {
  return `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`;
}

function clientMissingDocuments(client: Client) {
  return !client.idCardFrontUrl || !client.idCardBackUrl;
}

function isReservationOpen(reservation: Reservation) {
  return reservation.status !== 'Cancelled' && reservation.status !== 'Completed';
}

function isMaintenanceDue(item: MaintenanceItem) {
  const delta = daysUntil(item.nextServiceDate);
  return item.status === 'Overdue' || item.status === 'Due soon' || delta <= 14;
}

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const { notify, theme, toggleTheme } = useApp();
  const { signOut, profile, isSupabaseEnabled } = useAuth();
  const { supportAgency, isSupportMode } = useSupportMode();
  const { reservations, payments, vehicles, maintenance, clients } = useData();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notificationsMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const visibleName = isSupportMode ? supportAgency?.name || 'Agence assistée' : profile?.fullName || profile?.agency?.name || 'Agence MekLoc';
  const initials = visibleName
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

  const notifications = useMemo<AppNotification[]>(() => {
    const today = new Date();
    const todayIso = toLocalIso(today);
    const tomorrowIso = addDaysIso(today, 1);
    const nextNotifications: AppNotification[] = [];

    reservations.filter(isReservationOpen).forEach((reservation) => {
      if (isTodayOrTomorrow(reservation.pickupDate, todayIso, tomorrowIso)) {
        nextNotifications.push({
          id: `reservation-start-${reservation.id}`,
          title: reservation.pickupDate === todayIso ? "Départ aujourd'hui" : 'Départ demain',
          description: `${reservation.client} · ${reservation.vehicle}`,
          context: reservation.pickupLocation || dateContext(reservation.pickupDate),
          href: '/calendar',
          severity: 'info',
          icon: CalendarClock,
        });
      }

      if (isTodayOrTomorrow(reservation.returnDate, todayIso, tomorrowIso)) {
        nextNotifications.push({
          id: `reservation-end-${reservation.id}`,
          title: reservation.returnDate === todayIso ? "Retour aujourd'hui" : 'Retour demain',
          description: `${reservation.client} · ${reservation.vehicle}`,
          context: reservation.returnLocation || dateContext(reservation.returnDate),
          href: '/calendar',
          severity: 'warning',
          icon: CalendarClock,
        });
      }

      const paymentSummary = getReservationPaymentSummary(reservation, payments);
      if (paymentSummary.remaining > 0) {
        nextNotifications.push({
          id: `payment-${reservation.id}`,
          title: paymentSummary.paid > 0 ? 'Paiement partiel' : 'Paiement en attente',
          description: `${reservation.client} · Reste ${formatMAD(paymentSummary.remaining)}`,
          context: reservation.id,
          href: '/payments',
          severity: paymentSummary.paid > 0 ? 'warning' : 'danger',
          icon: CreditCard,
        });
      }
    });

    vehicles.forEach((vehicle) => {
      const insuranceDelta = daysUntil(vehicle.insuranceExpiry);
      if (insuranceDelta <= SOON_WINDOW_DAYS) {
        nextNotifications.push({
          id: `vehicle-insurance-${vehicle.id}`,
          title: insuranceDelta < 0 ? 'Assurance expirée' : 'Assurance à renouveler',
          description: vehicleLabel(vehicle),
          context: dateContext(vehicle.insuranceExpiry),
          href: '/vehicles',
          severity: insuranceDelta < 0 ? 'danger' : 'warning',
          icon: Shield,
        });
      }

      const inspectionDelta = daysUntil(vehicle.inspectionDate);
      if (inspectionDelta <= SOON_WINDOW_DAYS) {
        nextNotifications.push({
          id: `vehicle-inspection-${vehicle.id}`,
          title: inspectionDelta < 0 ? 'Visite technique expirée' : 'Visite technique proche',
          description: vehicleLabel(vehicle),
          context: dateContext(vehicle.inspectionDate),
          href: '/vehicles',
          severity: inspectionDelta < 0 ? 'danger' : 'warning',
          icon: Car,
        });
      }
    });

    maintenance.filter(isMaintenanceDue).forEach((item) => {
      nextNotifications.push({
        id: `maintenance-${item.id}`,
        title: item.status === 'Overdue' ? 'Maintenance en retard' : 'Maintenance à prévoir',
        description: `${item.vehicle} · ${item.serviceType}`,
        context: dateContext(item.nextServiceDate),
        href: '/maintenance',
        severity: item.status === 'Overdue' || daysUntil(item.nextServiceDate) < 0 ? 'danger' : 'warning',
        icon: Wrench,
      });
    });

    clients.filter(clientMissingDocuments).forEach((client) => {
      nextNotifications.push({
        id: `client-documents-${client.id}`,
        title: 'Documents client incomplets',
        description: client.fullName,
        context: client.idCardFrontUrl || client.idCardBackUrl ? 'Une face manquante' : 'Recto/verso manquants',
        href: `/clients/${client.id}`,
        severity: 'warning',
        icon: FileWarning,
      });
    });

    return nextNotifications.sort((a, b) => {
      const severityOrder = { danger: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [clients, maintenance, payments, reservations, vehicles]);

  const notificationCount = notifications.length;

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

  useEffect(() => {
    if (!notificationsOpen) return undefined;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!notificationsMenuRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setNotificationsOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [notificationsOpen]);

  function openNotification(notification: AppNotification) {
    setNotificationsOpen(false);
    navigate(notification.href);
  }

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
    setNotificationsOpen(false);
    await signOut();
    notify({
      title: isSupabaseEnabled ? 'Déconnexion effectuée' : 'Session démo fermée',
      message: isSupabaseEnabled ? 'Vous êtes déconnecté de MekLoc.' : 'Supabase n’est pas configuré, c’est une déconnexion en mode démo.',
      type: 'info',
    });
    navigate('/auth');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-topbar)] px-4 py-2.5 shadow-[0_12px_34px_rgba(16,24,32,.10)] backdrop-blur-2xl sm:px-6 md:py-3 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4A017]/35 to-transparent lg:hidden" />
      <div className="relative flex min-h-12 items-center gap-3">
        <button
          aria-label="Open sidebar"
          className="focus-ring grid h-10 w-10 place-items-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text)] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-gold-300/25 hover:bg-[var(--app-gold-soft)] md:h-11 md:w-11 lg:hidden"
          onClick={onMenu}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative hidden flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
          <input
            aria-label="Search"
            placeholder="Rechercher une réservation, un client, un véhicule..."
            className="form-control focus-ring h-11 w-full rounded-2xl border-[var(--app-border)] bg-[var(--app-input)] pl-10 pr-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_8px_24px_rgba(16,24,32,.04)] placeholder:text-[var(--app-text-muted)]"
          />
        </div>
        <div className="mr-auto md:hidden">
          <span className="flex items-center gap-2.5 text-lg font-black">
            <img src="/mekloc-logo-mark.png" alt="MekLoc" className="h-9 w-auto shrink-0 object-contain md:h-10" />
            <span>MekLoc</span>
          </span>
        </div>
        <div ref={notificationsMenuRef} className="relative">
          <button
            aria-label="Notifications"
            className="focus-ring relative grid h-10 w-10 place-items-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text)] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-gold-300/25 hover:bg-[var(--app-gold-soft)] md:h-11 md:w-11"
            onClick={() => {
              setProfileOpen(false);
              setNotificationsOpen((current) => !current);
            }}
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#D4A017] px-1.5 text-[10px] font-black text-black shadow-[0_0_18px_rgba(212,160,23,.32)]">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            ) : null}
          </button>
          {notificationsOpen ? (
            <div className="absolute right-0 z-50 mt-3 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-2 text-[var(--app-text)] shadow-[var(--app-shadow)] backdrop-blur-2xl">
              <div className="mb-2 flex items-center justify-between px-2">
                <div>
                  <p className="font-semibold text-[var(--app-text)]">Notifications</p>
                  <p className="text-xs text-[var(--app-text-muted)]">{notificationCount ? `${notificationCount} alerte${notificationCount > 1 ? 's' : ''} active${notificationCount > 1 ? 's' : ''}` : 'Tout est à jour'}</p>
                </div>
                {notificationCount ? <AlertTriangle className="h-4 w-4 text-gold-200" /> : <CheckCircle2 className="h-4 w-4 text-mint-400" />}
              </div>
              {notificationCount ? (
                <div className="max-h-[70dvh] space-y-1 overflow-y-auto pr-1">
                  {notifications.slice(0, 12).map((notification) => {
                    const Icon = notification.icon;
                    const tone =
                      notification.severity === 'danger'
                        ? 'border-rose-300/20 bg-rose-500/10 text-rose-700 dark:text-rose-100'
                        : notification.severity === 'warning'
                          ? 'border-amber-300/20 bg-amber-500/10 text-amber-700 dark:text-amber-100'
                          : 'border-sky-300/20 bg-sky-500/10 text-sky-700 dark:text-sky-100';
                    return (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="focus-ring flex w-full items-start gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition hover:border-gold-300/20 hover:bg-gold-400/10"
                      >
                        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${tone}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-[var(--app-text)]">{notification.title}</span>
                          <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--app-text-soft)]">{notification.description}</span>
                          <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">{notification.context}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-6 text-center text-sm text-[var(--app-text-soft)]">
                  Aucune notification
                </div>
              )}
            </div>
          ) : null}
        </div>
        <div ref={profileMenuRef} className="relative">
          <button
            aria-label="Profile"
            aria-expanded={profileOpen}
            className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-gold-300/25 bg-carbon-950 text-white shadow-[0_10px_26px_rgba(16,24,32,.16),inset_0_1px_0_rgba(255,255,255,.08)] transition hover:border-gold-300/40 md:flex md:w-auto md:items-center md:gap-3 md:rounded-2xl md:px-2.5 md:pr-3 md:text-sm md:font-semibold"
            onClick={() => {
              setNotificationsOpen(false);
              setProfileOpen((current) => !current);
            }}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border border-gold-300/30 bg-[linear-gradient(135deg,#111827,#050505)] text-xs font-black text-gold-100 shadow-[inset_0_1px_0_rgba(255,255,255,.10)] md:h-8 md:w-8">
              {initials}
            </span>
            <span className="hidden min-w-0 text-left md:block">
              <span className="block max-w-36 truncate leading-4 text-white">{visibleName}</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-gold-100/70">{isSupportMode ? 'Mode assistance' : roleLabel}</span>
            </span>
            <ChevronDown className={`hidden h-4 w-4 text-gold-100/70 transition-transform duration-200 md:block ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen ? (
            <div className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-2 text-[var(--app-text)] shadow-[var(--app-shadow)] backdrop-blur-2xl">
              <div className="rounded-2xl border border-gold-300/20 bg-[linear-gradient(135deg,var(--app-gold-soft),var(--app-surface-soft))] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-gold-300/25 bg-gold-400/15 text-sm font-black text-gold-100 shadow-[0_0_28px_rgba(212,160,23,.14)]">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[var(--app-text)]">{visibleName}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--app-text-muted)]">{isSupportMode ? `Assistance par ${profile?.email || 'Super Admin'}` : profile?.email || 'Email non renseigné'}</p>
                    <span className="mt-2 inline-flex rounded-full border border-gold-300/25 bg-gold-400/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--app-gold-text)]">
                      {isSupportMode ? 'Agence assistée' : roleLabel}
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

              <div className="my-2 h-px bg-[var(--app-border)]" />

              <button
                type="button"
                onClick={handleLogout}
                className="focus-ring flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold text-rose-700 transition hover:border-rose-300/25 hover:bg-rose-500/10 dark:text-rose-100"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-rose-300/20 bg-rose-500/10">
                  <LogOut className="h-4 w-4" />
                </span>
                Se déconnecter
              </button>

              <p className="px-3 pb-2 pt-1 text-[11px] font-medium text-[var(--app-text-muted)]">Connecté à MekLoc</p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
          aria-pressed={theme === 'light'}
          onClick={toggleTheme}
          className="focus-ring group grid h-11 w-11 place-items-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-1 text-[var(--app-text)] shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition hover:border-gold-300/30 hover:bg-[var(--app-gold-soft)] md:inline-flex md:w-auto md:gap-1"
        >
          <span className={`grid h-9 w-9 place-items-center rounded-xl transition ${theme === 'light' ? 'bg-gold-400 text-carbon-950 shadow-[0_8px_18px_rgba(212,160,23,.18)]' : 'hidden text-[var(--app-text-muted)] group-hover:text-[var(--app-text)] md:grid'}`}>
            <Sun className="h-4 w-4" />
          </span>
          <span className={`grid h-9 w-9 place-items-center rounded-xl transition ${theme === 'dark' ? 'bg-carbon-950 text-gold-100 shadow-[0_8px_18px_rgba(16,24,32,.18)]' : 'hidden text-[var(--app-text-muted)] group-hover:text-[var(--app-text)] md:grid'}`}>
            <Moon className="h-4 w-4" />
          </span>
        </button>
        <button
          aria-label="Logout"
          className="focus-ring hidden h-11 w-11 place-items-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-rose-300/25 hover:bg-rose-400/10 hover:text-[var(--app-text)] md:grid"
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
      className="focus-ring flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left text-sm font-semibold text-[var(--app-text-soft)] transition hover:border-gold-300/20 hover:bg-gold-400/10 hover:text-[var(--app-text)]"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-gold-text)]">
        <Icon className="h-4 w-4" />
      </span>
      <span>{label}</span>
    </button>
  );
}
