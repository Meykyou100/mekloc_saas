import { Banknote, CreditCard, Download, Filter, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { formatMAD, type PaymentStatus } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';

const paymentStatuses: Array<'All' | PaymentStatus> = ['All', 'Paid', 'Partial', 'Pending', 'Late'];

function paymentProgress(status: PaymentStatus) {
  if (status === 'Paid') return 100;
  if (status === 'Partial') return 55;
  return 0;
}

export default function PaymentsPage() {
  const [status, setStatus] = useState<'All' | PaymentStatus>('All');
  const { notify } = useApp();
  const { payments, updatePaymentStatus } = useData();
  const filteredPayments = useMemo(() => payments.filter((payment) => status === 'All' || payment.status === status), [status]);
  const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const paidRevenue = payments.filter((payment) => payment.status === 'Paid').reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Paiements"
        description="Suivez les factures, modes de paiement, soldes partiels, retards et revenus mensuels."
        action={<Button icon={<Download className="h-4 w-4" />} onClick={() => notify({ title: 'Factures exportées', message: 'Export démo effectué.', type: 'success' })}>Exporter les factures</Button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Tracked revenue" value={formatMAD(totalRevenue)} trend="From all invoice cards" icon={WalletCards} />
        <StatCard label="Collected" value={formatMAD(paidRevenue)} trend="Paid in full" icon={CreditCard} />
        <StatCard label="Open balance" value={formatMAD(totalRevenue - paidRevenue)} trend="Partial, pending, and late" icon={Banknote} />
      </div>

      <Card className="mt-6 p-4">
        <div className="flex flex-wrap gap-2">
          {paymentStatuses.map((item) => (
            <button
              key={item}
              className={`focus-ring rounded-xl px-3 py-2 text-sm font-semibold transition ${
                status === item ? 'bg-gold-400 text-carbon-950' : 'border border-white/10 bg-white/[0.04] text-carbon-300 hover:bg-white/10 light:text-carbon-700'
              }`}
              onClick={() => setStatus(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        {filteredPayments.map((payment) => (
          <Card key={payment.id} interactive className="p-5">
            <div className="flex items-start justify-between">
              <div className="premium-surface rounded-2xl p-3 text-carbon-200">
                {payment.method === 'Cash' ? <Banknote className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
              </div>
              <Badge>{payment.status}</Badge>
            </div>
            <p className="mt-5 text-sm text-carbon-400">{payment.invoice}</p>
            <h3 className="mt-1 text-lg font-black text-white light:text-carbon-950">{payment.client}</h3>
            <p className="mt-5 text-3xl font-black text-white light:text-carbon-950">{formatMAD(payment.amount)}</p>
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-xs font-semibold text-carbon-500">
                <span>Paid {formatMAD(Math.round(payment.amount * paymentProgress(payment.status) / 100))}</span>
                <span>Balance {formatMAD(payment.amount - Math.round(payment.amount * paymentProgress(payment.status) / 100))}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className={`h-2 rounded-full ${payment.status === 'Late' ? 'bg-rose-400' : payment.status === 'Partial' ? 'bg-gold-400' : 'bg-mint-400'}`}
                  style={{ width: `${paymentProgress(payment.status)}%` }}
                />
              </div>
            </div>
            <div className="premium-surface mt-5 rounded-2xl p-4 text-sm">
              <p className="flex items-center justify-between text-carbon-300 light:text-carbon-700">
                Method <span className="font-bold text-white light:text-carbon-950">{payment.method}</span>
              </p>
              <p className="mt-3 flex items-center justify-between text-carbon-300 light:text-carbon-700">
                Due date <span className="font-bold text-white light:text-carbon-950">{payment.dueDate}</span>
              </p>
            </div>
            <Button
              variant={payment.status === 'Paid' ? 'secondary' : 'primary'}
              className="mt-5 w-full"
              icon={<Filter className="h-4 w-4" />}
              onClick={async () => {
                try {
                  await updatePaymentStatus(payment.id, 'Paid');
                  notify({ title: 'Payment status updated', message: `${payment.invoice} is now marked as paid.`, type: 'success' });
                } catch (error) {
                  notify({
                    title: 'Payment not updated',
                    message: error instanceof Error ? error.message : 'Try again later.',
                    type: 'warning',
                  });
                }
              }}
            >
              {payment.status === 'Paid' ? 'View receipt' : 'Mark as paid'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
