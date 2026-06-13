import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
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
  supportAgencyId: string | null;
  isSupportMode: boolean;
  isReadOnly: boolean;
  startSupportMode: (input: { agencyId: string; agencyName: string; mode: SupportAccessMode; reason: string }) => Promise<void>;
  endSupportMode: () => Promise<void>;
};

const SupportModeContext = createContext<SupportModeContextValue | null>(null);
const storageKey = 'mekloc_support_session_id';
export const SUPPORT_SESSION_MINUTES = 30;

type SupportSessionRow = {
  id: string;
  super_admin_user_id: string;
  agency_id: string;
  started_at: string;
  ended_at: string | null;
  expires_at: string;
  mode: SupportAccessMode;
  reason: string;
  agencies?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

function mapSession(row: SupportSessionRow, fallbackAgencyName = ''): SupportSession {
  const agency = Array.isArray(row.agencies) ? row.agencies[0] : row.agencies;
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

export function SupportModeProvider({ children }: { children: React.ReactNode }) {
  const { profile, user, isSupabaseEnabled, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [supportSession, setSupportSession] = useState<SupportSession | null>(null);

  const clearLocalSession = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    setSupportSession(null);
  }, []);

  const endSupportMode = useCallback(async () => {
    const sessionId = supportSession?.id || sessionStorage.getItem(storageKey);
    if (sessionId && supabase && profile?.isSuperAdmin) {
      await supabase
        .from('support_sessions')
        .update({ ended_at: new Date().toISOString() })
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
      .select('id,super_admin_user_id,agency_id,started_at,ended_at,expires_at,mode,reason,agencies(name)')
      .eq('id', sessionId)
      .eq('super_admin_user_id', user?.id || profile.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        const row = data as SupportSessionRow | null;
        if (error || !row || row.ended_at || new Date(row.expires_at).getTime() <= Date.now()) {
          clearLocalSession();
          return;
        }
        setSupportSession(mapSession(row));
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, clearLocalSession, isSupabaseEnabled, profile?.id, profile?.isSuperAdmin, user?.id]);

  useEffect(() => {
    if (!supportSession) return;
    const remaining = new Date(supportSession.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      void endSupportMode();
      return;
    }
    const timeout = window.setTimeout(() => void endSupportMode(), remaining);
    return () => window.clearTimeout(timeout);
  }, [endSupportMode, supportSession]);

  const startSupportMode = useCallback(async (input: { agencyId: string; agencyName: string; mode: SupportAccessMode; reason: string }) => {
    if (!supabase || !profile?.isSuperAdmin || !user?.id) {
      throw new Error('Accès réservé au Super Admin.');
    }
    const reason = input.reason.trim();
    if (reason.length < 5) {
      throw new Error('Veuillez indiquer une raison précise.');
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
      })
      .select('id,super_admin_user_id,agency_id,started_at,ended_at,expires_at,mode,reason')
      .single();
    if (error) throw error;

    const nextSession = mapSession(data as SupportSessionRow, input.agencyName);
    sessionStorage.setItem(storageKey, nextSession.id);
    setSupportSession(nextSession);
    navigate('/dashboard');
  }, [navigate, profile?.isSuperAdmin, user?.id]);

  const value = useMemo<SupportModeContextValue>(() => ({
    supportSession,
    supportAgencyId: supportSession?.agencyId || null,
    isSupportMode: Boolean(supportSession),
    isReadOnly: supportSession?.mode === 'read_only',
    startSupportMode,
    endSupportMode,
  }), [endSupportMode, startSupportMode, supportSession]);

  return <SupportModeContext.Provider value={value}>{children}</SupportModeContext.Provider>;
}

export function useSupportMode() {
  const context = useContext(SupportModeContext);
  if (!context) throw new Error('useSupportMode must be used inside SupportModeProvider');
  return context;
}
