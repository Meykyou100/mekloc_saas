import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  Crown,
  FileText,
  Filter,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth, type AccountStatus, type AgencyPlan, type BillingStatus, type PaymentMethod } from '../context/AuthContext';
import { clients, formatMAD, payments, vehicles } from '../data/mockData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AdminAgency = {
  id: string;
  agencyName: string;
  ownerName: string;
  email: string;
  phone: string;
  vehiclesCount: number;
  plan: AgencyPlan;
  billingStatus: BillingStatus;
  subscriptionEndDate: string | null;
  lastPaymentDate: string | null;
  nextPaymentDueDate: string | null;
  monthlyPrice: number;
  accountStatus: AccountStatus;
  createdDate: string;
  paymentMethod: PaymentMethod;
  paymentNotes: string;
};

type FilterValue = 'all' | AccountStatus | BillingStatus;

const filters: FilterValue[] = ['all', 'pending', 'active', 'suspended', 'rejected', 'overdue', 'paid', 'unpaid'];
const planPrices: Record<AgencyPlan, number> = {
  free: 0,
  pro: 199,
  business: 499,
};

function addDays(dateValue: string | null | undefined, days: number) {
  const date = dateValue ? new Date(dateValue) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const demoAgencies: AdminAgency[] = [
  {
    id: 'demo-agency-1',
    agencyName: 'Atlas Rent Marrakech',
    ownerName: clients[0].fullName,
    email: clients[0].email,
    phone: clients[0].phone,
    vehiclesCount: vehicles.length,
    plan: 'pro',
    billingStatus: 'paid',
    subscriptionEndDate: '2026-06-01',
    lastPaymentDate: '2026-05-01',
    nextPaymentDueDate: '2026-06-01',
    monthlyPrice: 199,
    accountStatus: 'active',
    createdDate: '2026-04-18',
    paymentMethod: 'bank_transfer',
    paymentNotes: 'Demo agency account.',
  },
  {
    id: 'demo-agency-2',
    agencyName: 'Casa Premium Cars',
    ownerName: clients[1].fullName,
    email: clients[1].email,
    phone: clients[1].phone,
    vehiclesCount: 0,
    plan: 'business',
    billingStatus: 'overdue',
    subscriptionEndDate: '2026-05-05',
    lastPaymentDate: payments[1].dueDate,
    nextPaymentDueDate: '2026-05-05',
    monthlyPrice: 499,
    accountStatus: 'pending',
    createdDate: '2026-05-08',
    paymentMethod: 'cash',
    paymentNotes: 'Waiting for first subscription payment.',
  },
];

export default function SuperAdminPage() {
  const { notify } = useApp();
  const { isSupabaseEnabled, profile } = useAuth();
  const [agencies, setAgencies] = useState<AdminAgency[]>(demoAgencies);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const loadAgencies = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) {
      setAgencies(demoAgencies);
      return;
    }

    setLoading(true);
    try {
      const [agenciesResult, profilesResult, vehiclesResult] = await Promise.all([
        supabase
          .from('agencies')
          .select(
            'id, name, plan, billing_status, subscription_end_date, last_payment_date, next_payment_due_date, monthly_price, payment_method, payment_notes, created_at',
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('users_profiles')
          .select('id, agency_id, full_name, email, phone, role, account_status, is_super_admin')
          .order('created_at', { ascending: true }),
        supabase.from('vehicles').select('id, agency_id'),
      ]);

      const firstError = [agenciesResult.error, profilesResult.error, vehiclesResult.error].find(Boolean);
      if (firstError) throw firstError;

      const profiles = (profilesResult.data || []) as {
        agency_id: string | null;
        full_name: string | null;
        email: string | null;
        phone: string | null;
        role: string;
        account_status: AccountStatus;
      }[];
      const vehicleRows = (vehiclesResult.data || []) as { agency_id: string }[];

      const nextAgencies = ((agenciesResult.data || []) as {
        id: string;
        name: string;
        plan: AgencyPlan | null;
        billing_status: BillingStatus | null;
        subscription_end_date: string | null;
        last_payment_date: string | null;
        next_payment_due_date: string | null;
        monthly_price: number | null;
        payment_method: PaymentMethod | null;
        payment_notes: string | null;
        created_at: string;
      }[]).map((agency) => {
        const owner =
          profiles.find((profile) => profile.agency_id === agency.id && profile.role === 'Admin') ||
          profiles.find((profile) => profile.agency_id === agency.id);

        return {
          id: agency.id,
          agencyName: agency.name,
          ownerName: owner?.full_name || 'Agency owner',
          email: owner?.email || 'No email',
          phone: owner?.phone || 'No phone',
          vehiclesCount: vehicleRows.filter((vehicle) => vehicle.agency_id === agency.id).length,
          plan: agency.plan || 'free',
          billingStatus: agency.billing_status || 'trial',
          subscriptionEndDate: agency.subscription_end_date,
          lastPaymentDate: agency.last_payment_date,
          nextPaymentDueDate: agency.next_payment_due_date,
          monthlyPrice: Number(agency.monthly_price ?? 0),
          accountStatus: owner?.account_status || 'pending',
          createdDate: agency.created_at,
          paymentMethod: agency.payment_method || 'other',
          paymentNotes: agency.payment_notes || '',
        };
      });

      setAgencies(nextAgencies);
      setNoteDrafts(
        Object.fromEntries(nextAgencies.map((agency) => [agency.id, agency.paymentNotes])),
      );
    } catch (error) {
      notify({
        title: 'Admin data not loaded',
        message: error instanceof Error ? error.message : 'Check super admin RLS policies.',
        type: 'warning',
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadAgencies();
  }, [loadAgencies]);

  const filteredAgencies = useMemo(() => {
    if (filter === 'all') return agencies;
    return agencies.filter((agency) => agency.accountStatus === filter || agency.billingStatus === filter);
  }, [agencies, filter]);

  async function updateAgencyRow(id: string, patch: Partial<AdminAgency>) {
    setAgencies((current) => current.map((agency) => (agency.id === id ? { ...agency, ...patch } : agency)));

    if (!supabase || !isSupabaseConfigured) return;

    const dbPatch: Record<string, unknown> = {};
    if (patch.plan) dbPatch.plan = patch.plan;
    if (patch.billingStatus) dbPatch.billing_status = patch.billingStatus;
    if (patch.subscriptionEndDate !== undefined) dbPatch.subscription_end_date = patch.subscriptionEndDate;
    if (patch.lastPaymentDate !== undefined) dbPatch.last_payment_date = patch.lastPaymentDate;
    if (patch.nextPaymentDueDate !== undefined) dbPatch.next_payment_due_date = patch.nextPaymentDueDate;
    if (patch.monthlyPrice !== undefined) dbPatch.monthly_price = patch.monthlyPrice;
    if (patch.paymentMethod) dbPatch.payment_method = patch.paymentMethod;
    if (patch.paymentNotes !== undefined) dbPatch.payment_notes = patch.paymentNotes;

    const { error } = await supabase.from('agencies').update(dbPatch).eq('id', id);
    if (error) throw error;
  }

  async function updateAccountStatus(id: string, status: AccountStatus) {
    setAgencies((current) =>
      current.map((agency) => (agency.id === id ? { ...agency, accountStatus: status } : agency)),
    );

    if (!supabase || !isSupabaseConfigured) return;

    const { error } = await supabase
      .from('users_profiles')
      .update({ account_status: status })
      .eq('agency_id', id)
      .eq('role', 'Admin');
    if (error) throw error;
  }

  async function safeAction(title: string, action: () => Promise<void>) {
    try {
      await action();
      notify({ title, message: 'Super admin action saved.', type: 'success' });
    } catch (error) {
      await loadAgencies();
      notify({
        title: 'Action failed',
        message: error instanceof Error ? error.message : 'Try again later.',
        type: 'warning',
      });
    }
  }

  if (!isSupabaseEnabled || !profile?.isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-6 text-white light:bg-carbon-50 light:text-carbon-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Hidden control room"
          title="Super Admin"
          description="Approve agencies, manage subscriptions, and monitor billing health across MekLoc."
          action={
            <Button
              variant="secondary"
              icon={<RefreshCw className="h-4 w-4" />}
              loading={loading}
              onClick={loadAgencies}
            >
              Refresh
            </Button>
          }
        />

        {!isSupabaseConfigured ? (
          <Card className="mb-5 p-4 text-sm text-gold-100 light:text-gold-800">
            Supabase env variables are missing, so this admin panel is showing mock fallback data.
          </Card>
        ) : null}

        <Card className="mb-5 p-4">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item}
                className={`focus-ring rounded-xl px-3 py-2 text-sm font-semibold capitalize transition ${
                  filter === item
                    ? 'bg-gold-400 text-carbon-950'
                    : 'border border-white/10 bg-white/[0.04] text-carbon-300 hover:bg-white/10 light:text-carbon-700'
                }`}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </Card>

        <div className="grid gap-5">
          {filteredAgencies.map((agency) => (
            <Card key={agency.id} className="overflow-hidden">
              <div className="grid gap-5 border-b border-white/10 p-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-white light:text-carbon-950">{agency.agencyName}</h2>
                    <Badge>{agency.accountStatus}</Badge>
                    <Badge>{agency.billingStatus}</Badge>
                    {agency.billingStatus === 'overdue' ? (
                      <span className="rounded-full border border-rose-300/30 bg-rose-400/15 px-2.5 py-1 text-xs font-bold text-rose-100 light:text-rose-700">
                        overdue
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-3 text-sm text-carbon-300 light:text-carbon-700 md:grid-cols-3">
                    <p><strong className="text-white light:text-carbon-950">Owner:</strong> {agency.ownerName}</p>
                    <p><strong className="text-white light:text-carbon-950">Email:</strong> {agency.email}</p>
                    <p><strong className="text-white light:text-carbon-950">Phone:</strong> {agency.phone}</p>
                    <p><strong className="text-white light:text-carbon-950">Vehicles:</strong> {agency.vehiclesCount}</p>
                    <p><strong className="text-white light:text-carbon-950">Created:</strong> {agency.createdDate.slice(0, 10)}</p>
                    <p><strong className="text-white light:text-carbon-950">Method:</strong> {agency.paymentMethod}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-xs uppercase tracking-wide text-carbon-500">Plan</p>
                    <p className="mt-1 text-lg font-black capitalize text-white light:text-carbon-950">{agency.plan}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-xs uppercase tracking-wide text-carbon-500">Monthly price</p>
                    <p className="mt-1 text-lg font-black text-white light:text-carbon-950">{formatMAD(agency.monthlyPrice)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-xs uppercase tracking-wide text-carbon-500">Last payment</p>
                    <p className="mt-1 text-sm font-bold text-white light:text-carbon-950">{agency.lastPaymentDate || 'None'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-xs uppercase tracking-wide text-carbon-500">Next due</p>
                    <p className="mt-1 text-sm font-bold text-white light:text-carbon-950">{agency.nextPaymentDueDate || 'Not set'}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 p-5 xl:grid-cols-[1fr_0.85fr]">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => safeAction('Agency approved', () => updateAccountStatus(agency.id, 'active'))}>Approve agency</Button>
                  <Button variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={() => safeAction('Agency rejected', () => updateAccountStatus(agency.id, 'rejected'))}>Reject agency</Button>
                  <Button variant="danger" icon={<ShieldAlert className="h-4 w-4" />} onClick={() => safeAction('Agency suspended', () => updateAccountStatus(agency.id, 'suspended'))}>Suspend agency</Button>
                  <Button icon={<Crown className="h-4 w-4" />} onClick={() => safeAction('Agency reactivated', () => updateAccountStatus(agency.id, 'active'))}>Reactivate agency</Button>
                  <Button variant="secondary" icon={<Banknote className="h-4 w-4" />} onClick={() => safeAction('Marked as paid', () => updateAgencyRow(agency.id, {
                    billingStatus: 'paid',
                    lastPaymentDate: new Date().toISOString().slice(0, 10),
                    nextPaymentDueDate: addDays(new Date().toISOString(), 30),
                    subscriptionEndDate: addDays(new Date().toISOString(), 30),
                  }))}>Mark as paid</Button>
                  <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />} onClick={() => safeAction('Marked as unpaid', () => updateAgencyRow(agency.id, { billingStatus: 'unpaid' }))}>Mark as unpaid</Button>
                  <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => safeAction('Subscription extended', () => updateAgencyRow(agency.id, {
                    nextPaymentDueDate: addDays(agency.nextPaymentDueDate, 30),
                    subscriptionEndDate: addDays(agency.subscriptionEndDate || agency.nextPaymentDueDate, 30),
                  }))}>Extend subscription</Button>
                </div>

                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm font-medium text-carbon-200 light:text-carbon-700">
                    <span>Change subscription plan</span>
                    <select
                      value={agency.plan}
                      className="focus-ring rounded-xl border border-white/10 bg-carbon-950/45 px-3 py-2.5 text-white light:bg-white light:text-carbon-950"
                      onChange={(event) => {
                        const plan = event.target.value as AgencyPlan;
                        safeAction('Subscription plan changed', () => updateAgencyRow(agency.id, {
                          plan,
                          monthlyPrice: planPrices[plan],
                        }));
                      }}
                    >
                      <option value="free">free</option>
                      <option value="pro">pro</option>
                      <option value="business">business</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-carbon-200 light:text-carbon-700">
                    <span>Payment notes</span>
                    <textarea
                      value={noteDrafts[agency.id] ?? agency.paymentNotes}
                      className="focus-ring min-h-20 rounded-xl border border-white/10 bg-carbon-950/45 px-3 py-2.5 text-white light:bg-white light:text-carbon-950"
                      onChange={(event) => setNoteDrafts((current) => ({ ...current, [agency.id]: event.target.value }))}
                    />
                  </label>
                  <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={() => safeAction('Payment notes saved', () => updateAgencyRow(agency.id, {
                    paymentNotes: noteDrafts[agency.id] ?? agency.paymentNotes,
                  }))}>
                    Add payment notes
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredAgencies.length === 0 ? (
          <Card className="mt-5 grid place-items-center p-10 text-center">
            <Filter className="mb-4 h-8 w-8 text-gold-300" />
            <p className="font-bold text-white light:text-carbon-950">No agencies match this filter.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
