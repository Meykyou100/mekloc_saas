import { Activity, AlertTriangle, Banknote, CalendarClock, CheckCircle2, ChevronDown, Clock3, Crown, Eye, FileText, Headphones, Laptop2, Mail, Menu, Play, RefreshCw, Search, ShieldAlert, Smartphone, Trash2, UserPlus, Users, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth, type AccountStatus, type AgencyPlan, type BillingStatus, type PaymentMethod, type SubscriptionStatus } from '../context/AuthContext';
import { formatMAD } from '../data/mockData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useSupportMode, type SupportAccessMode } from '../context/SupportModeContext';

type AccessRequestStatus = 'pending' | 'pending_verification' | 'contacted' | 'payment_pending' | 'approved' | 'rejected' | 'verified';
type AccessRequestRow = {
  id: string;
  agency_name: string;
  owner_name: string;
  email: string;
  phone_country_code: string;
  phone_number: string;
  country: string;
  city: string;
  selected_plan: AgencyPlan;
  billing_type: 'monthly' | 'annual' | 'lifetime';
  vehicle_count: number;
  status: AccessRequestStatus;
  admin_notes: string | null;
  created_at: string;
  activation_link?: string | null;
};

type AdminAgency = {
  id: string;
  agencyName: string;
  ownerName: string;
  email: string;
  plan: AgencyPlan;
  billingStatus: BillingStatus;
  subscriptionStatus: SubscriptionStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  paidUntil: string | null;
  lastPaymentDate: string | null;
  paymentMethod: PaymentMethod;
  paymentNotes: string;
  trialReminder3dSentAt: string | null;
  trialReminder1dSentAt: string | null;
  trialExpiredEmailSentAt: string | null;
  lastTrialExtendedAt: string | null;
  nextPaymentDueDate: string | null;
  vehiclesCount: number;
  usersCount: number;
  accountStatus: AccountStatus;
  monthlyPrice: number;
  createdAt: string | null;
  latestActivityAt: string | null;
};

type AdminUserRow = {
  id: string;
  agency_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  account_status: AccountStatus;
  last_login_at?: string | null;
  last_seen_at?: string | null;
  force_logout_at?: string | null;
  deletion_requested_at?: string | null;
  deletion_scheduled_at?: string | null;
};

type UserSessionRow = {
  id: string;
  user_id: string;
  agency_id: string;
  device_id?: string | null;
  session_key?: string | null;
  device_name: string | null;
  device_label?: string | null;
  device_type?: string | null;
  browser: string | null;
  os: string | null;
  last_activity_at?: string | null;
  last_seen_at: string | null;
  first_seen_at: string | null;
  revoked_at: string | null;
};

type SuperAdminView =
  | 'overview'
  | 'agencies'
  | 'subscriptions'
  | 'payments'
  | 'users'
  | 'sessions'
  | 'access'
  | 'deletions'
  | 'alerts'
  | 'reports'
  | 'settings'
  | 'support';

const monthlyPriceByPlan: Record<AgencyPlan, number> = { starter: 199, pro: 599, business: 399, lifetime: 5999 };

function addDays(baseDate: string | null, days: number) {
  const d = baseDate ? new Date(baseDate) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeAdminAgencyRole(role: string | null | undefined) {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'owner' || value === 'admin') return 'owner';
  if (value === 'manager') return 'manager';
  if (value === 'accountant') return 'accountant';
  return 'agent';
}

function pickAgencyOwnerProfile<T extends { agency_id: string | null; role?: string | null; email?: string | null }>(profiles: T[], agencyId: string) {
  const agencyProfiles = profiles.filter((p) => p.agency_id === agencyId);
  return (
    agencyProfiles.find((p) => normalizeAdminAgencyRole(p.role) === 'owner' && p.email) ||
    agencyProfiles.find((p) => p.email) ||
    agencyProfiles[0] ||
    null
  );
}

function planLabel(plan: AgencyPlan) {
  if (plan === 'lifetime') return 'Plan Lifetime';
  if (plan === 'business') return 'Plan Business';
  if (plan === 'pro') return 'Plan Pro';
  return 'Plan Starter';
}

function billingLabel(status: BillingStatus) {
  if (status === 'trial') return 'Essai';
  if (status === 'paid') return 'Payé';
  if (status === 'unpaid') return 'Non payé';
  if (status === 'overdue') return 'En retard';
  if (status === 'cancelled') return 'Annulé';
  return status;
}

function subscriptionLabel(status: SubscriptionStatus) {
  if (status === 'trial_active') return 'Essai actif';
  if (status === 'trial_expired') return 'Essai expiré';
  if (status === 'active_paid') return 'Abonnement actif';
  if (status === 'payment_pending') return 'Paiement en attente';
  return 'Suspendu';
}

function effectiveAdminStatus(agency: Pick<AdminAgency, 'subscriptionStatus' | 'trialEndsAt' | 'paidUntil'>): SubscriptionStatus {
  if (agency.subscriptionStatus === 'trial_active' && agency.trialEndsAt && new Date(agency.trialEndsAt).getTime() < Date.now()) return 'trial_expired';
  if (agency.subscriptionStatus === 'active_paid' && agency.paidUntil && new Date(agency.paidUntil).getTime() < Date.now()) return 'payment_pending';
  return agency.subscriptionStatus;
}

function subscriptionTone(status: SubscriptionStatus) {
  if (status === 'active_paid') return 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200';
  if (status === 'trial_active') return 'border-sky-300/30 bg-sky-400/15 text-sky-200';
  if (status === 'payment_pending') return 'border-amber-300/30 bg-amber-400/15 text-amber-200';
  return 'border-rose-300/30 bg-rose-400/15 text-rose-200';
}

function accountLabel(status: AccountStatus) {
  if (status === 'active') return 'Actif';
  if (status === 'suspended') return 'Suspendu';
  if (status === 'pending_deletion') return 'Suppression planifiée';
  if (status === 'rejected') return 'Rejeté';
  return 'En attente';
}

function statusPillClass(kind: 'plan' | 'billing' | 'account', value: string) {
  if (kind === 'plan') return 'border-[#E3B117]/30 bg-[#E3B117]/10 text-[#F5C542]';
  if (kind === 'billing') {
    if (value === 'paid') return 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200';
    if (value === 'trial') return 'border-amber-300/30 bg-amber-400/15 text-amber-200';
    return 'border-rose-300/30 bg-rose-400/15 text-rose-200';
  }
  if (value === 'active') return 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200';
  if (value === 'suspended' || value === 'rejected' || value === 'pending_deletion') return 'border-rose-300/30 bg-rose-400/15 text-rose-200';
  return 'border-amber-300/30 bg-amber-400/15 text-amber-200';
}

