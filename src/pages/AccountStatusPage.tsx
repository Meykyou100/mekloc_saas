import { Clock3, LogOut, ShieldAlert } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const statusCopy = {
  pending: {
    title: 'Compte en attente',
    message: 'Votre compte est en attente d’approbation par MekLoc.',
  },
  rejected: {
    title: 'Demande refusée',
    message: 'Votre demande a été refusée.',
  },
  suspended: {
    title: 'Compte suspendu',
    message: 'Votre compte est suspendu. Contactez MekLoc.',
  },
  active: {
    title: 'Compte actif',
    message: 'Votre compte est actif.',
  },
};

export default function AccountStatusPage() {
  const { profile, signOut } = useAuth();
  const { notify } = useApp();
  const current = statusCopy[profile?.accountStatus || 'pending'];

  async function handleLogout() {
    await signOut();
    notify({ title: 'Déconnecté', message: 'Vous avez quitté votre session MekLoc.', type: 'info' });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-carbon-950 px-4 py-10 text-white light:bg-carbon-50 light:text-carbon-950">
      <Card className="w-full max-w-xl p-6 text-center sm:p-8">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gold-400/10 text-gold-200">
          {profile?.accountStatus === 'pending' ? <Clock3 className="h-8 w-8" /> : <ShieldAlert className="h-8 w-8" />}
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-gold-300">MekLoc</p>
        <h1 className="mt-3 text-3xl font-black text-white light:text-carbon-950">{current.title}</h1>
        <p className="mt-4 text-lg leading-8 text-carbon-300 light:text-carbon-600">{current.message}</p>
        <p className="mt-5 text-sm text-carbon-500">
          {profile?.agency?.name || profile?.email || 'Votre espace'} sera disponible dès validation.
        </p>
        <Button className="mt-8" variant="secondary" icon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
          Se déconnecter
        </Button>
      </Card>
    </div>
  );
}
