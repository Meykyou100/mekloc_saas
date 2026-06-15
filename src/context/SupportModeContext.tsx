import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type AgencySubscription } from './AuthContext';
import { supabase } from '../lib/supabase';

export type SupportAccessMode = 'read_only' | 'full_access';

export type SupportSession = {
  id: string;
  superAdminUserId: string;
  agencyId: string;
  agencyName: string;
  startedAt: string;
  expiresAt: string;
  mode: SupportAccessMode;
  reason: string;
};

type SupportModeContextValue = {
  supportSession: SupportSession | null;
  supportAgency: AgencySubscription | null;
  supportAgencyId: string | null;
  isSupportMode: boolean;
  isReadOnly: boolean;
  startSupportMode: (input: { agencyId: string; agencyName: string; mode: SupportAccessMode; reason: string }) => Promise<void>;
  endSupportMode: () => Promise<void>;
};

const SupportModeContext = createContext<SupportModeContextValue | null>(null);
const storageKey = 'mekloc_support_session_id';
export const SUPPORT_SESSION_MINUTES = 30;
export const SUPPORT_REASON_MIN_LENGTH = 10;

type SupportSessionRow = {
  id: string;
  super_admin_user_id: string;
  agency_id: string;
  started_at: string;
  ended_at: string | null;
  expires_at: string;
  mode: SupportAccessMode;
  reason: string;
  agencies?: SupportAgencyRow | SupportAgencyRow[] | null;
};

type SupportAgencyRow = {
  id: string;
  name: string;
  logo_path?: string | null;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  ice?: string | null;
  rc?: string | null;
  plan?: AgencySubscription['plan'] | null;
  billing_status?: AgencySubscription['billingStatus'] | null;
  subscription_status?: AgencySubscription['subscriptionStatus'] | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  paid_until?: string | null;
  subscription_start_date?: string | null;
  subscription_end_date?: string | null;
  last_payment_date?: string | null;
  next_payment_due_date?: string | null;
  billing_type?: AgencySubscription['billingType'] | null;
  monthly_price?: number | null;
  annual_price?: number | null;
  payment_method?: AgencySubscription['paymentMethod'] | null;
  payment_notes?: string | null;
  created_at?: string | null;
  settings?: Record<string, unknown> | null;
};

function sessionAgency(row: SupportSessionRow) {
  return Array.isArray(row.agencies) ? row.agencies[0] : row.agencies;
}

function mapSession(row: SupportSessionRow, fallbackAgencyName = ''): SupportSession {
  const agency = sessionAgency(row);
  return {
    id: row.id,
    superAdminUserId: row.super_admin_user_id,
    agencyId: row.agency_id,
    agencyName: agency?.name || fallbackAgencyName || 'Agence',
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    mode: row.mode,
    reason: row.reason,
  };
}

function mapSupportAgency(row: SupportAgencyRow | null | undefined): AgencySubscription | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    logoPath: row.logo_path || null,
    logoUrl: row.logo_url || null,
    address: row.address || null,
    phone: row.phone || null,
    email: row.email || null,
    ice: row.ice || null,
    rc: row.rc || null,
    plan: row.plan || 'starter',
    billingStatus: row.billing_status || 'trial',
    subscriptionStatus: row.subscription_status || 'trial_active',
    trialStartedAt: row.trial_started_at || null,
    trialEndsAt: row.trial_ends_at || null,
    paidUntil: row.paid_until || null,
    lastTrialEmailSentAt: null,
    trialExpiredNotifiedAt: null,
    trialReminder3dSentAt: null,
    trialReminder1dSentAt: null,
    trialExpiredEmailSentAt: null,
    lastTrialExtendedAt: null,
    subscriptionStartDate: row.subscription_start_date || null,
    subscriptionEndDate: row.subscription_end_date || null,
    lastPaymentDate: row.last_payment_date || null,
    nextPaymentDueDate: row.next_payment_due_date || null,
    billingType: row.billing_type || 'monthly',
    monthlyPrice: Number(row.monthly_price || 0),
    annualPrice: Number(row.annual_price || 0),
    paymentMethod: row.payment_method || 'other',
    paymentNotes: row.payment_notes || '',
    createdAt: row.created_at || '',
    settings: row.settings || {},
  };
}

