import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type UserProfile = {
  id: string;
  agencyId: string | null;
  fullName: string;
  email: string;
  phone: string;
  role: 'Admin' | 'Manager' | 'Staff';
  accountStatus: AccountStatus;
  isSuperAdmin: boolean;
  agency: AgencySubscription | null;
};

export type AccountStatus = 'pending' | 'active' | 'rejected' | 'suspended';
export type AgencyPlan = 'starter' | 'pro' | 'business';
export type BillingStatus = 'trial' | 'paid' | 'unpaid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'other';

export type AgencySubscription = {
  id: string;
  name: string;
  logoPath?: string | null;
  logoUrl?: string | null;
  plan: AgencyPlan;
  billingStatus: BillingStatus;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  lastPaymentDate: string | null;
  nextPaymentDueDate: string | null;
  monthlyPrice: number;
  paymentMethod: PaymentMethod;
  paymentNotes: string;
  createdAt: string;
};

type SignUpInput = {
  email: string;
  password: string;
  agencyName: string;
  fullName?: string;
  phone?: string;
};

type AuthActionResult = {
  needsEmailConfirmation?: boolean;
  profile?: UserProfile | null;
};

type AuthContextValue = {
  isSupabaseEnabled: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  agencyId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signInWithGoogle: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<AuthActionResult>;
  createAgencyProfile: (agencyName: string, fullName?: string, phone?: string) => Promise<UserProfile>;
  refreshProfile: () => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  deleteAccountWithPassword: (password: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  getAccessRequestStatusByEmail: (email: string) => Promise<{ status: string; agencyName: string; plan: string; createdAt: string } | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const demoAuthKey = 'mekloc-demo-auth';
const demoEmail = 'demo@mekloc.ma';
const demoPassword = 'demo123456';
const allowDemoMode = import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';

type ProfileRow = {
  id: string;
  agency_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: 'Admin' | 'Manager' | 'Staff';
  account_status: AccountStatus;
  is_super_admin: boolean;
  agencies: AgencyRow | AgencyRow[] | null;
};

type AgencyRow = {
  id: string;
  name: string;
  logo_path: string | null;
  plan: AgencyPlan | null;
  billing_status: BillingStatus | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  last_payment_date: string | null;
  next_payment_due_date: string | null;
  monthly_price: number | null;
  payment_method: PaymentMethod | null;
  payment_notes: string | null;
  created_at: string;
};

const demoAgency: AgencySubscription = {
  id: 'demo-agency',
  name: 'Atlas Rent Marrakech',
  plan: 'pro',
  billingStatus: 'trial',
  subscriptionStartDate: '2026-05-01',
  subscriptionEndDate: '2026-06-01',
  lastPaymentDate: '2026-05-01',
  nextPaymentDueDate: '2026-06-01',
  monthlyPrice: 250,
  paymentMethod: 'bank_transfer',
  paymentNotes: 'Local demo account with mock operational data.',
  createdAt: '2026-05-01',
};

const demoProfile: UserProfile = {
  id: 'demo-user',
  agencyId: 'demo-agency',
  fullName: 'MekLoc Demo Owner',
  email: demoEmail,
  phone: '+212 6 00 00 00 00',
  role: 'Admin',
  accountStatus: 'active',
  isSuperAdmin: false,
  agency: demoAgency,
};

const demoUser = {
  id: 'demo-user',
  email: demoEmail,
  user_metadata: { full_name: 'MekLoc Demo Owner' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-05-01T00:00:00.000Z',
} as User;

const demoSession = {
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: demoUser,
} as Session;

function mapAgency(row: AgencyRow | AgencyRow[] | null): AgencySubscription | null {
  const agency = Array.isArray(row) ? row[0] : row;
  if (!agency) return null;

  return {
    id: agency.id,
    name: agency.name,
    logoPath: agency.logo_path || null,
    logoUrl: agency.logo_path && supabase ? supabase.storage.from('logos').getPublicUrl(agency.logo_path).data.publicUrl : null,
    plan: agency.plan || 'starter',
    billingStatus: agency.billing_status || 'trial',
    subscriptionStartDate: agency.subscription_start_date,
    subscriptionEndDate: agency.subscription_end_date,
    lastPaymentDate: agency.last_payment_date,
    nextPaymentDueDate: agency.next_payment_due_date,
    monthlyPrice: Number(agency.monthly_price ?? 0),
    paymentMethod: agency.payment_method || 'other',
    paymentNotes: agency.payment_notes || '',
    createdAt: agency.created_at,
  };
}

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    agencyId: row.agency_id,
    fullName: row.full_name || 'MekLoc User',
    email: row.email || '',
    phone: row.phone || '',
    role: row.role,
    accountStatus: row.account_status || 'pending',
    isSuperAdmin: Boolean(row.is_super_admin),
    agency: mapAgency(row.agencies),
  };
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('users_profiles')
    .select(`
      id,
      agency_id,
      full_name,
      email,
      phone,
      role,
      account_status,
      is_super_admin,
      agencies (
        id,
        name,
        logo_path,
        plan,
        billing_status,
        subscription_start_date,
        subscription_end_date,
        last_payment_date,
        next_payment_due_date,
        monthly_price,
        payment_method,
        payment_notes,
        created_at
      )
    `)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

async function isDeletedByEmail(email: string | null | undefined): Promise<boolean> {
  if (!supabase || !email) return false;
  const { data, error } = await supabase.rpc('is_deleted_account', { target_email: email });
  if (error) return false;
  return Boolean(data);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

async function createAgencyAndProfile(
  user: User,
  agencyName: string,
  fullName?: string,
  phone?: string,
): Promise<UserProfile> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const today = new Date();
  const trialEnd = addDays(today, 14);

  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .insert({
      name: agencyName,
      slug: `${createSlug(agencyName)}-${Date.now().toString().slice(-5)}`,
      created_by: user.id,
      plan: 'starter',
      billing_status: 'trial',
      subscription_start_date: today.toISOString().slice(0, 10),
      subscription_end_date: trialEnd,
      next_payment_due_date: trialEnd,
      monthly_price: 0,
      payment_method: 'other',
    })
    .select('id')
    .single();

  if (agencyError) {
    throw new Error(
      `${agencyError.message}. If email confirmations are enabled, confirm the user first or disable confirmations for local testing.`,
    );
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('users_profiles')
    .insert({
      id: user.id,
      agency_id: (agency as { id: string }).id,
      full_name: fullName || user.user_metadata?.full_name || agencyName,
      email: user.email || '',
      phone: phone || '',
      role: 'Admin',
      account_status: 'pending',
      is_super_admin: false,
    })
    .select(`
      id,
      agency_id,
      full_name,
      email,
      phone,
      role,
      account_status,
      is_super_admin,
      agencies (
        id,
        name,
        logo_path,
        plan,
        billing_status,
        subscription_start_date,
        subscription_end_date,
        last_payment_date,
        next_payment_due_date,
        monthly_price,
        payment_method,
        payment_notes,
        created_at
      )
    `)
    .single();

  if (profileError) throw profileError;
  return mapProfile(profileRow as ProfileRow);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isDemoSession, setIsDemoSession] = useState(() => localStorage.getItem(demoAuthKey) === 'true');
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (isDemoSession) {
      setSession(demoSession);
      setUser(demoUser);
      setProfile(demoProfile);
      setLoading(false);
      return undefined;
    }

    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    async function loadInitialSession() {
      const { data, error } = await supabase!.auth.getSession();
      if (!mounted) return;
      if (error) {
        setLoading(false);
        return;
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        try {
          setProfile(await fetchProfile(data.session.user.id));
        } catch {
          setProfile(null);
        } finally {
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    }

    loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setLoading(true);
        fetchProfile(nextSession.user.id)
          .then((nextProfile) => {
            if (mounted) setProfile(nextProfile);
          })
          .catch(() => {
            if (mounted) setProfile(null);
          })
          .finally(() => {
            if (mounted) setLoading(false);
          });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isDemoSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isSupabaseEnabled: isSupabaseConfigured && !isDemoSession,
      session,
      user,
      profile,
      agencyId: profile?.agencyId ?? null,
      loading,
      signIn: async (email, password) => {
        if (allowDemoMode && email.trim().toLowerCase() === demoEmail && password === demoPassword) {
          localStorage.setItem(demoAuthKey, 'true');
          setIsDemoSession(true);
          setSession(demoSession);
          setUser(demoUser);
          setProfile(demoProfile);
          setLoading(false);
          return { profile: demoProfile };
        }

        if (!supabase) return {};

        setLoading(true);
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;

          setSession(data.session);
          setUser(data.user);
          const deleted = await isDeletedByEmail(data.user?.email);
          if (deleted) {
            await supabase.auth.signOut();
            throw new Error('Ce compte a été supprimé. Contactez MekLoc pour réactivation.');
          }
          const nextProfile = data.user ? await fetchProfile(data.user.id) : null;
          setProfile(nextProfile);
          return { profile: nextProfile };
        } finally {
          setLoading(false);
        }
      },
      signInWithGoogle: async () => {
        if (!supabase) return;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (error) throw error;
      },
      signUp: async ({ email, password, agencyName, fullName, phone }) => {
        if (!supabase) return {};

        setLoading(true);
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                agency_name: agencyName,
                full_name: fullName || agencyName,
                phone: phone || '',
              },
            },
          });
          if (error) throw error;
          if (!data.user) throw new Error('Supabase did not return a new user.');

          if (!data.session) {
            setSession(null);
            setUser(data.user);
            setProfile(null);
            return { needsEmailConfirmation: true };
          }

          const nextProfile = await createAgencyAndProfile(data.user, agencyName, fullName || agencyName, phone);

          setSession(data.session);
          setUser(data.user);
          setProfile(nextProfile);
          return {};
        } finally {
          setLoading(false);
        }
      },
      createAgencyProfile: async (agencyName, fullName, phone) => {
        if (!user) throw new Error('You must be signed in before creating an agency.');
        setLoading(true);
        try {
          const nextProfile = await createAgencyAndProfile(user, agencyName, fullName, phone);
          setProfile(nextProfile);
          return nextProfile;
        } finally {
          setLoading(false);
        }
      },
      refreshProfile: async () => {
        if (isDemoSession) return demoProfile;
        if (!supabase) return null;
        const activeUser = user ?? (await supabase.auth.getUser()).data.user;
        if (!activeUser) return null;
        const deleted = await isDeletedByEmail(activeUser.email);
        if (deleted) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          throw new Error('Ce compte a été supprimé. Contactez MekLoc pour réactivation.');
        }
        const nextProfile = await fetchProfile(activeUser.id);
        setProfile(nextProfile);
        return nextProfile;
      },
      signOut: async () => {
        if (isDemoSession) {
          localStorage.removeItem(demoAuthKey);
          setIsDemoSession(false);
          setSession(null);
          setUser(null);
          setProfile(null);
          return;
        }
        if (!supabase) return;
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
      },
      requestPasswordReset: async (email: string) => {
        if (!supabase) throw new Error('Supabase non configuré.');
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/set-password`,
        });
        if (error) throw error;
      },
      deleteAccountWithPassword: async (password: string) => {
        if (!supabase || !user) throw new Error('Session utilisateur introuvable.');
        const email = user.email || '';
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw new Error('Mot de passe incorrect.');
        const { error: profileDeleteError } = await supabase.from('users_profiles').delete().eq('id', user.id);
        if (profileDeleteError) throw profileDeleteError;
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
      },
      updatePassword: async (password: string) => {
        if (!supabase) throw new Error('Supabase non configuré.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },
      getAccessRequestStatusByEmail: async (email: string) => {
        if (!supabase || !email) return null;
        const normalized = normalizeEmail(email);
        const { data: row, error } = await supabase
          .from('access_requests')
          .select('status, agency_name, selected_plan, created_at, email')
          .eq('email', normalized)
          .in('status', ['pending', 'pending_verification', 'contacted', 'payment_pending', 'verified', 'rejected', 'approved'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (import.meta.env.DEV) console.log('Access request found:', row);
        if (error || !row) return null;
        return { status: row.status, agencyName: row.agency_name, plan: row.selected_plan, createdAt: row.created_at };
      },
    }),
    [isDemoSession, loading, profile, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
