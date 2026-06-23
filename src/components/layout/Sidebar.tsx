import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Car,
  UsersRound,
  CreditCard,
  FileSignature,
  HelpCircle,
  Headphones,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Settings,
  Users,
  Wrench,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import Modal from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, WHATSAPP_URL } from '../../config/app';
import { canAccess, type AppPermission } from '../../lib/permissions';

const navItems = [
  { label: 'Tableau', to: '/dashboard', icon: LayoutDashboard, permission: 'dashboard' as AppPermission },
  { label: 'Calendrier', to: '/calendar', icon: CalendarDays, permission: 'reservations' as AppPermission },
  { label: 'Réservations', to: '/reservations', icon: CalendarDays, permission: 'reservations' as AppPermission },
  { label: 'Véhicules', to: '/vehicles', icon: Car, permission: 'vehicles' as AppPermission },
  { label: 'Clients', to: '/clients', icon: Users, permission: 'clients' as AppPermission },
  { label: 'Contrats', to: '/contracts', icon: FileSignature, permission: 'contracts' as AppPermission },
  { label: 'Paiements', to: '/payments', icon: CreditCard, permission: 'payments' as AppPermission },
  { label: 'Entretien', to: '/maintenance', icon: Wrench, permission: 'maintenance' as AppPermission },
  { label: 'Sinistres', to: '/sinistres', icon: TriangleAlert, permission: 'maintenance' as AppPermission },
  { label: 'Rapports', to: '/reports', icon: BarChart3, permission: 'reports' as AppPermission },
  { label: 'Responsables', to: '/responsables', icon: UsersRound, permission: 'reports' as AppPermission },
  { label: 'Paramètres', to: '/settings', icon: Settings, permission: 'settings' as AppPermission },
];

const faqItems = [
  {
    question: 'Comment créer une réservation ?',
    answer: 'Depuis Réservations, utilisez Ajouter une réservation, puis suivez les étapes client, véhicule, dates, tarif et validation.',
  },
  {
    question: 'Comment modifier un véhicule ?',
    answer: 'Depuis Véhicules, ouvrez l’action Modifier sur le véhicule concerné, ajustez les champs puis enregistrez.',
  },
  {
    question: 'Comment télécharger un contrat ?',
    answer: 'Depuis Contrats, sélectionnez la réservation ou un contrat archivé, puis utilisez Télécharger PDF.',
  },
  {
    question: 'Comment suivre les paiements ?',
    answer: 'La page Paiements affiche total, payé, reste à payer et statut. Les factures partielles ou en retard restent visibles dans les filtres.',
  },
  {
    question: 'Comment gérer les documents client ?',
    answer: 'Depuis Clients, ouvrez la fiche ou le formulaire client pour ajouter ou vérifier les pièces d’identité disponibles.',
  },
];

function subscriptionStatusLabel(status: string | null | undefined) {
  if (status === 'active_paid') return 'Actif';
  if (status === 'trial_active') return 'Essai actif';
  if (status === 'payment_pending') return 'En attente';
  if (status === 'trial_expired') return 'Expiré';
  if (status === 'suspended') return 'Suspendu';
  return '—';
}

function planLabel(plan: string | null | undefined) {
  if (!plan) return '—';
  return plan === 'lifetime' ? 'Lifetime' : `${plan.slice(0, 1).toUpperCase()}${plan.slice(1)}`;
}

function daysRemaining(value: string | null | undefined) {
  if (!value) return '—';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '—';
  return `${Math.max(0, Math.ceil((time - Date.now()) / 86_400_000))} jours`;
}