export function SupportModeProvider({ children }: { children: React.ReactNode }) {
  const { profile, user, isSupabaseEnabled, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [supportSession, setSupportSession] = useState<SupportSession | null>(null);
  const [supportAgency, setSupportAgency] = useState<AgencySubscription | null>(null);

  const clearLocalSession = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    setSupportSession(null);
    setSupportAgency(null);
  }, []);

  const expireSupportMode = useCallback(async (sessionId?: string) => {
    const activeSessionId = sessionId || supportSession?.id || sessionStorage.getItem(storageKey);
    if (activeSessionId && supabase && profile?.isSuperAdmin) {
      await supabase
        .from('support_sessions')
        .update({ status: 'expired' })
        .eq('id', activeSessionId)
        .is('ended_at', null);
    }
    clearLocalSession();
    navigate('/super-admin', { replace: true });
  }, [clearLocalSession, navigate, profile?.isSuperAdmin, supportSession?.id]);

  const endSupportMode = useCallback(async () => {
    const sessionId = supportSession?.id || sessionStorage.getItem(storageKey);
    if (sessionId && supabase && profile?.isSuperAdmin) {
      await supabase
        .from('support_sessions')
        .update({
          ended_at: new Date().toISOString(),
          status: 'ended',
        })
        .eq('id', sessionId)
        .eq('super_admin_user_id', user?.id || profile.id);
    }
    clearLocalSession();
    navigate('/super-admin', { replace: true });
  }, [clearLocalSession, navigate, profile, supportSession?.id, user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSupabaseEnabled || !supabase || !profile?.isSuperAdmin) {
      clearLocalSession();
      return;
    }

    const sessionId = sessionStorage.getItem(storageKey);
    if (!sessionId) return;

    let cancelled = false;
    supabase
      .from('support_sessions')
      .select('id,super_admin_user_id,agency_id,started_at,ended_at,expires_at,mode,reason,agencies(*)')
      .eq('id', sessionId)
      .eq('super_admin_user_id', user?.id || profile.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        const row = data as SupportSessionRow | null;
        if (error || !row || row.ended_at) {
          clearLocalSession();
          return;
        }
        if (new Date(row.expires_at).getTime() <= Date.now()) {
          void expireSupportMode(row.id);
          return;
        }
        setSupportSession(mapSession(row));
        setSupportAgency(mapSupportAgency(sessionAgency(row)));
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, clearLocalSession, expireSupportMode, isSupabaseEnabled, profile?.id, profile?.isSuperAdmin, user?.id]);

  useEffect(() => {
    if (!supportSession) return;
    const remaining = new Date(supportSession.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      void expireSupportMode(supportSession.id);
      return;
    }
    const timeout = window.setTimeout(() => void expireSupportMode(supportSession.id), remaining);
    return () => window.clearTimeout(timeout);
  }, [expireSupportMode, supportSession]);

  const startSupportMode = useCallback(async (input: { agencyId: string; agencyName: string; mode: SupportAccessMode; reason: string }) => {
    if (!supabase || !profile?.isSuperAdmin || !user?.id) {
      throw new Error('Accès réservé au Super Admin.');
    }
    const reason = input.reason.trim();
    if (reason.length < SUPPORT_REASON_MIN_LENGTH) {
      throw new Error(`Le motif doit contenir au moins ${SUPPORT_REASON_MIN_LENGTH} caractères.`);
    }

    const { data: existingSession, error: existingSessionError } = await supabase
      .from('support_sessions')
      .select('id')
      .eq('super_admin_user_id', user.id)
      .is('ended_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (existingSessionError) throw existingSessionError;
    if (existingSession) {
      throw new Error('Une session d’assistance est déjà active.');
    }

    const expiresAt = new Date(Date.now() + SUPPORT_SESSION_MINUTES * 60_000).toISOString();
    const { data, error } = await supabase
      .from('support_sessions')
      .insert({
        super_admin_user_id: user.id,
        agency_id: input.agencyId,
        expires_at: expiresAt,
        mode: input.mode,
        reason,
        status: 'active',
      })
      .select('id,super_admin_user_id,agency_id,started_at,ended_at,expires_at,mode,reason')
      .single();
    if (error) throw error;

    const agencyResult = await supabase.from('agencies').select('*').eq('id', input.agencyId).maybeSingle();
    if (agencyResult.error || !agencyResult.data) {
      await supabase.from('support_sessions').delete().eq('id', (data as SupportSessionRow).id);
      throw agencyResult.error || new Error('Agence sélectionnée introuvable.');
    }
    const nextSession = mapSession({ ...(data as SupportSessionRow), agencies: agencyResult.data as SupportAgencyRow }, input.agencyName);
    sessionStorage.setItem(storageKey, nextSession.id);
    setSupportSession(nextSession);
    setSupportAgency(mapSupportAgency(agencyResult.data as SupportAgencyRow));
    navigate('/dashboard');
  }, [navigate, profile?.isSuperAdmin, user?.id]);

  const value = useMemo<SupportModeContextValue>(() => ({
    supportSession,
    supportAgency,
    supportAgencyId: supportSession?.agencyId || null,
    isSupportMode: Boolean(supportSession),
    isReadOnly: supportSession?.mode === 'read_only',
    startSupportMode,
    endSupportMode,
  }), [endSupportMode, startSupportMode, supportAgency, supportSession]);

  return <SupportModeContext.Provider value={value}>{children}</SupportModeContext.Provider>;
}

export function useSupportMode() {
  const context = useContext(SupportModeContext);
  if (!context) throw new Error('useSupportMode must be used inside SupportModeProvider');
  return context;
}
