import { Banknote, CalendarClock, CheckCircle2, ChevronDown, Crown, FileText, Laptop2, Mail, RefreshCw, ShieldAlert, Smartphone, Trash2, UserPlus, Users, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth, type AccountStatus, type AgencyPlan, type BillingStatus } from '../context/AuthContext';
import { formatMAD } from '../data/mockData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

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
  billing_type: 'monthly' | 'annual';
  vehicle_count: number;
  status: AccessRequestStatus;
  admin_notes: string | null;
  created_at: string;
  activation_link?: string | null;
};

type AdminAgency = {
  id: string;
  agencyName: string;
  email: string;
  plan: AgencyPlan;
  billingStatus: BillingStatus;
  nextPaymentDueDate: string | null;
  vehiclesCount: number;
  usersCount: number;
  accountStatus: AccountStatus;
  monthlyPrice: number;
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

const monthlyPriceByPlan: Record<AgencyPlan, number> = { starter: 99, pro: 250, business: 499 };

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


export default function SuperAdminPage() {
  const { profile, isSupabaseEnabled, signOut } = useAuth();
  const { notify } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accessRequests, setAccessRequests] = useState<AccessRequestRow[]>([]);
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
  const [agencyPlanFilter, setAgencyPlanFilter] = useState<'all' | 'starter' | 'business'>('all');
  const [agencyStatusFilter, setAgencyStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [agencyPaymentFilter, setAgencyPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [showSessionHistoryAgencyId, setShowSessionHistoryAgencyId] = useState<string | null>(null);

  const pendingDeletionAccounts = useMemo(() => {
    return Object.entries(agencyUsers).flatMap(([agencyId, users]) => {
      const agency = agencies.find((item) => item.id === agencyId);
      return users
        .filter((user) => user.account_status === 'pending_deletion')
        .map((user) => ({ user, agency }));
    });
  }, [agencies, agencyUsers]);

  const agencySummary = useMemo(() => {
    return {
      active: agencies.filter((agency) => agency.accountStatus === 'active').length,
      trial: agencies.filter((agency) => agency.billingStatus === 'trial').length,
      paid: agencies.filter((agency) => agency.billingStatus === 'paid').length,
      unpaid: agencies.filter((agency) => agency.billingStatus === 'unpaid' || agency.billingStatus === 'overdue').length,
      revenue: agencies
        .filter((agency) => agency.accountStatus === 'active' && agency.billingStatus === 'paid')
        .reduce((sum, agency) => sum + agency.monthlyPrice, 0),
    };
  }, [agencies]);

  const filteredAgencies = useMemo(() => {
    const q = agencySearch.trim().toLowerCase();
    return agencies.filter((agency) => {
      const searchMatch = !q || `${agency.agencyName} ${agency.email}`.toLowerCase().includes(q);
      const planMatch = agencyPlanFilter === 'all' || agency.plan === agencyPlanFilter;
      const statusMatch = agencyStatusFilter === 'all' || agency.accountStatus === agencyStatusFilter;
      const paymentMatch =
        agencyPaymentFilter === 'all' ||
        (agencyPaymentFilter === 'paid' ? agency.billingStatus === 'paid' : agency.billingStatus === 'unpaid' || agency.billingStatus === 'overdue');
      return searchMatch && planMatch && statusMatch && paymentMatch;
    });
  }, [agencies, agencyPaymentFilter, agencyPlanFilter, agencySearch, agencyStatusFilter]);

  const loadAll = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) return;
    setLoading(true);
    try {
      const [reqRes, agencyRes, usersRes, vehicleRes] = await Promise.all([
        supabase.from('access_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('agencies').select('id,name,plan,billing_status,next_payment_due_date,monthly_price'),
        supabase.from('users_profiles').select('id,agency_id,account_status,email,full_name,role,last_login_at,last_seen_at,deletion_requested_at,deletion_scheduled_at'),
        supabase.from('vehicles').select('agency_id'),
      ]);
      if (reqRes.error || agencyRes.error || usersRes.error || vehicleRes.error) throw reqRes.error || agencyRes.error || usersRes.error || vehicleRes.error;
      const reqs = ((reqRes.data || []) as AccessRequestRow[]).filter((r) => r.status !== 'approved');
      const approvedReqs = ((reqRes.data || []) as AccessRequestRow[]).filter((r) => r.status === 'approved');
      setAccessRequests(reqs);
      setRequestNotes(Object.fromEntries(reqs.map((r) => [r.id, r.admin_notes || ''])));

      const profiles = (usersRes.data || []) as Array<{ agency_id: string | null; account_status: AccountStatus; email: string | null; role: string | null }>;
      const vehicles = (vehicleRes.data || []) as Array<{ agency_id: string | null }>;
      const mapped = ((agencyRes.data || []) as Array<{ id: string; name: string; plan: AgencyPlan; billing_status: BillingStatus; next_payment_due_date: string | null; monthly_price: number | null }>)
        .map((a) => {
          const ownerProfile = pickAgencyOwnerProfile(profiles, a.id);
          return {
            id: a.id,
            agencyName: a.name,
            email: ownerProfile?.email || approvedReqs.find((r) => r.agency_name === a.name)?.email || '—',
            plan: a.plan || 'starter',
            billingStatus: a.billing_status || 'trial',
            nextPaymentDueDate: a.next_payment_due_date,
            vehiclesCount: vehicles.filter((v) => v.agency_id === a.id).length,
            usersCount: profiles.filter((p) => p.agency_id === a.id).length,
            accountStatus: ownerProfile?.account_status || 'pending',
            monthlyPrice: Number(a.monthly_price || monthlyPriceByPlan[a.plan || 'starter']),
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
    const { error } = await supabase.from('agencies').update({ billing_status: status }).eq('id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function extendSubscription(agency: AdminAgency, days: number) {
    if (!supabase) return;
    const { error } = await supabase.from('agencies').update({ next_payment_due_date: addDays(agency.nextPaymentDueDate, days) }).eq('id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function suspendAgency(agency: AdminAgency) {
    if (!supabase) return;
    const { error } = await supabase.from('users_profiles').update({ account_status: 'suspended' }).eq('agency_id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function deleteAgency(agency: AdminAgency) {
    if (!supabase) return;
    const webhook = import.meta.env.VITE_DELETE_AGENCY_ACCOUNT_WEBHOOK as string | undefined;
    if (!webhook) {
      throw new Error('Webhook suppression manquant. Configurez VITE_DELETE_AGENCY_ACCOUNT_WEBHOOK.');
    }
    const { data: linkedProfiles } = await supabase.from('users_profiles').select('id,email,role,agency_id').eq('agency_id', agency.id);
    const ownerProfile = pickAgencyOwnerProfile((linkedProfiles || []) as Array<{ id: string; email: string | null; role: string | null; agency_id: string | null }>, agency.id);
    const ownerEmail = ownerProfile?.email || agency.email || null;
    await supabase.from('deleted_access_accounts').insert({
      agency_id: agency.id,
      agency_name: agency.agencyName,
      owner_email: ownerEmail,
      owner_profile_id: ownerProfile?.id ?? null,
      plan: agency.plan,
      billing_status: agency.billingStatus,
      deleted_by: profile?.id ?? null,
      deleted_reason: 'Suppression depuis Super Admin',
    });
    const response = await fetchWithAdminAuth(webhook, { agencyId: agency.id });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Suppression définitive impossible: ${text}`);
    }
    setAgencies((curr) => curr.filter((a) => a.id !== agency.id));
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

  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Espace sécurisé"
          title="Super Admin"
          description="Gestion des demandes d’accès et des comptes agences."
          action={<div className="flex gap-2"><Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={loading} onClick={loadAll}>Actualiser</Button><Button variant="secondary" onClick={async () => { await signOut(); navigate('/auth'); }}>Déconnexion</Button></div>}
        />

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

        <Card className="mt-4 overflow-hidden">
          <div className="border-b border-white/10 p-5"><h2 className="text-xl font-bold">Demandes d’accès</h2></div>
          <div className="grid gap-4 p-5">
            {accessRequests.length === 0 ? <p className="text-sm text-carbon-400">Aucune demande d’accès.</p> : accessRequests.map((req) => (
              <div key={req.id} className="premium-surface rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-white">{req.agency_name}</p><Badge>{req.status}</Badge></div>
                <div className="mt-2 grid gap-2 text-sm text-carbon-300 md:grid-cols-3">
                  <p><strong>Agence:</strong> {req.agency_name}</p><p><strong>Responsable:</strong> {req.owner_name}</p><p><strong>Email:</strong> {req.email}</p>
                  <p><strong>Téléphone:</strong> {req.phone_country_code} {req.phone_number}</p><p><strong>Pays:</strong> {req.country}</p><p><strong>Ville:</strong> {req.city}</p>
                  <p><strong>Plan demandé:</strong> {req.selected_plan}</p><p><strong>Facturation:</strong> {req.billing_type === 'annual' ? 'Annuel' : 'Mensuel'}</p><p><strong>Nombre de véhicules:</strong> {req.vehicle_count}</p>
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

        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Comptes en cours de suppression</h2>
            <p className="mt-1 text-sm text-carbon-400">Période de grâce de 30 jours avant suppression définitive.</p>
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

        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Comptes agences approuvés</h2>
            <p className="mt-1 text-sm text-carbon-400">Suivi des agences, paiements, accès et sessions.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Agences actives', String(agencySummary.active)],
              ['En essai', String(agencySummary.trial)],
              ['Payés', String(agencySummary.paid)],
              ['Non payés', String(agencySummary.unpaid)],
              ['Revenu mensuel estimé', formatMAD(agencySummary.revenue)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-carbon-500">{label}</p>
                <p className="mt-2 text-xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 lg:grid-cols-[1fr_auto_auto_auto]">
            <input
              className="form-control"
              value={agencySearch}
              onChange={(e) => setAgencySearch(e.target.value)}
              placeholder="Rechercher une agence ou un email"
            />
            <select className="form-control min-w-36" value={agencyPlanFilter} onChange={(e) => setAgencyPlanFilter(e.target.value as typeof agencyPlanFilter)}>
              <option value="all">Tous les plans</option>
              <option value="starter">Starter</option>
              <option value="business">Business</option>
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
          </div>
          <div className="grid gap-4 p-5">
            {filteredAgencies.length === 0 ? <p className="text-sm text-carbon-400">Aucun compte agence ne correspond aux filtres.</p> : filteredAgencies.map((agency) => (
              <div key={agency.id} className="premium-surface rounded-2xl p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-black text-white">{agency.agencyName}</p>
                    <p className="mt-1 break-all text-sm text-carbon-300">{agency.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill className={statusPillClass('plan', agency.plan)}>{planLabel(agency.plan)}</StatusPill>
                    <StatusPill className={statusPillClass('billing', agency.billingStatus)}>{billingLabel(agency.billingStatus)}</StatusPill>
                    <StatusPill className={statusPillClass('account', agency.accountStatus)}>{accountLabel(agency.accountStatus)}</StatusPill>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-carbon-300 sm:grid-cols-2 lg:grid-cols-4">
                  <p><strong className="text-white">Prochaine échéance:</strong> {agency.nextPaymentDueDate || '-'}</p>
                  <p><strong className="text-white">Véhicules:</strong> {agency.vehiclesCount}</p>
                  <p><strong className="text-white">Utilisateurs:</strong> {agency.usersCount}</p>
                  <p><strong className="text-white">Prix:</strong> {formatMAD(agency.monthlyPrice)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" icon={<Crown className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-plan-${agency.id}`])} onClick={() => runAction(`agency-plan-${agency.id}`, async () => changeAgencyPlan(agency, agency.plan === 'starter' ? 'pro' : agency.plan === 'pro' ? 'business' : 'starter'))}>Changer plan</Button>
                  <Button variant="secondary" icon={<Banknote className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-paid-${agency.id}`])} onClick={() => runAction(`agency-paid-${agency.id}`, async () => markBilling(agency, 'paid'))}>Marquer payé</Button>
                  <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-unpaid-${agency.id}`])} onClick={() => runAction(`agency-unpaid-${agency.id}`, async () => markBilling(agency, 'unpaid'))}>Marquer non payé</Button>
                  <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-extend-${agency.id}`])} onClick={() => runAction(`agency-extend-${agency.id}`, async () => extendSubscription(agency, 30))}>Prolonger abonnement</Button>
                  <Button variant="secondary" icon={<Mail className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-resend-${agency.id}`])} onClick={() => runAction(`agency-resend-${agency.id}`, async () => resendAgencyActivationEmail(agency))}>Renvoyer l’email d’activation</Button>
                  <Button variant="ghost" icon={<ChevronDown className={`h-4 w-4 transition ${expandedAdvancedAgencyId === agency.id ? 'rotate-180' : ''}`} />} onClick={() => setExpandedAdvancedAgencyId((current) => (current === agency.id ? null : agency.id))}>Actions avancées</Button>
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
                      <p className="mt-1 text-xs text-rose-100/70">La suppression retire définitivement le compte agence après confirmation.</p>
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
      </div>

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
        <p className="text-sm text-carbon-300">Cette action va supprimer l’agence et ses données associées. Tapez <strong>SUPPRIMER</strong> pour confirmer.</p>
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
              notify({ title: 'Compte supprimé', type: 'success' });
            })}
          >
            Supprimer le compte
          </Button>
        </div>
      </Modal>
    </div>
  );
}