function SidebarContent({ onClose, onHelp }: { onClose?: () => void; onHelp: () => void }) {
  const { profile } = useAuth();
  const agency = profile?.agency;
  const subscriptionEnd = agency?.subscriptionStatus === 'trial_active' ? agency.trialEndsAt : agency?.paidUntil || agency?.subscriptionEndDate || agency?.nextPaymentDueDate;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain rounded-[28px] border border-[var(--app-border)] bg-[linear-gradient(180deg,#fffdf7,#f8f3e9)] pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[#171717] shadow-[0_18px_48px_rgba(44,35,18,.12)] dark:border-white/10 dark:bg-none dark:bg-[#0b0d10] dark:text-white dark:shadow-[0_18px_48px_rgba(0,0,0,.42)]">
      <div className="shrink-0 px-3.5 pb-2 pt-3.5 lg:px-3.5 lg:pt-3.5">
        <div className="flex items-center justify-between gap-3">
        <NavLink to="/dashboard" className="group flex min-w-0 items-center gap-2.5 rounded-2xl border border-[#e9e2d6] bg-white px-2.5 py-2 shadow-[0_8px_22px_rgba(44,35,18,.05)] transition hover:border-gold-300/45 dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none dark:hover:border-gold-300/35" onClick={onClose}>
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#2a261d] bg-[#171717] shadow-[0_8px_18px_rgba(16,24,32,.16)]">
            <img
              src="/mekloc-logo-mark.png"
              alt="MekLoc"
              className="relative h-7 w-auto max-w-[30px] object-contain drop-shadow-[0_8px_18px_rgba(227,177,23,.18)]"
            />
          </span>
          <span className="min-w-0">
            <span className="block text-[18px] font-black leading-5 tracking-tight text-[#151515] dark:text-white">
              MekLoc
            </span>
            <span className="mt-0.5 block max-w-[164px] truncate text-[10px] font-semibold leading-3 text-[#7a746a] dark:text-carbon-400">
              Gestion location automobile
            </span>
          </span>
        </NavLink>
        <button
          aria-label="Close sidebar"
          className="rounded-xl p-1.5 text-[#746d63] hover:bg-[#f4eee3] dark:text-carbon-300 dark:hover:bg-white/10 lg:hidden"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
        </div>
      </div>
      <nav className="grid shrink-0 gap-0.5 px-3 py-1">
        <p className="px-2 pb-0.5 pt-1 text-[10px] font-black uppercase tracking-[0.24em] text-[#927333] dark:text-[#f5c542] [@media(max-height:700px)]:hidden">
          NAVIGATION
        </p>
        {navItems
          .filter((item) => canAccess(profile?.role, item.permission))
          .map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `group relative flex min-h-9 items-center gap-2.5 overflow-hidden rounded-2xl border px-2.5 py-1 text-[13px] font-bold transition [@media(max-height:700px)]:min-h-8 [@media(max-height:700px)]:py-0.5 ${
                isActive
                  ? 'active border-[#edcf83] bg-[linear-gradient(135deg,#fff5d8,#fffaf0)] text-[#9a6800] shadow-[0_8px_20px_rgba(185,134,11,.10)] before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-gold-400 dark:border-gold-300/35 dark:bg-[linear-gradient(135deg,rgba(212,160,23,.20),rgba(212,160,23,.08))] dark:text-[#f8e6a0] dark:shadow-none'
                  : 'border-transparent text-[#302d28] hover:border-[#e9e2d6] hover:bg-white hover:text-[#151515] dark:text-carbon-200 dark:hover:border-white/10 dark:hover:bg-white/[0.06] dark:hover:text-white'
              }`
            }
          >
            <span className="relative grid h-[26px] w-[26px] shrink-0 place-items-center rounded-xl border border-[#e8e2d8] bg-[#fbfaf7] text-[#4b4841] transition group-[.active]:border-[#edcf83] group-[.active]:bg-[#fff0bd] group-[.active]:text-[#a66b00] group-hover:border-gold-300/35 group-hover:bg-[#fff8e4] group-hover:text-[#9a6800] dark:border-white/10 dark:bg-white/[0.04] dark:text-carbon-300 dark:group-[.active]:border-gold-300/35 dark:group-[.active]:bg-gold-400/15 dark:group-[.active]:text-[#f8e6a0] dark:group-hover:border-gold-300/25 dark:group-hover:bg-gold-400/10 dark:group-hover:text-[#f8e6a0] [@media(max-height:700px)]:h-6 [@media(max-height:700px)]:w-6">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="relative">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto shrink-0 space-y-2 px-3 pb-1 pt-2">
        <div className="rounded-3xl border border-[#e6dfd3] bg-white p-3 shadow-[0_10px_28px_rgba(44,35,18,.06)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><p className="text-[15px] font-black leading-4 text-[#171717] dark:text-white">MekLoc {planLabel(agency?.plan)}</p><p className="mt-1 text-[11px] font-semibold text-[#8a8378] dark:text-carbon-400">Espace agence activé</p></div>
            <span className="rounded-full border border-[#34302a] bg-[#1d1b18] px-2 py-1 text-[9px] font-black uppercase tracking-[.16em] text-[#f4c541]">{planLabel(agency?.plan).toUpperCase()}</span>
          </div>
          <div className="mt-2 space-y-1 border-y border-[#eee8df] py-2 text-[11px] dark:border-white/10">
            <div className="flex items-center justify-between gap-2"><span className="text-[#736c62] dark:text-carbon-400">• &nbsp;Plan actuel</span><strong className="text-[#202020] dark:text-white">{planLabel(agency?.plan)}</strong></div>
            <div className="flex items-center justify-between gap-2"><span className="text-[#736c62] dark:text-carbon-400">• &nbsp;Statut</span><strong className={agency?.subscriptionStatus === 'active_paid' ? 'text-emerald-700 dark:text-emerald-300' : 'text-[#202020] dark:text-white'}>{subscriptionStatusLabel(agency?.subscriptionStatus)}</strong></div>
            <div className="flex items-center justify-between gap-2"><span className="text-[#736c62] dark:text-carbon-400">• &nbsp;Jours restants</span><strong className="text-[#202020] dark:text-white">{daysRemaining(subscriptionEnd)}</strong></div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] font-bold text-[#3f3a34] dark:text-carbon-200 [@media(max-height:760px)]:hidden">
            {['Gestion flotte', 'Contrats PDF', 'Paiements suivis', 'Rapports'].map((feature) => <span key={feature} className="rounded-lg border border-[#ece6dc] bg-[#fcfbf8] px-1.5 py-1 text-center dark:border-white/10 dark:bg-white/[0.04]">{feature}</span>)}
          </div>
          <NavLink to="/pricing" onClick={onClose} className="mt-2 flex h-[34px] w-full items-center justify-center rounded-xl border border-[#e7b813] bg-[#f5bd12] text-[11px] font-black text-[#17120a] shadow-[0_8px_18px_rgba(212,160,23,.18)] transition hover:bg-[#edb000]">Voir abonnement <ArrowRight className="ml-2 h-3.5 w-3.5" /></NavLink>
        </div>
        <button
          type="button"
          onClick={() => {
            onHelp();
            onClose?.();
          }}
          className="group flex cursor-pointer items-center gap-2.5 rounded-2xl border border-[#e6dfd3] bg-white p-2 shadow-[0_10px_24px_rgba(44,35,18,.05)] transition hover:border-gold-300/45 hover:bg-[#fffaf0] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none dark:hover:bg-gold-400/10 [@media(max-height:640px)]:hidden"
        >
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#2a261d] bg-[#171717] text-[#f4c541] shadow-[0_8px_18px_rgba(16,24,32,.14)] transition group-hover:border-gold-300/45">
            <Headphones className="h-4 w-4" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-carbon-950" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-[#1d1c19] dark:text-white">Besoin d’aide ?</span>
            <span className="mt-0.5 block text-[11px] font-semibold text-[#7a746a] dark:text-carbon-400">Centre d’assistance</span>
          </span>
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(faqItems[0].question);

  return (
    <>
      <aside className="fixed left-0 top-4 z-40 hidden h-[min(880px,calc(100vh-2rem))] w-[296px] p-3 lg:block">
        <SidebarContent onHelp={() => setHelpOpen(true)} />
      </aside>
      <div
        className={`fixed inset-0 z-40 bg-carbon-950/70 backdrop-blur-sm transition lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[86vw] p-2 transition-transform ${open ? 'translate-x-0' : '-translate-x-full'} lg:hidden`}
      >
        <SidebarContent onClose={onClose} onHelp={() => setHelpOpen(true)} />
      </aside>
      <Modal
        open={helpOpen}
        title="Centre d’assistance MekLoc"
        subtitle="Trouvez rapidement de l’aide pour utiliser votre espace de gestion."
        onClose={() => setHelpOpen(false)}
        panelClassName="sm:max-w-5xl"
        bodyClassName="bg-[var(--app-modal)]"
      >
        <div className="space-y-5 pb-[calc(env(safe-area-inset-bottom)+8px)]">
          <section className="rounded-3xl border border-gold-300/15 bg-[var(--app-card)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/10 text-gold-200">
                <Headphones className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Support</h3>
                <p className="mt-1 text-xs text-[var(--app-text-muted)]">Choisissez le canal le plus adapté.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <a
                href={`${WHATSAPP_URL}?text=${encodeURIComponent("Bonjour MekLoc, j'ai besoin d'aide sur la plateforme.")}`}
                target="_blank"
                rel="noreferrer"
                className="group rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 transition hover:border-emerald-300/35 hover:bg-emerald-500/10"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-500/10 text-emerald-200">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-[var(--app-text)]">WhatsApp Support</p>
                    <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">{SUPPORT_PHONE_DISPLAY}</p>
                  </div>
                </div>
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Support MekLoc')}`}
                className="group rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 transition hover:border-gold-300/35 hover:bg-gold-400/10"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/10 text-gold-200">
                    <Mail className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-[var(--app-text)]">Email Support</p>
                    <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">{SUPPORT_EMAIL}</p>
                  </div>
                </div>
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Demande de démo d'aide MekLoc")}`}
                className="group rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 transition hover:border-gold-300/35 hover:bg-gold-400/10"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/10 text-gold-200">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-[var(--app-text)]">Demander une démo d’aide</p>
                    <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">Session guidée</p>
                  </div>
                </div>
              </a>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-gold-text)]">
                  <HelpCircle className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--app-gold-text)]">FAQ</h3>
                  <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">Questions fréquentes</p>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              {faqItems.map((item) => {
                const active = activeFaq === item.question;
                return (
                  <button
                    key={item.question}
                    type="button"
                    onClick={() => setActiveFaq(active ? '' : item.question)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      active ? 'border-gold-300/35 bg-gold-400/10' : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] hover:border-gold-300/20 hover:bg-gold-400/10'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-bold text-[var(--app-text)]">{item.question}</span>
                      <ArrowRight className={`h-4 w-4 shrink-0 text-[var(--app-text-muted)] transition ${active ? 'rotate-90 text-[var(--app-gold-text)]' : ''}`} />
                    </span>
                    {active ? <span className="mt-2 block text-sm leading-6 text-[var(--app-text-soft)]">{item.answer}</span> : null}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </Modal>
    </>
  );
}
