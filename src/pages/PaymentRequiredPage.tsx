import { CreditCard, LogOut, ShieldAlert } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export default function PaymentRequiredPage() {
  const { profile, signOut } = useAuth();
  const { notify } = useApp();
  const billingStatus = profile?.agency?.billingStatus || 'unpaid';

  async function handleLogout() {
    await signOut();
    notify({ title: 'Logged out', message: 'You have been signed out of MekLoc.', type: 'info' });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-carbon-950 px-4 py-10 text-white light:bg-carbon-50 light:text-carbon-950">
      <Card className="w-full max-w-xl p-6 text-center sm:p-8">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-rose-400/10 text-rose-200">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-gold-300">Subscription</p>
        <h1 className="mt-3 text-3xl font-black text-white light:text-carbon-950">Payment required</h1>
        <p className="mt-4 text-lg leading-8 text-carbon-300 light:text-carbon-600">
          Your MekLoc subscription is {billingStatus}. Please contact MekLoc to reactivate dashboard access.
        </p>
        <div className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-100 light:text-rose-700">
          {billingStatus === 'overdue' ? 'Overdue badge' : 'Payment required badge'}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button icon={<CreditCard className="h-4 w-4" />}>Contact MekLoc</Button>
          <Button variant="secondary" icon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </Card>
    </div>
  );
}