function StatusPill({ children, className }: { children: string; className: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function dueState(date: string | null | undefined) {
  if (!date) return { label: 'Non planifiée', tone: 'neutral' as const, days: null as number | null };
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return { label: 'Date invalide', tone: 'neutral' as const, days: null as number | null };
  const days = Math.ceil((parsed.getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `En retard ${Math.abs(days)} j`, tone: 'danger' as const, days };
  if (days <= 7) return { label: `Dans ${days} j`, tone: 'warning' as const, days };
  return { label: `Dans ${days} j`, tone: 'ok' as const, days };
}

function MiniMetric({ label, value, icon: Icon, tone = 'gold' }: { label: string; value: string; icon: ElementType; tone?: 'gold' | 'green' | 'red' | 'blue' }) {
  const tones = {
    gold: 'border-[#E3B117]/20 bg-[#E3B117]/10 text-[#F5C542]',
    green: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
    red: 'border-rose-300/20 bg-rose-400/10 text-rose-200',
    blue: 'border-sky-300/20 bg-sky-400/10 text-sky-200',
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:border-[#E3B117]/25 motion-safe:hover:shadow-[0_18px_50px_rgba(0,0,0,.25)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-carbon-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function SuperAdminSidebar({
  revenue,
  profileName,
  activeView,
  onSelectView,
  mode = 'desktop',
  onClose,
}: {
  revenue: number;
  profileName: string;
  activeView: SuperAdminView;
  onSelectView: (view: SuperAdminView) => void;
  mode?: 'desktop' | 'mobile';
  onClose?: () => void;
}) {
  const nav = [
    ['Tableau de bord', Users, 'overview'],
    ['Agences', BuildingIcon, 'agencies'],
    ['Abonnements', Crown, 'subscriptions'],
    ['Paiements', Banknote, 'payments'],
    ['Utilisateurs', UserPlus, 'users'],
    ['Sessions', Laptop2, 'sessions'],
    ['Demandes d’accès', Mail, 'access'],
    ['Comptes en suppression', Trash2, 'deletions'],
    ['Alertes', AlertTriangle, 'alerts'],
    ['Rapports', Activity, 'reports'],
    ['Paramètres', ShieldAlert, 'settings'],
    ['Support', HelpIcon, 'support'],
  ] as const;

  return (
    <aside className={mode === 'desktop' ? 'hidden w-[260px] shrink-0 lg:block' : 'h-full w-full'}>
      <div className={`${mode === 'desktop' ? 'sticky top-5 h-[calc(100vh-40px)] rounded-[28px]' : 'h-full rounded-r-[28px]'} flex flex-col overflow-hidden border border-white/10 bg-gradient-to-b from-carbon-950 via-black to-carbon-950 p-4 shadow-[0_24px_80px_rgba(0,0,0,.38)]`}>
        <div className="flex items-center gap-3 rounded-2xl border border-[#E3B117]/18 bg-white/[0.035] p-3">
          <img src="/mekloc-logo-transparent.png" alt="MekLoc" className="h-10 w-auto max-w-[116px] object-contain" />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#F5C542]">Super Admin</p>
          </div>
          {mode === 'mobile' ? (
            <button type="button" onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-carbon-300 hover:bg-white/[0.05] hover:text-white">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <p className="mt-5 px-2 text-[11px] font-black uppercase tracking-[0.28em] text-carbon-500">Navigation</p>
        <nav className="mt-3 grid gap-1.5 overflow-y-auto pr-1">
          {nav.map(([label, Icon, target]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                onSelectView(target);
                onClose?.();
              }}
              className={`flex h-10 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-all duration-200 ${
                activeView === target
                  ? 'scale-[1.01] border border-[#E3B117]/35 bg-[#E3B117]/16 text-[#F5C542] shadow-[0_0_24px_rgba(227,177,23,.10)]'
                  : 'text-carbon-300 hover:bg-white/[0.045] hover:text-white motion-safe:hover:translate-x-1'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3 pt-4">
          <div className="rounded-2xl border border-[#E3B117]/18 bg-[#E3B117]/8 p-4">
            <p className="text-[11px] font-bold text-carbon-400">Revenu mensuel estimé</p>
            <p className="mt-2 text-xl font-black text-white">{formatMAD(revenue)}</p>
            <p className="mt-1 text-xs font-semibold text-emerald-300">Suivi agence</p>
            <div className="mt-3 flex h-9 items-end gap-1">
              {[35, 46, 32, 58, 72, 54, 82].map((height, index) => (
                <span key={index} className="flex-1 rounded-t bg-gradient-to-t from-[#E3B117]/35 to-[#F5C542]" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E3B117]/25 bg-[#E3B117]/12 text-sm font-black text-[#F5C542]">
              {profileName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SA'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">{profileName}</p>
              <p className="text-xs text-carbon-400">Super Admin</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return <Users className={className} />;
}

function HelpIcon({ className }: { className?: string }) {
  return <ShieldAlert className={className} />;
}


export default function SuperAdminPage() {
  const { profile, isSupabaseEnabled, signOut } = useAuth();
  const { notify } = useApp();
  const { startSupportMode } = useSupportMode();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accessRequests, setAccessRequests] = useState<AccessRequestRow[]>([]);
  const [allAccessRequests, setAllAccessRequests] = useState<AccessRequestRow[]>([]);
  const [agencies, setAgencies] = useState<AdminAgency[]>([]);
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});
  const [requestToDelete, setRequestToDelete] = useState<AccessRequestRow | null>(null);
  const [agencyToDelete, setAgencyToDelete] = useState<AdminAgency | null>(null);
  const [pendingUserToDelete, setPendingUserToDelete] = useState<AdminUserRow | null>(null);
  const [adminDeleteConfirmText, setAdminDeleteConfirmText] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [activationLinkToCopy, setActivationLinkToCopy] = useState<{ email: string; link: string } | null>(null);
  const [agencyUsers, setAgencyUsers] = useState<Record<string, AdminUserRow[]>>({});
  const [agencySessions, setAgencySessions] = useState<Record<string, UserSessionRow[]>>({});
  const [expandedSessionAgencyId, setExpandedSessionAgencyId] = useState<string | null>(null);
  const [expandedAdvancedAgencyId, setExpandedAdvancedAgencyId] = useState<string | null>(null);
  const [agencySearch, setAgencySearch] = useState('');
  const [agencyPlanFilter, setAgencyPlanFilter] = useState<'all' | 'starter' | 'pro' | 'business' | 'lifetime'>('all');
  const [agencyStatusFilter, setAgencyStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [agencyPaymentFilter, setAgencyPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [agencyDueFilter, setAgencyDueFilter] = useState<'all' | 'soon' | 'overdue' | 'deletion'>('all');
  const [agencySubscriptionFilter, setAgencySubscriptionFilter] = useState<'all' | SubscriptionStatus>('all');
  const [selectedAgencyDetails, setSelectedAgencyDetails] = useState<AdminAgency | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<SuperAdminView>('overview');
  const [showSessionHistoryAgencyId, setShowSessionHistoryAgencyId] = useState<string | null>(null);
  const [trialExtensionAgency, setTrialExtensionAgency] = useState<AdminAgency | null>(null);
  const [trialExtensionDays, setTrialExtensionDays] = useState<1 | 3 | 7>(7);
  const [paymentAgency, setPaymentAgency] = useState<AdminAgency | null>(null);
  const [paymentDuration, setPaymentDuration] = useState<1 | 3 | 6 | 12>(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [paymentNote, setPaymentNote] = useState('');
  const [supportAgency, setSupportAgency] = useState<AdminAgency | null>(null);
  const [supportReason, setSupportReason] = useState('');
  const [supportAccessMode, setSupportAccessMode] = useState<SupportAccessMode>('read_only');
  const [startingSupport, setStartingSupport] = useState(false);

  async function confirmSupportMode() {
    if (!supportAgency) return;
    try {
      setStartingSupport(true);
      await startSupportMode({
        agencyId: supportAgency.id,
        agencyName: supportAgency.agencyName,
        mode: supportAccessMode,
        reason: supportReason,
      });
      setSupportAgency(null);
      setSelectedAgencyDetails(null);
      setSupportReason('');
    } catch (error) {
      notify({
        title: 'Mode assistance impossible',
        message: error instanceof Error ? error.message : 'Veuillez réessayer.',
        type: 'warning',
      });
    } finally {
      setStartingSupport(false);
    }
  }

  const pendingDeletionAccounts = useMemo(() => {
    return Object.entries(agencyUsers).flatMap(([agencyId, users]) => {
      const agency = agencies.find((item) => item.id === agencyId);
      return users
        .filter((user) => user.account_status === 'pending_deletion')
        .map((user) => ({ user, agency }));
    });
  }, [agencies, agencyUsers]);

  const allAdminUsers = useMemo(() => Object.values(agencyUsers).flat(), [agencyUsers]);

  const allAdminSessions = useMemo(() => Object.values(agencySessions).flat(), [agencySessions]);

  const planStats = useMemo(() => {
    return (['starter', 'pro', 'business', 'lifetime'] as AgencyPlan[]).map((plan) => ({
      plan,
      agencies: agencies.filter((agency) => agency.plan === plan),
      revenue: agencies.filter((agency) => agency.plan === plan && agency.billingStatus === 'paid').reduce((sum, agency) => sum + agency.monthlyPrice, 0),
    }));
  }, [agencies]);

  const agencySummary = useMemo(() => {
    const closeDue = agencies.filter((agency) => {
      const state = dueState(agency.nextPaymentDueDate);
      return state.days !== null && state.days >= 0 && state.days <= 7;
    }).length;
    const watch = agencies.filter((agency) => agency.accountStatus === 'suspended' || agency.accountStatus === 'pending_deletion' || agency.billingStatus === 'overdue').length;
    return {
      active: agencies.filter((agency) => agency.accountStatus === 'active').length,
      trial: agencies.filter((agency) => agency.billingStatus === 'trial').length,
      paid: agencies.filter((agency) => agency.billingStatus === 'paid').length,
      unpaid: agencies.filter((agency) => agency.billingStatus === 'unpaid' || agency.billingStatus === 'overdue').length,
      revenue: agencies
        .filter((agency) => agency.accountStatus === 'active' && agency.billingStatus === 'paid')
        .reduce((sum, agency) => sum + agency.monthlyPrice, 0),
      closeDue,
      suspendedOrWatch: watch,
    };
  }, [agencies]);

  const adminAlerts = useMemo(() => {
    const alerts: Array<{ id: string; title: string; description: string; tone: 'danger' | 'warning' | 'gold'; agency?: AdminAgency }> = [];
    agencies.forEach((agency) => {
      const state = dueState(agency.nextPaymentDueDate);
      const subscriptionStatus = effectiveAdminStatus(agency);
      if (subscriptionStatus === 'trial_expired') {
        alerts.push({
          id: `trial-expired-${agency.id}`,
          title: `${agency.agencyName} · essai expiré`,
          description: agency.trialEndsAt ? `L’essai de 7 jours a expiré le ${new Date(agency.trialEndsAt).toLocaleDateString('fr-FR')}.` : 'L’essai gratuit est expiré.',
          tone: 'danger',
          agency,
        });
      } else if (subscriptionStatus === 'trial_active' && agency.trialEndsAt) {
        const trialState = dueState(agency.trialEndsAt);
        if (trialState.days === 3) {
          alerts.push({
            id: `trial-3d-${agency.id}`,
            title: `${agency.agencyName} · essai termine dans 3 jours`,
            description: 'Le rappel à 3 jours peut être envoyé depuis la fiche agence.',
            tone: 'gold',
            agency,
          });
        } else if (trialState.days === 0) {
          alerts.push({
            id: `trial-today-${agency.id}`,
            title: `${agency.agencyName} · essai termine aujourd’hui`,
            description: 'L’agence entrera ensuite dans la période de grâce de 24 heures.',
            tone: 'warning',
            agency,
          });
        } else if (trialState.days !== null && trialState.days > 0 && trialState.days <= 2) {
          alerts.push({
            id: `trial-soon-${agency.id}`,
            title: `${agency.agencyName} · fin d’essai proche`,
            description: `Essai gratuit ${trialState.label.toLowerCase()}.`,
            tone: 'warning',
            agency,
          });
        }
      } else if (agency.billingStatus === 'overdue') {
        alerts.push({
          id: `overdue-${agency.id}`,
          title: `${agency.agencyName} · paiement en retard`,
          description: agency.nextPaymentDueDate ? `Échéance dépassée depuis le ${agency.nextPaymentDueDate}.` : 'Paiement marqué en retard.',
          tone: 'danger',
          agency,
        });
      } else if (state.days !== null && state.days >= 0 && state.days <= 7) {
        alerts.push({
          id: `due-${agency.id}`,
          title: `${agency.agencyName} · échéance proche`,
          description: `Prochaine échéance ${state.label.toLowerCase()} (${agency.nextPaymentDueDate}).`,
          tone: 'warning',
          agency,
        });
      }
      if (subscriptionStatus === 'payment_pending') {
        alerts.push({
          id: `payment-pending-${agency.id}`,
          title: `${agency.agencyName} · paiement en attente`,
          description: 'L’abonnement doit être régularisé ou activé manuellement.',
          tone: 'warning',
          agency,
        });
      }
      if (agency.accountStatus === 'suspended' || subscriptionStatus === 'suspended') {
        alerts.push({
          id: `suspended-${agency.id}`,
          title: `${agency.agencyName} · compte suspendu`,
          description: 'Le compte agence est suspendu côté profils utilisateurs.',
          tone: 'danger',
          agency,
        });
      }
    });
    pendingDeletionAccounts.slice(0, 5).forEach(({ user, agency }) => {
      alerts.push({
        id: `deletion-${user.id}`,
        title: `${agency?.agencyName || 'Agence'} · suppression planifiée`,
        description: `Suppression prévue le ${formatSince(user.deletion_scheduled_at)}.`,
        tone: 'danger',
        agency,
      });
    });
    accessRequests.filter((request) => request.status === 'pending' || request.status === 'verified').slice(0, 5).forEach((request) => {
      alerts.push({
        id: `request-${request.id}`,
        title: `${request.agency_name} · demande à traiter`,
        description: `${request.owner_name} attend une validation (${planLabel(request.selected_plan)}).`,
        tone: 'gold',
      });
    });
    return alerts.slice(0, 8);
  }, [accessRequests, agencies, pendingDeletionAccounts]);

  const filteredAgencies = useMemo(() => {
    const q = agencySearch.trim().toLowerCase();
    return agencies.filter((agency) => {
      const searchMatch = !q || `${agency.agencyName} ${agency.ownerName} ${agency.email}`.toLowerCase().includes(q);
      const planMatch = agencyPlanFilter === 'all' || agency.plan === agencyPlanFilter;
      const statusMatch = agencyStatusFilter === 'all' || agency.accountStatus === agencyStatusFilter;
      const effectiveStatus = effectiveAdminStatus(agency);
      const paymentMatch =
        agencyPaymentFilter === 'all' ||
        (agencyPaymentFilter === 'paid' ? effectiveStatus === 'active_paid' : ['payment_pending', 'trial_expired'].includes(effectiveStatus));
      const subscriptionMatch = agencySubscriptionFilter === 'all' || effectiveStatus === agencySubscriptionFilter;
      const due = dueState(agency.nextPaymentDueDate);
      const dueMatch =
        agencyDueFilter === 'all' ||
        (agencyDueFilter === 'soon' && due.days !== null && due.days >= 0 && due.days <= 7) ||
        (agencyDueFilter === 'overdue' && (agency.billingStatus === 'overdue' || (due.days !== null && due.days < 0))) ||
        (agencyDueFilter === 'deletion' && agency.accountStatus === 'pending_deletion');
      return searchMatch && planMatch && statusMatch && paymentMatch && subscriptionMatch && dueMatch;
    });
  }, [agencies, agencyDueFilter, agencyPaymentFilter, agencyPlanFilter, agencySearch, agencyStatusFilter, agencySubscriptionFilter]);

  const loadAll = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) return;
    setLoading(true);
    try {
      const [reqRes, agencyRes, usersRes, vehicleRes] = await Promise.all([
        supabase.from('access_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('agencies').select('*'),
        supabase.from('users_profiles').select('id,agency_id,account_status,email,full_name,role,last_login_at,last_seen_at,deletion_requested_at,deletion_scheduled_at'),
        supabase.from('vehicles').select('agency_id'),
      ]);
      if (reqRes.error || agencyRes.error || usersRes.error || vehicleRes.error) throw reqRes.error || agencyRes.error || usersRes.error || vehicleRes.error;
      const allReqs = (reqRes.data || []) as AccessRequestRow[];
      const reqs = allReqs.filter((r) => r.status !== 'approved');
      const approvedReqs = allReqs.filter((r) => r.status === 'approved');
      setAllAccessRequests(allReqs);
      setAccessRequests(reqs);
      setRequestNotes(Object.fromEntries(reqs.map((r) => [r.id, r.admin_notes || ''])));

      const profiles = (usersRes.data || []) as Array<{ agency_id: string | null; account_status: AccountStatus; email: string | null; full_name?: string | null; role: string | null; last_login_at?: string | null; last_seen_at?: string | null }>;
      const vehicles = (vehicleRes.data || []) as Array<{ agency_id: string | null }>;
      const mapped = ((agencyRes.data || []) as Array<{ id: string; name: string; plan: AgencyPlan; billing_status: BillingStatus; subscription_status?: SubscriptionStatus | null; trial_started_at?: string | null; trial_ends_at?: string | null; paid_until?: string | null; last_payment_date?: string | null; payment_method?: PaymentMethod | null; payment_notes?: string | null; trial_reminder_3d_sent_at?: string | null; trial_reminder_1d_sent_at?: string | null; trial_expired_email_sent_at?: string | null; last_trial_extended_at?: string | null; next_payment_due_date: string | null; monthly_price: number | null; created_at?: string | null }>)
        .map((a) => {
          const ownerProfile = pickAgencyOwnerProfile(profiles, a.id);
          const agencyProfiles = profiles.filter((p) => p.agency_id === a.id);
          const latestActivityAt = agencyProfiles
            .flatMap((p) => [p.last_seen_at, p.last_login_at])
            .filter(Boolean)
            .sort((left, right) => new Date(String(right)).getTime() - new Date(String(left)).getTime())[0] || null;
          return {
            id: a.id,
            agencyName: a.name,
            ownerName: ownerProfile?.full_name || 'Responsable',
            email: ownerProfile?.email || approvedReqs.find((r) => r.agency_name === a.name)?.email || '—',
            plan: a.plan || 'starter',
            billingStatus: a.billing_status || 'trial',
            subscriptionStatus: a.subscription_status || (a.billing_status === 'paid' ? 'active_paid' : a.billing_status === 'trial' ? 'trial_active' : a.billing_status === 'cancelled' ? 'suspended' : 'payment_pending'),
            trialStartedAt: a.trial_started_at || null,
            trialEndsAt: a.trial_ends_at || null,
            paidUntil: a.paid_until || null,
            lastPaymentDate: a.last_payment_date || null,
            paymentMethod: a.payment_method || 'other',
            paymentNotes: a.payment_notes || '',
            trialReminder3dSentAt: a.trial_reminder_3d_sent_at || null,
            trialReminder1dSentAt: a.trial_reminder_1d_sent_at || null,
            trialExpiredEmailSentAt: a.trial_expired_email_sent_at || null,
            lastTrialExtendedAt: a.last_trial_extended_at || null,
            nextPaymentDueDate: a.next_payment_due_date,
            vehiclesCount: vehicles.filter((v) => v.agency_id === a.id).length,
            usersCount: profiles.filter((p) => p.agency_id === a.id).length,
            accountStatus: ownerProfile?.account_status || 'pending',
            monthlyPrice: Number(a.monthly_price || monthlyPriceByPlan[a.plan || 'starter']),
            createdAt: a.created_at || null,
            latestActivityAt,
          };
        });
      setAgencies(mapped);

      const byAgencyUsers: Record<string, AdminUserRow[]> = {};
      ((usersRes.data || []) as AdminUserRow[]).forEach((u) => {
        const agencyId = u.agency_id || '';
        if (!agencyId) return;
        if (!byAgencyUsers[agencyId]) byAgencyUsers[agencyId] = [];
        byAgencyUsers[agencyId].push(u);
      });
      Object.values(byAgencyUsers).forEach((list) => {
        list.sort((a, b) => {
          const rank = (role: string | null) => (normalizeAdminAgencyRole(role) === 'owner' ? 0 : normalizeAdminAgencyRole(role) === 'manager' ? 1 : 2);
          return rank(a.role) - rank(b.role) || String(a.full_name || a.email || '').localeCompare(String(b.full_name || b.email || ''));
        });
      });
      setAgencyUsers(byAgencyUsers);

      try {
        const sessionRes = await supabase
          .from('user_sessions')
          .select('id,user_id,agency_id,device_id,session_key,device_name,device_label,device_type,browser,os,last_activity_at,last_seen_at,first_seen_at,revoked_at')
          .order('last_seen_at', { ascending: false });
        if (!sessionRes.error) {
          const byAgencySessions: Record<string, UserSessionRow[]> = {};
          ((sessionRes.data || []) as UserSessionRow[]).forEach((s) => {
            if (!byAgencySessions[s.agency_id]) byAgencySessions[s.agency_id] = [];
            byAgencySessions[s.agency_id].push(s);
          });
          setAgencySessions(byAgencySessions);
        } else {
          setAgencySessions({});
        }
      } catch {
        setAgencySessions({});
      }
    } catch (error) {
      notify({ title: 'Erreur chargement', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function runAction(key: string, action: () => Promise<void>) {
    setActionLoading((curr) => ({ ...curr, [key]: true }));
    try {
      await action();
    } catch (error) {
      notify({
        title: 'Action impossible',
        message: error instanceof Error ? error.message : 'Veuillez réessayer.',
        type: 'warning',
      });
    } finally {
      setActionLoading((curr) => ({ ...curr, [key]: false }));
    }
  }

  async function getFreshAccessToken() {
    if (!supabase) return null;
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) return refreshed.session.access_token;
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  }

  async function fetchWithAdminAuth(webhook: string, body: unknown) {
    if (!supabase) throw new Error('Supabase indisponible.');
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    let token = await getFreshAccessToken();
    if (!token) throw new Error('Session admin introuvable. Reconnectez-vous puis réessayez.');

    const doFetch = (accessToken: string) =>
      fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
        body: JSON.stringify(body),
      });

    let response = await doFetch(token);
    if (response.status === 401 || response.status === 403) {
      token = await getFreshAccessToken();
      if (!token) throw new Error('Session expirée. Reconnectez-vous puis réessayez.');
      response = await doFetch(token);
    }
    return response;
  }

  async function updateRequest(id: string, patch: Partial<AccessRequestRow>, toast: string) {
    if (!supabase || !isSupabaseConfigured) return;
    const { error } = await supabase.from('access_requests').update(patch).eq('id', id);
    if (error) throw error;
    setAccessRequests((curr) => curr.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    notify({ title: toast, type: 'success' });
  }

  async function approveRequest(request: AccessRequestRow) {
    if (!supabase || !isSupabaseConfigured) return;
    const webhook = import.meta.env.VITE_APPROVE_ACCESS_REQUEST_WEBHOOK as string | undefined;
    if (!webhook) throw new Error('Webhook approbation manquant. Configurez VITE_APPROVE_ACCESS_REQUEST_WEBHOOK.');
    const response = await fetchWithAdminAuth(webhook, {
      accessRequestId: request.id,
      redirectTo: `${window.location.origin}/set-password`,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Approbation impossible');
    if (payload?.activationLink) {
      await supabase.from('access_requests').update({ activation_link: payload.activationLink }).eq('id', request.id);
    }
    if (payload?.emailSent === false || payload?.inviteInfo === 'email_failed') {
      notify({
        title: "Demande approuvée",
        message: "Compte approuvé, mais l’email d’activation n’a pas pu être envoyé.",
        type: 'warning',
      });
    } else {
      notify({ title: "Demande approuvée", message: "Compte approuvé. Email d’activation envoyé au client.", type: 'success' });
    }
    await loadAll();
  }

  async function resendActivationEmail(request: AccessRequestRow) {
    if (!supabase || !isSupabaseConfigured) return;
    if (request.status !== 'approved') {
      notify({ title: 'Demande non approuvée', message: 'Approuvez la demande avant de renvoyer l’email d’activation.', type: 'warning' });
      return;
    }
    const { data, error } = await supabase.functions.invoke('resend-activation-email', {
      body: {
        accessRequestId: request.id,
        redirectTo: window.location.origin,
      },
    });
    const payload = data as { success?: boolean; activationLink?: string; error?: string } | null;
    if (error || !payload?.success) {
      throw new Error(payload?.error || error?.message || "Email d’activation non envoyé.");
    }
    if (payload.activationLink) {
      await supabase.from('access_requests').update({ activation_link: payload.activationLink }).eq('id', request.id);
    }
    notify({ title: 'Email envoyé', message: `Email d’activation renvoyé à ${request.email}.`, type: 'success' });
    await loadAll();
  }

  async function resendAgencyActivationEmail(agency: AdminAgency) {
    if (!supabase || !isSupabaseConfigured) return;
    if (!agency.email || agency.email === '—') throw new Error('Email agence introuvable.');
    const { data, error } = await supabase.functions.invoke('resend-activation-email', {
      body: {
        agencyId: agency.id,
        email: agency.email,
        redirectTo: window.location.origin,
      },
    });
    const payload = data as { success?: boolean; error?: string } | null;
    if (error || !payload?.success) {
      throw new Error(payload?.error || error?.message || "Impossible de renvoyer l’email d’activation.");
    }
    notify({ title: 'Email envoyé', message: "Email d’activation renvoyé avec succès.", type: 'success' });
    await loadAll();
  }

  async function deleteRequest() {
    if (!requestToDelete || !supabase) return;
    const webhook = import.meta.env.VITE_DELETE_ACCESS_REQUEST_WEBHOOK as string | undefined;
    if (!webhook) throw new Error('Webhook suppression demande manquant. Configurez VITE_DELETE_ACCESS_REQUEST_WEBHOOK.');
    const archivedPayload = {
      original_request_id: requestToDelete.id,
      agency_name: requestToDelete.agency_name,
      owner_name: requestToDelete.owner_name,
      email: requestToDelete.email,
      phone_country_code: requestToDelete.phone_country_code,
      phone_number: requestToDelete.phone_number,
      country: requestToDelete.country,
      city: requestToDelete.city,
      selected_plan: requestToDelete.selected_plan,
      billing_type: requestToDelete.billing_type,
      vehicle_count: requestToDelete.vehicle_count,
      status: requestToDelete.status,
      admin_notes: requestToDelete.admin_notes,
      deleted_by: profile?.id ?? null,
      deleted_reason: 'Suppression depuis Super Admin',
    };
    await supabase.from('deleted_access_requests').insert(archivedPayload);
    const response = await fetchWithAdminAuth(webhook, { requestId: requestToDelete.id });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Suppression demande impossible: ${text}`);
    }
    setAccessRequests((curr) => curr.filter((r) => r.id !== requestToDelete.id));
    setRequestToDelete(null);
    notify({ title: 'Demande supprimée', type: 'success' });
  }

  async function changeAgencyPlan(agency: AdminAgency, plan: AgencyPlan) {
    if (!supabase) return;
    const { error } = await supabase.from('agencies').update({ plan, monthly_price: monthlyPriceByPlan[plan] }).eq('id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function markBilling(agency: AdminAgency, status: BillingStatus) {
    if (!supabase) return;
    const subscriptionStatus: SubscriptionStatus = status === 'paid' ? 'active_paid' : status === 'cancelled' ? 'suspended' : 'payment_pending';
    const { error } = await supabase.from('agencies').update({ billing_status: status, subscription_status: subscriptionStatus }).eq('id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function extendSubscription(agency: AdminAgency, days: number) {
    if (!supabase) return;
    const { error } = await supabase.from('agencies').update({ next_payment_due_date: addDays(agency.nextPaymentDueDate, days) }).eq('id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function activateTrial(agency: AdminAgency) {
    if (!supabase) return;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + 7 * 86_400_000);
    const { error } = await supabase.from('agencies').update({
      subscription_status: 'trial_active',
      billing_status: 'trial',
      trial_started_at: startedAt.toISOString(),
      trial_ends_at: endsAt.toISOString(),
      subscription_start_date: startedAt.toISOString().slice(0, 10),
      subscription_end_date: endsAt.toISOString().slice(0, 10),
      paid_until: null,
    }).eq('id', agency.id);
    if (error) throw error;
    await sendTrialEmail(agency, 'trial_started');
    await loadAll();
  }

  async function extendTrial(agency: AdminAgency, days = 7) {
    if (!supabase) return;
    const base = agency.trialEndsAt && new Date(agency.trialEndsAt).getTime() > Date.now() ? new Date(agency.trialEndsAt) : new Date();
    base.setDate(base.getDate() + days);
    const { error } = await supabase.from('agencies').update({
      subscription_status: 'trial_active',
      billing_status: 'trial',
      trial_ends_at: base.toISOString(),
      subscription_end_date: base.toISOString().slice(0, 10),
      last_trial_extended_at: new Date().toISOString(),
      payment_notes: agency.paymentNotes
        ? `${agency.paymentNotes}\nTrial extended by admin (+${days} day${days > 1 ? 's' : ''})`
        : `Trial extended by admin (+${days} day${days > 1 ? 's' : ''})`,
    }).eq('id', agency.id);
    if (error) throw error;
    await loadAll();
    setTrialExtensionAgency(null);
    setSelectedAgencyDetails(null);
    notify({ title: 'Essai prolongé', message: `${agency.agencyName} · +${days} jour${days > 1 ? 's' : ''}`, type: 'success' });
  }

  async function activatePaidSubscription(agency: AdminAgency, months: 1 | 3 | 6 | 12, method: PaymentMethod, notes: string) {
    if (!supabase) return;
    const paidUntil = new Date();
    paidUntil.setMonth(paidUntil.getMonth() + months);
    const { error } = await supabase.from('agencies').update({
      subscription_status: 'active_paid',
      billing_status: 'paid',
      paid_until: paidUntil.toISOString(),
      subscription_end_date: paidUntil.toISOString().slice(0, 10),
      next_payment_due_date: paidUntil.toISOString().slice(0, 10),
      last_payment_date: new Date().toISOString().slice(0, 10),
      payment_method: method,
      payment_notes: notes,
    }).eq('id', agency.id);
    if (error) throw error;
    await sendTrialEmail(agency, 'payment_confirmed');
    await loadAll();
    setPaymentAgency(null);
    setSelectedAgencyDetails(null);
    notify({ title: 'Abonnement activé', message: `${agency.agencyName} · ${months} mois`, type: 'success' });
  }

  async function sendTrialEmail(agency: AdminAgency, type: 'trial_started' | 'trial_reminder_3d' | 'trial_reminder_1d' | 'trial_expired' | 'payment_confirmed') {
    if (!supabase) return;
    const { data, error } = await supabase.functions.invoke('send-subscription-notification', {
      body: { agencyId: agency.id, type },
    });
    if (error || !data?.sent) {
      notify({
        title: 'Abonnement mis à jour, email non envoyé',
        message: data?.error || error?.message || 'Vérifiez RESEND_API_KEY et RESEND_FROM_EMAIL.',
        type: 'warning',
      });
      return;
    }
    notify({ title: 'Email envoyé', message: agency.email, type: 'success' });
  }

  async function suspendAgency(agency: AdminAgency) {
    if (!supabase) return;
    const { error: agencyError } = await supabase.from('agencies').update({ subscription_status: 'suspended', billing_status: 'cancelled' }).eq('id', agency.id);
    if (agencyError) throw agencyError;
    const { error } = await supabase.from('users_profiles').update({ account_status: 'suspended' }).eq('agency_id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function deleteAgency(agency: AdminAgency) {
    if (!supabase) return;
    const { data: linkedProfiles } = await supabase.from('users_profiles').select('id,email,role,agency_id').eq('agency_id', agency.id);
    const ownerProfile = pickAgencyOwnerProfile((linkedProfiles || []) as Array<{ id: string; email: string | null; role: string | null; agency_id: string | null }>, agency.id);
    if (!ownerProfile?.id) throw new Error('Profil propriétaire introuvable pour cette agence.');
    const now = new Date();
    const scheduledAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nowIso = now.toISOString();
    const { error } = await supabase
      .from('users_profiles')
      .update({
        account_status: 'pending_deletion',
        deletion_requested_at: nowIso,
        deletion_scheduled_at: scheduledAt.toISOString(),
        force_logout_at: nowIso,
      })
      .eq('agency_id', agency.id);
    if (error) {
      if (/account_status|deletion_requested_at|deletion_scheduled_at|schema cache/i.test(error.message)) {
        throw new Error('Suppression différée non prête: appliquez la migration account_deletion_grace_safe.sql dans Supabase.');
      }
      throw error;
    }

    const sessionsUpdate = await supabase
      .from('user_sessions')
      .update({ revoked_at: nowIso })
      .eq('agency_id', agency.id)
      .is('revoked_at', null);
    if (sessionsUpdate.error && !/relation .*user_sessions.* does not exist/i.test(sessionsUpdate.error.message)) {
      throw sessionsUpdate.error;
    }

    notify({
      title: 'Suppression programmée',
      message: 'Le compte est désactivé maintenant et visible dans les comptes en cours de suppression.',
      type: 'success',
    });
    await loadAll();
  }

  async function generateActivationLinkForEmail(email: string) {
    if (!supabase) return;
    const webhook = import.meta.env.VITE_GENERATE_ACTIVATION_LINK_WEBHOOK as string | undefined;
    if (!webhook) throw new Error('Webhook génération lien manquant. Configurez VITE_GENERATE_ACTIVATION_LINK_WEBHOOK.');
    const normalized = email.trim().toLowerCase();
    if (!normalized || normalized === '—') throw new Error('Email client introuvable.');
    const response = await fetchWithAdminAuth(webhook, {
      email: normalized,
      redirectTo: `${window.location.origin}/set-password`,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Génération du lien impossible');
    if (payload?.activationLink) {
      setActivationLinkToCopy({ email: normalized, link: payload.activationLink });
      try {
        await navigator.clipboard.writeText(payload.activationLink);
        notify({ title: 'Lien copié', message: 'Lien d’activation copié. Envoyez-le au client via WhatsApp ou Gmail.', type: 'success' });
      } catch {
        notify({
          title: 'Lien généré',
          message: 'Safari a bloqué la copie automatique. Copiez le lien affiché manuellement.',
          type: 'warning',
        });
      }
      return;
    }
    if (payload?.inviteSent) {
      notify({ title: 'Invitation envoyée', message: "Le client a reçu un email d’activation.", type: 'success' });
      return;
    }
    notify({ title: 'Action effectuée', message: 'Activation traitée avec succès.', type: 'success' });
  }

  function formatSince(value: string | null | undefined) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-MA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function formatActivityTime(value: string | null | undefined) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'À l’instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffHours < 48) return 'Hier';
    return date.toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function sessionDisplayLabel(session: UserSessionRow) {
    const browser = session.browser || 'Navigateur';
    const os = session.os || 'Système';
    const device = session.device_type || session.device_name || 'Appareil';
    return [device, browser, os]
      .map((part) => String(part).replace(/\s*•\s*/g, ' ').trim())
      .filter((part, index, parts) => part && parts.findIndex((item) => item.toLowerCase() === part.toLowerCase()) === index)
      .join(' · ');
  }

  function daysRemaining(value: string | null | undefined) {
    if (!value) return '—';
    const target = new Date(value).getTime();
    if (Number.isNaN(target)) return '—';
    return `${Math.max(0, Math.ceil((target - Date.now()) / 86400000))} jour(s)`;
  }

  async function cancelPendingDeletion(user: AdminUserRow) {
    if (!supabase) return;
    const { error } = await supabase
      .from('users_profiles')
      .update({
        account_status: 'active',
        deletion_requested_at: null,
        deletion_scheduled_at: null,
        force_logout_at: null,
      })
      .eq('id', user.id);
    if (error) throw error;
    notify({ title: 'Suppression annulée', message: 'Le compte est de nouveau actif.', type: 'success' });
    await loadAll();
  }

  async function deletePendingAccountNow(user: AdminUserRow) {
    if (!supabase) return;
    if (adminDeleteConfirmText !== 'SUPPRIMER') throw new Error('Tapez SUPPRIMER pour confirmer.');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const webhook = (import.meta.env.VITE_DELETE_PENDING_ACCOUNT_WEBHOOK as string | undefined) || (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/delete-pending-account` : '');
    if (!webhook) throw new Error('Endpoint suppression compte manquant.');
    const response = await fetchWithAdminAuth(webhook, { userId: user.id });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || 'Suppression définitive impossible.');
    notify({ title: 'Compte supprimé définitivement', type: 'success' });
    setAdminDeleteConfirmText('');
    await loadAll();
  }

  function activityLabel(lastSeenAt: string | null, revokedAt: string | null) {
    if (revokedAt) return 'Déconnecté';
    if (!lastSeenAt) return 'Inactif';
    const diffMs = Date.now() - new Date(lastSeenAt).getTime();
    if (diffMs <= 2 * 60 * 1000) return 'À l’instant';
    return formatActivityTime(lastSeenAt);
  }

  async function revokeSingleSession(sessionId: string) {
    if (!supabase) return;
    const { error } = await supabase
      .from('user_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', sessionId)
      .is('revoked_at', null);
    if (error) throw error;
    notify({ title: 'Appareil déconnecté', type: 'success' });
    await loadAll();
  }

  async function revokeUserSessions(agencyId: string, userId: string) {
    if (!supabase) return;
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('user_sessions')
      .update({ revoked_at: nowIso })
      .eq('agency_id', agencyId)
      .eq('user_id', userId)
      .is('revoked_at', null);
    if (error && !/relation .*user_sessions.* does not exist/i.test(error.message)) throw error;
    const profileUpdate = await supabase
      .from('users_profiles')
      .update({ force_logout_at: nowIso })
      .eq('id', userId);
    if (profileUpdate.error) {
      if (/force_logout_at|schema cache/i.test(profileUpdate.error.message)) {
        throw new Error('Session management non prêt: appliquez la migration user_sessions_management_safe.sql dans Supabase.');
      }
      throw profileUpdate.error;
    }
    notify({ title: 'Utilisateur déconnecté', message: 'Toutes ses sessions actives ont été fermées.', type: 'success' });
    await loadAll();
  }

  async function revokeAgencySessions(agency: AdminAgency) {
    if (!supabase) return;
    if (!window.confirm('Voulez-vous vraiment déconnecter tous les utilisateurs de cette agence ?')) return;
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('user_sessions')
      .update({ revoked_at: nowIso })
      .eq('agency_id', agency.id)
      .is('revoked_at', null);
    if (error && !/relation .*user_sessions.* does not exist/i.test(error.message)) throw error;
    const profileUpdate = await supabase
      .from('users_profiles')
      .update({ force_logout_at: nowIso })
      .eq('agency_id', agency.id);
    if (profileUpdate.error) {
      if (/force_logout_at|schema cache/i.test(profileUpdate.error.message)) {
        throw new Error('Session management non prêt: appliquez la migration user_sessions_management_safe.sql dans Supabase.');
      }
      throw profileUpdate.error;
    }
    notify({ title: 'Agence déconnectée', message: 'Tous les appareils actifs ont été déconnectés.', type: 'success' });
    await loadAll();
  }

  if (!isSupabaseEnabled || !profile?.isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const viewMeta: Record<SuperAdminView, { eyebrow: string; title: string; description: string }> = {
    overview: { eyebrow: 'Super Admin', title: 'Gestion des agences', description: 'Gérez toutes les agences, abonnements, paiements et accès.' },
    agencies: { eyebrow: 'Agences', title: 'Comptes agences', description: 'Suivez les agences approuvées, leurs accès et leurs actions.' },
    subscriptions: { eyebrow: 'Abonnements', title: 'Plans et abonnements', description: 'Gérez les plans, limites, tarifs et abonnements des agences.' },
    payments: { eyebrow: 'Paiements', title: 'Paiements agences', description: 'Suivez les paiements des agences et abonnements.' },
    users: { eyebrow: 'Utilisateurs', title: 'Utilisateurs agences', description: 'Gérez les utilisateurs des agences.' },
    sessions: { eyebrow: 'Sessions', title: 'Connexions actives', description: 'Surveillez les connexions actives des utilisateurs.' },
    access: { eyebrow: 'Demandes d’accès', title: 'Nouvelles agences', description: 'Validez les nouvelles agences qui demandent l’accès à MekLoc.' },
    deletions: { eyebrow: 'Comptes en suppression', title: 'Période de grâce', description: 'Suivez les comptes avant suppression définitive.' },
    alerts: { eyebrow: 'Alertes', title: 'Alertes importantes', description: 'Suivez les anomalies importantes de la plateforme.' },
    reports: { eyebrow: 'Rapports', title: 'Performance plateforme', description: 'Analysez les performances de la plateforme.' },
    settings: { eyebrow: 'Paramètres', title: 'Paramètres Super Admin', description: 'Configuration disponible pour l’espace Super Admin.' },
    support: { eyebrow: 'Support', title: 'Support plateforme', description: 'Outils de support disponibles pour l’administration.' },
  };
  const currentView = viewMeta[activeView];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(227,177,23,.08),transparent_28%),linear-gradient(135deg,#050606,#090a0b_45%,#030303)] px-3 py-4 text-white sm:px-4 lg:px-5">
      <style>{`
        @keyframes superAdminViewIn {
          from { opacity: 0; transform: translate3d(0, 14px, 0) scale(.992); filter: blur(4px); }
          to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: blur(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-super-admin-view] { animation: none !important; }
        }
      `}</style>
      <div className="mx-auto flex max-w-[1760px] gap-5">
        <SuperAdminSidebar revenue={agencySummary.revenue} profileName={profile.fullName || 'Younes Mekki'} activeView={activeView} onSelectView={setActiveView} />
        <main className="min-w-0 flex-1 pb-10">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="mb-4 inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E3B117]/25 bg-[#E3B117]/12 px-4 text-sm font-black text-[#F5C542] shadow-[0_12px_35px_rgba(0,0,0,.22)] lg:hidden"
        >
          <Menu className="h-4 w-4" />
          Menu Super Admin
        </button>
        <PageHeader
          eyebrow={currentView.eyebrow}
          title={currentView.title}
          description={currentView.description}
          action={<div className="flex gap-2"><Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={loading} onClick={loadAll}>Actualiser</Button><Button variant="secondary" onClick={async () => { await signOut(); navigate('/auth'); }}>Déconnexion</Button></div>}
        />

        <div key={activeView} data-super-admin-view className="motion-safe:animate-[superAdminViewIn_.28s_ease-out]">
        {(activeView === 'overview' || activeView === 'agencies') ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <MiniMetric label="Agences actives" value={String(agencySummary.active)} icon={Users} tone="green" />
          <MiniMetric label="En essai" value={String(agencySummary.trial)} icon={CalendarClock} tone="blue" />
          <MiniMetric label="Payés" value={String(agencySummary.paid)} icon={CheckCircle2} tone="green" />
          <MiniMetric label="Non payés" value={String(agencySummary.unpaid)} icon={ShieldAlert} tone="red" />
          <MiniMetric label="Revenu estimé" value={formatMAD(agencySummary.revenue)} icon={Banknote} tone="gold" />
          <MiniMetric label="Échéances proches" value={String(agencySummary.closeDue)} icon={AlertTriangle} tone="gold" />
          <MiniMetric label="À surveiller" value={String(agencySummary.suspendedOrWatch)} icon={Activity} tone="red" />
        </div>
        ) : null}

        {(activeView === 'overview' || activeView === 'alerts') ? (
        <Card className="mt-5 overflow-hidden border-[#E3B117]/18">
          <div className="flex flex-col gap-2 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Alertes admin</p>
              <h2 className="mt-1 text-xl font-black text-white">À surveiller</h2>
            </div>
            <Badge>{adminAlerts.length} alerte(s)</Badge>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
            {adminAlerts.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-400 md:col-span-2 xl:col-span-4">Aucune alerte prioritaire avec les données disponibles.</div>
            ) : adminAlerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => alert.agency ? setSelectedAgencyDetails(alert.agency) : undefined}
                className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                  alert.tone === 'danger'
                    ? 'border-rose-300/20 bg-rose-400/10 hover:border-rose-300/35'
                    : alert.tone === 'warning'
                      ? 'border-amber-300/20 bg-amber-400/10 hover:border-amber-300/35'
                      : 'border-[#E3B117]/20 bg-[#E3B117]/10 hover:border-[#E3B117]/35'
                }`}
              >
                <p className="text-sm font-black text-white">{alert.title}</p>
                <p className="mt-2 text-xs leading-5 text-carbon-300">{alert.description}</p>
              </button>
            ))}
          </div>
        </Card>
        ) : null}

        {activationLinkToCopy ? (
          <Card className="mt-4 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">Lien d’activation généré</p>
                <p className="mt-1 text-xs text-carbon-400">{activationLinkToCopy.email}</p>
                <input className="form-control mt-3" value={activationLinkToCopy.link} readOnly />
              </div>
              <Button
                variant="secondary"
                className="h-10"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(activationLinkToCopy.link);
                    notify({ title: 'Lien copié', type: 'success' });
                  } catch {
                    notify({ title: 'Copie bloquée', message: 'Sélectionnez le lien et copiez-le manuellement.', type: 'warning' });
                  }
                }}
              >
                Copier
              </Button>
            </div>
          </Card>
        ) : null}

        {activeView === 'access' ? (
        <Card className="mt-4 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Demandes d’accès</p>
            <h2 className="mt-1 text-xl font-bold">Nouvelles agences</h2>
            <p className="mt-1 text-sm text-carbon-400">Validez les nouvelles agences qui demandent l’accès à MekLoc.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <MiniMetric label="En attente" value={String(allAccessRequests.filter((r) => r.status === 'pending' || r.status === 'pending_verification').length)} icon={Mail} tone="gold" />
            <MiniMetric label="Approuvées" value={String(allAccessRequests.filter((r) => r.status === 'approved').length)} icon={CheckCircle2} tone="green" />
            <MiniMetric label="Refusées" value={String(allAccessRequests.filter((r) => r.status === 'rejected').length)} icon={XCircle} tone="red" />
            <MiniMetric label="Cette semaine" value={String(allAccessRequests.filter((r) => Date.now() - new Date(r.created_at).getTime() <= 7 * 86400000).length)} icon={CalendarClock} tone="blue" />
          </div>
          <div className="grid gap-4 p-5">
            {accessRequests.length === 0 ? <p className="text-sm text-carbon-400">Aucune demande d’accès.</p> : accessRequests.map((req) => (
              <div key={req.id} className="premium-surface rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-white">{req.agency_name}</p><Badge>{req.status}</Badge></div>
                <div className="mt-2 grid gap-2 text-sm text-carbon-300 md:grid-cols-3">
                  <p><strong>Agence:</strong> {req.agency_name}</p><p><strong>Responsable:</strong> {req.owner_name}</p><p><strong>Email:</strong> {req.email}</p>
                  <p><strong>Téléphone:</strong> {req.phone_country_code} {req.phone_number}</p><p><strong>Pays:</strong> {req.country}</p><p><strong>Ville:</strong> {req.city}</p>
                  <p><strong>Plan demandé:</strong> {planLabel(req.selected_plan)}</p><p><strong>Facturation:</strong> {req.billing_type === 'lifetime' ? 'Lifetime' : req.billing_type === 'annual' ? 'Annuel' : 'Mensuel'}</p><p><strong>Nombre de véhicules:</strong> {req.vehicle_count}</p>
                  <p>
                    <strong>Date de demande:</strong>{' '}
                    {new Date(req.created_at).toLocaleString('fr-MA', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" className="h-8 px-2.5 text-xs" loading={Boolean(actionLoading[`req-contact-${req.id}`])} onClick={() => runAction(`req-contact-${req.id}`, async () => updateRequest(req.id, { status: 'contacted' }, 'Marquée contactée'))}>Marquer contactée</Button>
                  <Button variant="secondary" className="h-8 px-2.5 text-xs" loading={Boolean(actionLoading[`req-payment-${req.id}`])} onClick={() => runAction(`req-payment-${req.id}`, async () => updateRequest(req.id, { status: 'payment_pending' }, 'Paiement en attente'))}>Paiement en attente</Button>
                  <Button className="h-8 px-2.5 text-xs" icon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={Boolean(actionLoading[`req-approve-${req.id}`])} onClick={() => runAction(`req-approve-${req.id}`, async () => approveRequest(req))}>Approuver</Button>
                  <Button variant="danger" className="h-8 px-2.5 text-xs" icon={<XCircle className="h-3.5 w-3.5" />} loading={Boolean(actionLoading[`req-reject-${req.id}`])} onClick={() => runAction(`req-reject-${req.id}`, async () => updateRequest(req.id, { status: 'rejected' }, 'Demande rejetée'))}>Rejeter</Button>
                  <Button variant="secondary" className="h-8 px-2.5 text-xs" icon={<UserPlus className="h-3.5 w-3.5" />} loading={Boolean(actionLoading[`req-create-${req.id}`])} onClick={() => runAction(`req-create-${req.id}`, async () => {
                    if (!req.activation_link) return notify({ title: 'Lien indisponible', message: "Aucun lien d’activation enregistré.", type: 'warning' });
                    setActivationLinkToCopy({ email: req.email, link: req.activation_link });
                    try {
                      await navigator.clipboard.writeText(req.activation_link);
                      notify({ title: 'Lien copié', message: 'Lien d’activation copié dans le presse-papiers.', type: 'success' });
                    } catch {
                      notify({ title: 'Lien affiché', message: 'Safari a bloqué la copie automatique. Copiez le lien affiché manuellement.', type: 'warning' });
                    }
                  })}>Créer compte client</Button>
                  {req.status === 'approved' ? (
                    <Button variant="secondary" className="h-8 px-2.5 text-xs" icon={<Mail className="h-3.5 w-3.5" />} loading={Boolean(actionLoading[`req-resend-${req.id}`])} onClick={() => runAction(`req-resend-${req.id}`, async () => resendActivationEmail(req))}>Renvoyer l’email d’activation</Button>
                  ) : null}
                  <Button variant="danger" className="h-8 px-2.5 text-xs" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => { setAdminDeleteConfirmText(''); setRequestToDelete(req); }}>Supprimer la demande</Button>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                  <textarea className="form-control min-h-16" value={requestNotes[req.id] || ''} onChange={(e) => setRequestNotes((c) => ({ ...c, [req.id]: e.target.value }))} placeholder="Notes admin..." />
                  <Button variant="secondary" className="h-10" icon={<FileText className="h-4 w-4" />} loading={Boolean(actionLoading[`req-note-${req.id}`])} onClick={() => runAction(`req-note-${req.id}`, async () => updateRequest(req.id, { admin_notes: requestNotes[req.id] || '' }, 'Note enregistrée'))}>Enregistrer note admin</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        ) : null}

        {activeView === 'deletions' ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Comptes en suppression</p>
            <h2 className="mt-1 text-xl font-bold">Période de grâce</h2>
            <p className="mt-1 text-sm text-carbon-400">Période de grâce de 30 jours avant suppression définitive.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <MiniMetric label="En suppression" value={String(pendingDeletionAccounts.length)} icon={Trash2} tone="red" />
            <MiniMetric label="Suppression proche" value={String(pendingDeletionAccounts.filter(({ user }) => {
              const target = new Date(user.deletion_scheduled_at || '').getTime();
              return Number.isFinite(target) && target - Date.now() <= 7 * 86400000;
            }).length)} icon={AlertTriangle} tone="red" />
            <MiniMetric label="Restaurables" value={String(pendingDeletionAccounts.length)} icon={RefreshCw} tone="gold" />
            <MiniMetric label="Agences liées" value={String(new Set(pendingDeletionAccounts.map(({ agency }) => agency?.id).filter(Boolean)).size)} icon={Users} tone="blue" />
          </div>
          <div className="grid gap-3 p-5">
            {pendingDeletionAccounts.length === 0 ? (
              <p className="text-sm text-carbon-400">Aucun compte en cours de suppression.</p>
            ) : pendingDeletionAccounts.map(({ user, agency }) => (
              <div key={user.id} className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{agency?.agencyName || 'Agence inconnue'}</p>
                    <p className="mt-1 text-sm text-carbon-300">{user.email || 'Email non renseigné'}</p>
                  </div>
                  <div className="grid gap-2 text-xs text-carbon-300 sm:grid-cols-3 lg:min-w-[520px]">
                    <p><strong>Demandé le:</strong> {formatSince(user.deletion_requested_at)}</p>
                    <p><strong>Prévu le:</strong> {formatSince(user.deletion_scheduled_at)}</p>
                    <p><strong>Restant:</strong> {daysRemaining(user.deletion_scheduled_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="h-8 px-3 text-xs"
                      loading={Boolean(actionLoading[`cancel-deletion-${user.id}`])}
                      onClick={() => runAction(`cancel-deletion-${user.id}`, async () => cancelPendingDeletion(user))}
                    >
                      Annuler suppression
                    </Button>
                    <Button
                      variant="danger"
                      className="h-8 px-3 text-xs"
                      loading={Boolean(actionLoading[`delete-pending-${user.id}`])}
                      onClick={() => {
                        setAdminDeleteConfirmText('');
                        setPendingUserToDelete(user);
                      }}
                    >
                      Supprimer maintenant
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        ) : null}

        {(activeView === 'overview' || activeView === 'agencies') ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Comptes agences approuvés</h2>
            <p className="mt-1 text-sm text-carbon-400">Suivi des agences, paiements, accès et sessions.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 lg:grid-cols-[minmax(0,1fr)_repeat(6,auto)]">
            <label className="relative block min-w-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-500" />
              <input
                className="form-control pl-11"
                value={agencySearch}
                onChange={(e) => setAgencySearch(e.target.value)}
                placeholder="Rechercher agence, propriétaire ou email"
              />
            </label>
            <select className="form-control min-w-36" value={agencyPlanFilter} onChange={(e) => setAgencyPlanFilter(e.target.value as typeof agencyPlanFilter)}>
              <option value="all">Tous les plans</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
              <option value="lifetime">Lifetime</option>
            </select>
            <select className="form-control min-w-36" value={agencyStatusFilter} onChange={(e) => setAgencyStatusFilter(e.target.value as typeof agencyStatusFilter)}>
              <option value="all">Tous statuts</option>
              <option value="active">Actif</option>
              <option value="suspended">Suspendu</option>
            </select>
            <select className="form-control min-w-36" value={agencyPaymentFilter} onChange={(e) => setAgencyPaymentFilter(e.target.value as typeof agencyPaymentFilter)}>
              <option value="all">Tous paiements</option>
              <option value="paid">Payé</option>
              <option value="unpaid">Non payé</option>
            </select>
            <select className="form-control min-w-44" value={agencySubscriptionFilter} onChange={(e) => setAgencySubscriptionFilter(e.target.value as typeof agencySubscriptionFilter)}>
              <option value="all">Tous abonnements</option>
              <option value="trial_active">Essai actif</option>
              <option value="trial_expired">Essai expiré</option>
              <option value="active_paid">Abonnement actif</option>
              <option value="payment_pending">Paiement en attente</option>
              <option value="suspended">Suspendu</option>
            </select>
            <select className="form-control min-w-40" value={agencyDueFilter} onChange={(e) => setAgencyDueFilter(e.target.value as typeof agencyDueFilter)}>
              <option value="all">Toutes échéances</option>
              <option value="soon">Échéance proche</option>
              <option value="overdue">En retard</option>
              <option value="deletion">Suppression</option>
            </select>
            <Button
              variant="ghost"
              className="h-12 whitespace-nowrap"
              onClick={() => {
                setAgencySearch('');
                setAgencyPlanFilter('all');
                setAgencyStatusFilter('all');
                setAgencyPaymentFilter('all');
                setAgencySubscriptionFilter('all');
                setAgencyDueFilter('all');
              }}
            >
              Réinitialiser
            </Button>
          </div>
          <div className="grid gap-4 p-5">
            {filteredAgencies.length === 0 ? <p className="text-sm text-carbon-400">Aucun compte agence ne correspond aux filtres.</p> : filteredAgencies.map((agency) => (
              <div key={agency.id} className="premium-surface rounded-3xl border border-white/10 p-4 shadow-[0_18px_55px_rgba(0,0,0,.22)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-black text-white">{agency.agencyName}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${dueState(agency.nextPaymentDueDate).tone === 'danger' ? 'border-rose-300/25 bg-rose-400/10 text-rose-200' : dueState(agency.nextPaymentDueDate).tone === 'warning' ? 'border-amber-300/25 bg-amber-400/10 text-amber-200' : 'border-white/10 bg-white/[0.04] text-carbon-300'}`}>
                        {dueState(agency.nextPaymentDueDate).label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-carbon-300">{agency.ownerName} · <span className="break-all">{agency.email}</span></p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill className={statusPillClass('plan', agency.plan)}>{planLabel(agency.plan)}</StatusPill>
                    <StatusPill className={statusPillClass('billing', agency.billingStatus)}>{billingLabel(agency.billingStatus)}</StatusPill>
                    <StatusPill className={subscriptionTone(effectiveAdminStatus(agency))}>{subscriptionLabel(effectiveAdminStatus(agency))}</StatusPill>
                    <StatusPill className={statusPillClass('account', agency.accountStatus)}>{accountLabel(agency.accountStatus)}</StatusPill>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-carbon-300 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                  <p className="rounded-2xl border border-white/10 bg-carbon-950/45 p-3"><strong className="block text-xs uppercase tracking-[0.14em] text-carbon-500">Échéance</strong><span className="mt-1 block font-semibold text-white">{agency.nextPaymentDueDate || '-'}</span></p>
                  <p className="rounded-2xl border border-white/10 bg-carbon-950/45 p-3"><strong className="block text-xs uppercase tracking-[0.14em] text-carbon-500">Véhicules</strong><span className="mt-1 block font-semibold text-white">{agency.vehiclesCount}</span></p>
                  <p className="rounded-2xl border border-white/10 bg-carbon-950/45 p-3"><strong className="block text-xs uppercase tracking-[0.14em] text-carbon-500">Utilisateurs</strong><span className="mt-1 block font-semibold text-white">{agency.usersCount}</span></p>
                  <p className="rounded-2xl border border-white/10 bg-carbon-950/45 p-3"><strong className="block text-xs uppercase tracking-[0.14em] text-carbon-500">Prix</strong><span className="mt-1 block font-semibold text-white">{formatMAD(agency.monthlyPrice)}</span></p>
                  <p className="rounded-2xl border border-white/10 bg-carbon-950/45 p-3"><strong className="block text-xs uppercase tracking-[0.14em] text-carbon-500">Créée</strong><span className="mt-1 block font-semibold text-white">{formatActivityTime(agency.createdAt)}</span></p>
                  <p className="rounded-2xl border border-white/10 bg-carbon-950/45 p-3"><strong className="block text-xs uppercase tracking-[0.14em] text-carbon-500">Activité</strong><span className="mt-1 block font-semibold text-white">{formatActivityTime(agency.latestActivityAt)}</span></p>
                </div>
                {agency.trialEndsAt ? (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-sky-300/15 bg-sky-400/[0.07] px-3 py-2 text-xs text-sky-100">
                    <Clock3 className="h-4 w-4" />
                    Essai: {dueState(agency.trialEndsAt).label} · fin le {new Date(agency.trialEndsAt).toLocaleDateString('fr-FR')}
                  </div>
                ) : null}
                <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_1fr_auto]">
                  <div className="rounded-2xl border border-white/10 bg-carbon-950/35 p-3">
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#F5C542]">Gestion</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" icon={<Crown className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-plan-${agency.id}`])} onClick={() => runAction(`agency-plan-${agency.id}`, async () => changeAgencyPlan(agency, agency.plan === 'starter' ? 'pro' : agency.plan === 'pro' ? 'business' : agency.plan === 'business' ? 'lifetime' : 'starter'))}>Changer plan</Button>
                      <Button variant="secondary" icon={<Play className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-trial-${agency.id}`])} onClick={() => runAction(`agency-trial-${agency.id}`, async () => activateTrial(agency))}>Activer essai 7 j</Button>
                      <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => { setTrialExtensionDays(7); setTrialExtensionAgency(agency); }}>Prolonger essai</Button>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-carbon-950/35 p-3">
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">Paiement</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" icon={<Banknote className="h-4 w-4" />} onClick={() => { setPaymentDuration(1); setPaymentMethod(agency.paymentMethod || 'bank_transfer'); setPaymentNote(agency.paymentNotes); setPaymentAgency(agency); }}>Marquer comme payé</Button>
                      <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-unpaid-${agency.id}`])} onClick={() => runAction(`agency-unpaid-${agency.id}`, async () => markBilling(agency, 'unpaid'))}>Non payé</Button>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-carbon-950/35 p-3">
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-sky-200">Communication</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" icon={<Mail className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-resend-${agency.id}`])} onClick={() => runAction(`agency-resend-${agency.id}`, async () => resendAgencyActivationEmail(agency))}>Renvoyer email</Button>
                      <Button variant="secondary" icon={<Clock3 className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-reminder-${agency.id}`])} onClick={() => runAction(`agency-reminder-${agency.id}`, async () => sendTrialEmail(agency, effectiveAdminStatus(agency) === 'trial_expired' ? 'trial_expired' : (dueState(agency.trialEndsAt).days ?? 3) <= 1 ? 'trial_reminder_1d' : 'trial_reminder_3d'))}>Rappel essai</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 xl:justify-end">
                    <Button variant="secondary" icon={<Eye className="h-4 w-4" />} onClick={() => setSelectedAgencyDetails(agency)}>Voir détails</Button>
                    <Button variant="ghost" icon={<ChevronDown className={`h-4 w-4 transition ${expandedAdvancedAgencyId === agency.id ? 'rotate-180' : ''}`} />} onClick={() => setExpandedAdvancedAgencyId((current) => (current === agency.id ? null : agency.id))}>Avancé</Button>
                  </div>
                </div>

                {expandedAdvancedAgencyId === agency.id ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-carbon-950/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-carbon-500">Actions avancées</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" icon={<UserPlus className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-link-${agency.id}`])} onClick={() => runAction(`agency-link-${agency.id}`, async () => generateActivationLinkForEmail(agency.email))}>Générer lien d’activation</Button>
                      <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-suspend-${agency.id}`])} onClick={() => runAction(`agency-suspend-${agency.id}`, async () => suspendAgency(agency))}>Suspendre compte</Button>
                    </div>
                    <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 p-3">
                      <p className="text-sm font-semibold text-rose-100">Zone dangereuse</p>
                      <p className="mt-1 text-xs text-rose-100/70">La suppression désactive le compte maintenant et programme la suppression définitive après 30 jours.</p>
                      <Button className="mt-3" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => { setAdminDeleteConfirmText(''); setAgencyToDelete(agency); }}>Supprimer le compte</Button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 rounded-xl border border-white/10 bg-carbon-900/60 p-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                    onClick={() => setExpandedSessionAgencyId((current) => (current === agency.id ? null : agency.id))}
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                      <Users className="h-4 w-4 text-gold-200" />
                      Utilisateurs & sessions
                    </span>
                    <ChevronDown className={`h-4 w-4 text-carbon-300 transition ${expandedSessionAgencyId === agency.id ? 'rotate-180' : ''}`} />
                  </button>

                  {expandedSessionAgencyId === agency.id ? (
                    <div className="mt-3 space-y-3">
                      {(() => {
                        const users = agencyUsers[agency.id] || [];
                        const sessions = agencySessions[agency.id] || [];
                        const activeSessions = sessions.filter((s) => !s.revoked_at);
                        const showHistory = showSessionHistoryAgencyId === agency.id;
                        const lastAgencyActivity = activeSessions[0]?.last_activity_at || activeSessions[0]?.last_seen_at || null;
                        return (
                          <>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                              <div className="rounded-lg border border-white/10 bg-carbon-950/60 px-3 py-2 text-xs text-carbon-300">Total utilisateurs <span className="ml-1 font-semibold text-white">{users.length}</span></div>
                              <div className="rounded-lg border border-white/10 bg-carbon-950/60 px-3 py-2 text-xs text-carbon-300">Utilisateurs actifs <span className="ml-1 font-semibold text-white">{users.filter((u) => u.account_status === 'active').length}</span></div>
                              <div className="rounded-lg border border-white/10 bg-carbon-950/60 px-3 py-2 text-xs text-carbon-300">Appareils connectés <span className="ml-1 font-semibold text-white">{activeSessions.length}</span></div>
                              <div className="rounded-lg border border-white/10 bg-carbon-950/60 px-3 py-2 text-xs text-carbon-300">Dernière activité agence <span className="ml-1 font-semibold text-white">{formatActivityTime(lastAgencyActivity)}</span></div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                className="h-8 px-3 text-xs"
                                loading={Boolean(actionLoading[`agency-revoke-all-${agency.id}`])}
                                onClick={() => runAction(`agency-revoke-all-${agency.id}`, async () => revokeAgencySessions(agency))}
                              >
                                Déconnecter toute l’agence
                              </Button>
                              <Button
                                variant="ghost"
                                className="h-8 px-3 text-xs"
                                onClick={() => setShowSessionHistoryAgencyId((current) => (current === agency.id ? null : agency.id))}
                              >
                                {showHistory ? 'Masquer l’historique' : 'Afficher l’historique'}
                              </Button>
                            </div>

                            {users.length === 0 ? (
                              <p className="text-xs text-carbon-400">Aucun utilisateur lié à cette agence.</p>
                            ) : (
                              <div className="space-y-2">
                                {users.map((u) => {
                                  const userSessions = sessions.filter((s) => s.user_id === u.id);
                                  const activeUserSessions = userSessions.filter((s) => !s.revoked_at);
                                  const displayedSessions = showHistory ? userSessions : activeUserSessions;
                                  const activeCount = activeUserSessions.length;
                                  const sessionLastSeen = activeUserSessions.find((s) => !!s.last_activity_at || !!s.last_seen_at)?.last_activity_at || activeUserSessions.find((s) => !!s.last_seen_at)?.last_seen_at || null;
                                  const sessionFirstSeen = userSessions.find((s) => !!s.first_seen_at)?.first_seen_at || null;
                                  const lastLogin = u.last_login_at || sessionFirstSeen || null;
                                  const lastSeen = u.last_seen_at || sessionLastSeen || null;
                                  return (
                                    <div key={u.id} className="rounded-lg border border-white/10 bg-carbon-950/50 p-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-semibold text-white">{u.full_name || 'Utilisateur'}</p>
                                          <p className="text-xs text-carbon-300">{u.email || '—'} · {u.role || '—'} · {u.account_status}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          <Badge>{activeCount} appareil(s)</Badge>
                                          <Button
                                            variant="secondary"
                                            className="h-7 px-2.5 text-xs"
                                            loading={Boolean(actionLoading[`user-revoke-${u.id}`])}
                                            onClick={() => runAction(`user-revoke-${u.id}`, async () => revokeUserSessions(agency.id, u.id))}
                                          >
                                            Déconnecter utilisateur
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="mt-2 grid gap-1 text-xs text-carbon-300 sm:grid-cols-2">
                                        <p><strong>Dernière connexion:</strong> {formatActivityTime(lastLogin)}</p>
                                        <p><strong>Dernière activité:</strong> {formatActivityTime(lastSeen)}</p>
                                      </div>

                                      <div className="mt-2 space-y-1.5">
                                        {displayedSessions.length === 0 ? (
                                          <p className="text-xs text-carbon-500">{showHistory ? 'Aucune session enregistrée' : 'Aucun appareil actif'}</p>
                                        ) : displayedSessions.map((s) => (
                                          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-carbon-900/60 px-2.5 py-2">
                                            <div className="flex items-center gap-2 text-xs text-carbon-200">
                                              {/iphone|android|ipad/i.test(`${s.os || ''} ${s.device_name || ''}`) ? (
                                                <Smartphone className="h-3.5 w-3.5 text-gold-200" />
                                              ) : (
                                                <Laptop2 className="h-3.5 w-3.5 text-gold-200" />
                                              )}
                                              <span>{sessionDisplayLabel(s)}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                              <Badge>{activityLabel(s.last_seen_at, s.revoked_at)}</Badge>
                                              {!s.revoked_at ? (
                                                <Button
                                                  variant="secondary"
                                                  className="h-7 px-2 text-[11px]"
                                                  loading={Boolean(actionLoading[`session-revoke-${s.id}`])}
                                                  onClick={() => runAction(`session-revoke-${s.id}`, async () => revokeSingleSession(s.id))}
                                                >
                                                  Déconnecter cet appareil
                                                </Button>
                                              ) : null}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
        ) : null}

        {activeView === 'subscriptions' ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Abonnements</p>
            <h2 className="mt-1 text-xl font-bold">Plans et abonnements agences</h2>
            <p className="mt-1 text-sm text-carbon-400">Gérez les plans, limites, tarifs et abonnements des agences.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 xl:grid-cols-7">
            <MiniMetric label="Plans actifs" value="4" icon={Crown} tone="gold" />
            <MiniMetric label="Starter" value={String(agencies.filter((a) => a.plan === 'starter').length)} icon={Users} tone="blue" />
            <MiniMetric label="Pro" value={String(agencies.filter((a) => a.plan === 'pro').length)} icon={ShieldAlert} tone="gold" />
            <MiniMetric label="Business" value={String(agencies.filter((a) => a.plan === 'business').length)} icon={Activity} tone="green" />
            <MiniMetric label="Lifetime" value={String(agencies.filter((a) => a.plan === 'lifetime').length)} icon={CheckCircle2} tone="green" />
            <MiniMetric label="Revenus" value={formatMAD(agencySummary.revenue)} icon={Banknote} tone="gold" />
            <MiniMetric label="Échéances" value={String(agencySummary.closeDue)} icon={CalendarClock} tone="red" />
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-2 xl:grid-cols-4">
            {planStats.map(({ plan, agencies: planAgencies, revenue }) => (
              <div key={plan} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-white">{planLabel(plan)}</p>
                    <p className="mt-1 text-sm text-carbon-400">{formatMAD(monthlyPriceByPlan[plan])}{plan === 'lifetime' ? ' · paiement unique' : ' / mois'}</p>
                  </div>
                  <StatusPill className={statusPillClass('plan', plan)}>Actif</StatusPill>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-carbon-300">
                  <p>Agences utilisant ce plan: <strong className="text-white">{planAgencies.length}</strong></p>
                  <p>Revenu estimé: <strong className="text-white">{formatMAD(revenue)}</strong></p>
                  <p>Limites: <strong className="text-white">{plan === 'starter' ? '15 véhicules' : plan === 'pro' ? '50 véhicules' : 'Illimité / avancé'}</strong></p>
                </div>
              </div>
            ))}
          </div>
        </Card>
        ) : null}

        {activeView === 'payments' ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Paiements</p>
            <h2 className="mt-1 text-xl font-bold">Suivi des paiements agences</h2>
            <p className="mt-1 text-sm text-carbon-400">Suivez les paiements des agences et abonnements.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MiniMetric label="Total encaissé" value={formatMAD(agencySummary.revenue)} icon={Banknote} tone="green" />
            <MiniMetric label="En retard" value={String(agencies.filter((a) => a.billingStatus === 'overdue').length)} icon={AlertTriangle} tone="red" />
            <MiniMetric label="Payés" value={String(agencySummary.paid)} icon={CheckCircle2} tone="green" />
            <MiniMetric label="Revenu prévu" value={formatMAD(agencies.reduce((sum, a) => sum + a.monthlyPrice, 0))} icon={Activity} tone="gold" />
            <MiniMetric label="Non payés" value={String(agencySummary.unpaid)} icon={ShieldAlert} tone="red" />
            <MiniMetric label="Essais" value={String(agencySummary.trial)} icon={CalendarClock} tone="blue" />
          </div>
          <div className="grid gap-3 p-5">
            {filteredAgencies.map((agency) => (
              <div key={`pay-${agency.id}`} className="rounded-2xl border border-white/10 bg-carbon-950/45 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-black text-white">{agency.agencyName}</p>
                    <p className="mt-1 break-all text-sm text-carbon-400">{agency.email}</p>
                  </div>
                  <div className="grid gap-2 text-sm text-carbon-300 sm:grid-cols-4 lg:min-w-[560px]">
                    <p><span className="block text-xs text-carbon-500">Montant</span><strong className="text-white">{formatMAD(agency.monthlyPrice)}</strong></p>
                    <p><span className="block text-xs text-carbon-500">Plan</span><strong className="text-white">{planLabel(agency.plan)}</strong></p>
                    <p><span className="block text-xs text-carbon-500">Échéance</span><strong className="text-white">{agency.nextPaymentDueDate || '—'}</strong></p>
                    <p><span className="block text-xs text-carbon-500">Statut</span><StatusPill className={statusPillClass('billing', agency.billingStatus)}>{billingLabel(agency.billingStatus)}</StatusPill></p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => { setPaymentDuration(1); setPaymentMethod(agency.paymentMethod || 'bank_transfer'); setPaymentNote(agency.paymentNotes); setPaymentAgency(agency); }}>Marquer payé</Button>
                    <Button variant="secondary" loading={Boolean(actionLoading[`pay-unpaid-${agency.id}`])} onClick={() => runAction(`pay-unpaid-${agency.id}`, async () => markBilling(agency, 'unpaid'))}>Non payé</Button>
                    <Button variant="ghost" onClick={() => setSelectedAgencyDetails(agency)}>Voir agence</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        ) : null}

        {activeView === 'users' ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Utilisateurs</p>
            <h2 className="mt-1 text-xl font-bold">Gestion des utilisateurs</h2>
            <p className="mt-1 text-sm text-carbon-400">Gérez les utilisateurs des agences.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-5">
            <MiniMetric label="Actifs" value={String(allAdminUsers.filter((u) => u.account_status === 'active').length)} icon={Users} tone="green" />
            <MiniMetric label="Propriétaires" value={String(allAdminUsers.filter((u) => normalizeAdminAgencyRole(u.role) === 'owner').length)} icon={Crown} tone="gold" />
            <MiniMetric label="Employés" value={String(allAdminUsers.filter((u) => normalizeAdminAgencyRole(u.role) !== 'owner').length)} icon={UserPlus} tone="blue" />
            <MiniMetric label="Inactifs" value={String(allAdminUsers.filter((u) => u.account_status !== 'active').length)} icon={ShieldAlert} tone="red" />
            <MiniMetric label="Total" value={String(allAdminUsers.length)} icon={Activity} tone="gold" />
          </div>
          <div className="grid gap-3 p-5 lg:grid-cols-2">
            {allAdminUsers.length === 0 ? <p className="text-sm text-carbon-400">Aucun utilisateur disponible.</p> : allAdminUsers.map((user) => {
              const agency = agencies.find((item) => item.id === user.agency_id);
              return (
                <div key={user.id} className="rounded-2xl border border-white/10 bg-carbon-950/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-white">{user.full_name || 'Utilisateur'}</p>
                      <p className="mt-1 break-all text-sm text-carbon-400">{user.email || '—'}</p>
                      <p className="mt-1 text-xs text-carbon-500">{agency?.agencyName || 'Agence inconnue'} · {user.role || 'Rôle non renseigné'}</p>
                    </div>
                    <Badge>{accountLabel(user.account_status)}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {agency ? <Button variant="ghost" onClick={() => setSelectedAgencyDetails(agency)}>Voir agence</Button> : null}
                    {agency ? <Button variant="secondary" loading={Boolean(actionLoading[`admin-user-revoke-${user.id}`])} onClick={() => runAction(`admin-user-revoke-${user.id}`, async () => revokeUserSessions(agency.id, user.id))}>Forcer déconnexion</Button> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        ) : null}

        {activeView === 'sessions' ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Sessions</p>
            <h2 className="mt-1 text-xl font-bold">Connexions actives</h2>
            <p className="mt-1 text-sm text-carbon-400">Surveillez les connexions actives des utilisateurs.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <MiniMetric label="Actives" value={String(allAdminSessions.filter((s) => !s.revoked_at).length)} icon={Laptop2} tone="green" />
            <MiniMetric label="Appareils" value={String(new Set(allAdminSessions.map((s) => s.device_id || s.session_key || s.id)).size)} icon={Smartphone} tone="blue" />
            <MiniMetric label="Aujourd’hui" value={String(allAdminSessions.filter((s) => {
              const seenAt = s.last_seen_at || s.last_activity_at;
              return seenAt ? Date.now() - new Date(seenAt).getTime() <= 86400000 : false;
            }).length)} icon={CalendarClock} tone="gold" />
            <MiniMetric label="Révoquées" value={String(allAdminSessions.filter((s) => s.revoked_at).length)} icon={XCircle} tone="red" />
          </div>
          <div className="grid gap-3 p-5">
            {allAdminSessions.length === 0 ? <p className="text-sm text-carbon-400">Aucune session enregistrée.</p> : allAdminSessions.slice(0, 30).map((session) => {
              const user = allAdminUsers.find((item) => item.id === session.user_id);
              const agency = agencies.find((item) => item.id === session.agency_id);
              return (
                <div key={session.id} className="rounded-2xl border border-white/10 bg-carbon-950/45 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-black text-white">{user?.full_name || user?.email || 'Utilisateur'}</p>
                      <p className="mt-1 text-sm text-carbon-400">{agency?.agencyName || 'Agence inconnue'} · {sessionDisplayLabel(session)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{activityLabel(session.last_seen_at, session.revoked_at)}</Badge>
                      {!session.revoked_at ? <Button variant="secondary" loading={Boolean(actionLoading[`admin-session-revoke-${session.id}`])} onClick={() => runAction(`admin-session-revoke-${session.id}`, async () => revokeSingleSession(session.id))}>Déconnecter</Button> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        ) : null}

        {activeView === 'reports' ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Rapports</p>
            <h2 className="mt-1 text-xl font-bold">Performance plateforme</h2>
            <p className="mt-1 text-sm text-carbon-400">Analysez les performances de la plateforme avec les données disponibles.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-6">
            <MiniMetric label="Revenu total" value={formatMAD(agencySummary.revenue)} icon={Banknote} tone="gold" />
            <MiniMetric label="Agences actives" value={String(agencySummary.active)} icon={Users} tone="green" />
            <MiniMetric label="Nouvelles demandes" value={String(allAccessRequests.filter((r) => Date.now() - new Date(r.created_at).getTime() <= 30 * 86400000).length)} icon={Mail} tone="blue" />
            <MiniMetric label="Conversion" value={`${allAccessRequests.length ? Math.round((allAccessRequests.filter((r) => r.status === 'approved').length / allAccessRequests.length) * 100) : 0}%`} icon={Activity} tone="green" />
            <MiniMetric label="Retards" value={String(agencies.filter((a) => a.billingStatus === 'overdue').length)} icon={AlertTriangle} tone="red" />
            <MiniMetric label="Utilisateurs" value={String(allAdminUsers.length)} icon={UserPlus} tone="gold" />
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 lg:col-span-2">
              <p className="font-black text-white">Agences par plan</p>
              <div className="mt-4 space-y-3">
                {planStats.map(({ plan, agencies: planAgencies }) => {
                  const percent = agencies.length ? Math.round((planAgencies.length / agencies.length) * 100) : 0;
                  return (
                    <div key={`bar-${plan}`}>
                      <div className="flex items-center justify-between text-sm"><span className="font-semibold text-carbon-300">{planLabel(plan)}</span><span className="font-black text-white">{planAgencies.length}</span></div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#E3B117]" style={{ width: `${percent}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <p className="font-black text-white">Paiements</p>
              <div className="mt-4 space-y-3 text-sm text-carbon-300">
                <p className="flex justify-between"><span>Payés</span><strong className="text-emerald-200">{agencySummary.paid}</strong></p>
                <p className="flex justify-between"><span>Non payés</span><strong className="text-rose-200">{agencySummary.unpaid}</strong></p>
                <p className="flex justify-between"><span>Essais</span><strong className="text-sky-200">{agencySummary.trial}</strong></p>
              </div>
            </div>
          </div>
        </Card>
        ) : null}

        {(activeView === 'settings' || activeView === 'support') ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {activeView === 'settings' ? (
          <Card className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Paramètres</p>
            <h2 className="mt-1 text-xl font-bold text-white">Paramètres Super Admin</h2>
            <p className="mt-2 text-sm leading-6 text-carbon-400">Aucun module de paramètres Super Admin séparé n’est disponible dans cette page. Les actions existantes restent accessibles depuis les cartes agences.</p>
          </Card>
          ) : null}
          {activeView === 'support' ? (
          <Card className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Support</p>
            <h2 className="mt-1 text-xl font-bold text-white">Support plateforme</h2>
            <p className="mt-2 text-sm leading-6 text-carbon-400">Aucun backend support dédié n’existe ici. Les emails d’activation et liens client utilisent les handlers déjà présents.</p>
          </Card>
          ) : null}
        </div>
        ) : null}
        </div>
        </main>
      </div>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(86vw,320px)]">
            <SuperAdminSidebar revenue={agencySummary.revenue} profileName={profile.fullName || 'Younes Mekki'} activeView={activeView} onSelectView={setActiveView} mode="mobile" onClose={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      ) : null}

      {selectedAgencyDetails ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Fermer les détails" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedAgencyDetails(null)} />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-[620px] flex-col overflow-hidden border-l border-white/10 bg-gradient-to-b from-carbon-950 via-carbon-950 to-black shadow-[0_30px_90px_rgba(0,0,0,.45)] sm:rounded-l-[30px]">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-carbon-950/95 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#F5C542]">Fiche agence</p>
                  <h2 className="mt-1 text-2xl font-black text-white">{selectedAgencyDetails.agencyName}</h2>
                  <p className="mt-1 text-sm text-carbon-300">{selectedAgencyDetails.ownerName} · {selectedAgencyDetails.email}</p>
                </div>
                <button type="button" onClick={() => setSelectedAgencyDetails(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 text-carbon-300 hover:bg-white/[0.05] hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill className={statusPillClass('plan', selectedAgencyDetails.plan)}>{planLabel(selectedAgencyDetails.plan)}</StatusPill>
                <StatusPill className={statusPillClass('billing', selectedAgencyDetails.billingStatus)}>{billingLabel(selectedAgencyDetails.billingStatus)}</StatusPill>
                <StatusPill className={statusPillClass('account', selectedAgencyDetails.accountStatus)}>{accountLabel(selectedAgencyDetails.accountStatus)}</StatusPill>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div className="rounded-3xl border border-[#E3B117]/20 bg-[#E3B117]/10 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-carbon-400">Plan actuel</p>
                    <p className="mt-1 font-black text-white">{planLabel(selectedAgencyDetails.plan)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-carbon-400">Prix</p>
                    <p className="mt-1 font-black text-white">{formatMAD(selectedAgencyDetails.monthlyPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-carbon-400">Échéance</p>
                    <p className="mt-1 font-black text-white">{dueState(selectedAgencyDetails.nextPaymentDueDate).label}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Statut compte', accountLabel(selectedAgencyDetails.accountStatus)],
                  ['Prochaine échéance', selectedAgencyDetails.nextPaymentDueDate || 'Non planifiée'],
                  ['Véhicules', String(selectedAgencyDetails.vehiclesCount)],
                  ['Utilisateurs', String(selectedAgencyDetails.usersCount)],
                  ['Création', formatSince(selectedAgencyDetails.createdAt)],
                  ['Dernière activité', formatActivityTime(selectedAgencyDetails.latestActivityAt)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-carbon-500">{label}</p>
                    <p className="mt-1 font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-carbon-950/55 p-4">
                <p className="text-sm font-black text-white">Historique abonnement</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-carbon-500">Rappel 3 jours</p>
                    <p className={`mt-1 text-sm font-bold ${selectedAgencyDetails.trialReminder3dSentAt ? 'text-emerald-200' : 'text-amber-200'}`}>
                      {selectedAgencyDetails.trialReminder3dSentAt ? 'Envoyé' : 'Non envoyé'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-carbon-500">Rappel 1 jour</p>
                    <p className={`mt-1 text-sm font-bold ${selectedAgencyDetails.trialReminder1dSentAt ? 'text-emerald-200' : 'text-amber-200'}`}>
                      {selectedAgencyDetails.trialReminder1dSentAt ? 'Envoyé' : 'Non envoyé'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    { label: 'Essai activé', date: selectedAgencyDetails.trialStartedAt },
                    { label: 'Rappel 3 jours envoyé', date: selectedAgencyDetails.trialReminder3dSentAt },
                    { label: 'Rappel 1 jour envoyé', date: selectedAgencyDetails.trialReminder1dSentAt },
                    { label: 'Essai prolongé par admin', date: selectedAgencyDetails.lastTrialExtendedAt },
                    { label: 'Essai expiré', date: effectiveAdminStatus(selectedAgencyDetails) === 'trial_expired' ? selectedAgencyDetails.trialEndsAt : null },
                    { label: 'Paiement en attente', date: effectiveAdminStatus(selectedAgencyDetails) === 'payment_pending' ? selectedAgencyDetails.trialEndsAt || selectedAgencyDetails.paidUntil : null },
                    { label: 'Marqué comme payé', date: selectedAgencyDetails.lastPaymentDate },
                    { label: 'Compte suspendu', date: effectiveAdminStatus(selectedAgencyDetails) === 'suspended' ? selectedAgencyDetails.latestActivityAt : null },
                  ].filter((item) => item.date).map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#E3B117]" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <p className="text-xs text-carbon-400">{formatActivityTime(item.date)}</p>
                      </div>
                    </div>
                  ))}
                  {!selectedAgencyDetails.trialStartedAt && !selectedAgencyDetails.lastPaymentDate ? (
                    <p className="text-sm text-carbon-400">Aucun événement horodaté disponible.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-carbon-950/55 p-4">
                <p className="text-sm font-black text-white">Actions rapides</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    icon={<Headphones className="h-4 w-4" />}
                    onClick={() => {
                      setSupportAgency(selectedAgencyDetails);
                      setSupportReason('');
                      setSupportAccessMode('read_only');
                    }}
                  >
                    Ouvrir en mode assistance
                  </Button>
                  <Button variant="secondary" icon={<Crown className="h-4 w-4" />} loading={Boolean(actionLoading[`drawer-plan-${selectedAgencyDetails.id}`])} onClick={() => runAction(`drawer-plan-${selectedAgencyDetails.id}`, async () => changeAgencyPlan(selectedAgencyDetails, selectedAgencyDetails.plan === 'starter' ? 'pro' : selectedAgencyDetails.plan === 'pro' ? 'business' : selectedAgencyDetails.plan === 'business' ? 'lifetime' : 'starter'))}>Changer plan</Button>
                  <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => { setTrialExtensionDays(7); setTrialExtensionAgency(selectedAgencyDetails); }}>Prolonger essai</Button>
                  <Button variant="secondary" icon={<Banknote className="h-4 w-4" />} onClick={() => { setPaymentDuration(1); setPaymentMethod(selectedAgencyDetails.paymentMethod || 'bank_transfer'); setPaymentNote(selectedAgencyDetails.paymentNotes); setPaymentAgency(selectedAgencyDetails); }}>Marquer comme payé</Button>
                  <Button variant="secondary" icon={<Mail className="h-4 w-4" />} loading={Boolean(actionLoading[`drawer-resend-${selectedAgencyDetails.id}`])} onClick={() => runAction(`drawer-resend-${selectedAgencyDetails.id}`, async () => resendAgencyActivationEmail(selectedAgencyDetails))}>Renvoyer email</Button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-carbon-950/55 p-4">
                <p className="text-sm font-black text-white">Utilisateurs</p>
                <div className="mt-3 space-y-2">
                  {(agencyUsers[selectedAgencyDetails.id] || []).length === 0 ? (
                    <p className="text-sm text-carbon-400">Aucun utilisateur disponible.</p>
                  ) : (agencyUsers[selectedAgencyDetails.id] || []).map((user) => (
                    <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{user.full_name || 'Utilisateur'}</p>
                        <p className="text-xs text-carbon-400">{user.email || '—'} · {user.role || '—'}</p>
                      </div>
                      <Badge>{accountLabel(user.account_status)}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-carbon-950/55 p-4">
                <p className="text-sm font-black text-white">Sessions</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-carbon-500">Sessions actives</p>
                    <p className="mt-1 text-lg font-black text-white">{(agencySessions[selectedAgencyDetails.id] || []).filter((session) => !session.revoked_at).length}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-carbon-500">Sessions totales</p>
                    <p className="mt-1 text-lg font-black text-white">{(agencySessions[selectedAgencyDetails.id] || []).length}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-carbon-500">Dernière session</p>
                    <p className="mt-1 text-sm font-semibold text-white">{formatActivityTime((agencySessions[selectedAgencyDetails.id] || [])[0]?.last_seen_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <Modal
        open={Boolean(trialExtensionAgency)}
        onClose={() => setTrialExtensionAgency(null)}
        title="Prolonger l’essai"
        subtitle={trialExtensionAgency?.agencyName}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--app-text-soft)]">
            La nouvelle durée repart de la date de fin actuelle si elle est encore valide, sinon d’aujourd’hui. L’accès sera réactivé immédiatement.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([1, 3, 7] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setTrialExtensionDays(days)}
                className={`min-h-12 rounded-xl border px-3 text-sm font-black transition ${
                  trialExtensionDays === days
                    ? 'border-[#E3B117] bg-[#E3B117] text-carbon-950'
                    : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text)]'
                }`}
              >
                +{days} jour{days > 1 ? 's' : ''}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTrialExtensionAgency(null)}>Annuler</Button>
            <Button
              loading={Boolean(actionLoading['extend-trial-modal'])}
              onClick={() => runAction('extend-trial-modal', async () => {
                if (!trialExtensionAgency) return;
                await extendTrial(trialExtensionAgency, trialExtensionDays);
              })}
            >
              Confirmer
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(paymentAgency)}
        onClose={() => setPaymentAgency(null)}
        title="Marquer comme payé"
        subtitle={paymentAgency?.agencyName}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[var(--app-text)]">Durée du paiement</span>
            <select className="form-control" value={paymentDuration} onChange={(event) => setPaymentDuration(Number(event.target.value) as 1 | 3 | 6 | 12)}>
              <option value={1}>1 mois</option>
              <option value={3}>3 mois</option>
              <option value={6}>6 mois</option>
              <option value={12}>12 mois</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[var(--app-text)]">Méthode de paiement</span>
            <select className="form-control" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
              <option value="cash">Espèces</option>
              <option value="bank_transfer">Virement bancaire</option>
              <option value="cih">CIH</option>
              <option value="paypal">PayPal</option>
              <option value="card">Carte</option>
              <option value="other">Autre</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[var(--app-text)]">Note de paiement</span>
            <textarea className="form-control min-h-28 resize-y" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Référence, montant reçu ou remarque interne..." />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPaymentAgency(null)}>Annuler</Button>
            <Button
              loading={Boolean(actionLoading['payment-modal'])}
              onClick={() => runAction('payment-modal', async () => {
                if (!paymentAgency) return;
                await activatePaidSubscription(paymentAgency, paymentDuration, paymentMethod, paymentNote.trim());
              })}
            >
              Confirmer le paiement
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(supportAgency)}
        onClose={() => {
          if (startingSupport) return;
          setSupportAgency(null);
          setSupportReason('');
        }}
        title="Ouvrir en mode assistance"
        subtitle="Accès temporaire, limité à 30 minutes et entièrement audité."
        panelClassName="sm:max-w-xl"
      >
        {supportAgency ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#E3B117]/25 bg-[#E3B117]/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5C542]">Agence sélectionnée</p>
              <p className="mt-1 text-lg font-black text-white">{supportAgency.agencyName}</p>
              <p className="mt-1 text-sm text-carbon-300">{supportAgency.ownerName} · {supportAgency.email}</p>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-white">Raison de l’accès</span>
              <textarea
                className="form-control min-h-24 resize-y"
                value={supportReason}
                onChange={(event) => setSupportReason(event.target.value)}
                placeholder="Ex. Vérification d’un problème de contrat signalé par l’agence"
                maxLength={500}
              />
              <span className="text-xs text-carbon-400">Obligatoire. Cette note sera conservée dans le journal d’audit.</span>
            </label>

            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-bold text-white">Niveau d’accès</legend>
              {([
                ['read_only', 'Lecture seule', 'Consulter les données sans pouvoir créer, modifier ou supprimer.'],
                ['full_access', 'Accès complet', 'Actions autorisées et automatiquement enregistrées dans le journal.'],
              ] as const).map(([mode, label, description]) => (
                <label key={mode} className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${supportAccessMode === mode ? 'border-[#E3B117]/60 bg-[#E3B117]/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}>
                  <input
                    type="radio"
                    name="support-mode"
                    value={mode}
                    checked={supportAccessMode === mode}
                    onChange={() => setSupportAccessMode(mode)}
                    className="mt-1 accent-[#E3B117]"
                  />
                  <span>
                    <span className="block font-black text-white">{label}</span>
                    <span className="mt-1 block text-sm text-carbon-400">{description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
              <Button variant="secondary" disabled={startingSupport} onClick={() => setSupportAgency(null)}>Annuler</Button>
              <Button
                icon={<Headphones className="h-4 w-4" />}
                loading={startingSupport}
                disabled={supportReason.trim().length < 5}
                onClick={() => void confirmSupportMode()}
              >
                Confirmer
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(requestToDelete)} onClose={() => { setRequestToDelete(null); setAdminDeleteConfirmText(''); }} title="Confirmer la suppression">
        <div className="space-y-3">
        <p className="text-sm text-carbon-300">Voulez-vous vraiment supprimer cette demande ? Tapez <strong>SUPPRIMER</strong> pour confirmer.</p>
        <input className="form-control" value={adminDeleteConfirmText} onChange={(e) => setAdminDeleteConfirmText(e.target.value)} placeholder="SUPPRIMER" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setRequestToDelete(null); setAdminDeleteConfirmText(''); }}>Annuler</Button>
          <Button variant="danger" disabled={adminDeleteConfirmText !== 'SUPPRIMER'} loading={Boolean(actionLoading['delete-request'])} onClick={() => runAction('delete-request', async () => { if (adminDeleteConfirmText !== 'SUPPRIMER') throw new Error('Tapez SUPPRIMER pour confirmer.'); await deleteRequest(); setAdminDeleteConfirmText(''); })}>Supprimer</Button>
        </div>
      </Modal>

      <Modal open={Boolean(pendingUserToDelete)} onClose={() => { setPendingUserToDelete(null); setAdminDeleteConfirmText(''); }} title="Supprimer définitivement">
        <div className="space-y-3">
          <p className="text-sm text-carbon-300">Cette action supprime définitivement ce compte Auth et son profil. Tapez <strong>SUPPRIMER</strong>.</p>
          <input className="form-control" value={adminDeleteConfirmText} onChange={(e) => setAdminDeleteConfirmText(e.target.value)} placeholder="SUPPRIMER" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setPendingUserToDelete(null); setAdminDeleteConfirmText(''); }}>Annuler</Button>
          <Button variant="danger" disabled={adminDeleteConfirmText !== 'SUPPRIMER'} loading={Boolean(actionLoading[`delete-pending-${pendingUserToDelete?.id}`])} onClick={() => runAction(`delete-pending-${pendingUserToDelete?.id}`, async () => {
            if (!pendingUserToDelete) return;
            await deletePendingAccountNow(pendingUserToDelete);
            setPendingUserToDelete(null);
          })}>Supprimer maintenant</Button>
        </div>
      </Modal>

      <Modal open={Boolean(agencyToDelete)} onClose={() => { setAgencyToDelete(null); setAdminDeleteConfirmText(''); }} title="Confirmer la suppression">
        <div className="space-y-3">
        <p className="text-sm text-carbon-300">Cette action désactive immédiatement le compte agence et programme sa suppression définitive après 30 jours. Il apparaîtra dans <strong>Comptes en cours de suppression</strong>. Tapez <strong>SUPPRIMER</strong> pour confirmer.</p>
        <input className="form-control" value={adminDeleteConfirmText} onChange={(e) => setAdminDeleteConfirmText(e.target.value)} placeholder="SUPPRIMER" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setAgencyToDelete(null); setAdminDeleteConfirmText(''); }}>Annuler</Button>
          <Button
            variant="danger"
            disabled={adminDeleteConfirmText !== 'SUPPRIMER'}
            loading={Boolean(actionLoading['delete-agency'])}
            onClick={() => runAction('delete-agency', async () => {
              if (!agencyToDelete) return;
              if (adminDeleteConfirmText !== 'SUPPRIMER') throw new Error('Tapez SUPPRIMER pour confirmer.');
              await deleteAgency(agencyToDelete);
              setAgencyToDelete(null);
              setAdminDeleteConfirmText('');
            })}
          >
            Programmer la suppression
          </Button>
        </div>
      </Modal>
    </div>
  );
}
