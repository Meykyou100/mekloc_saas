import { ArrowRight, Clock3, LogOut, MessageCircle, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { SUPPORT_EMAIL, WHATSAPP_URL } from '../config/app';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getEffectiveSubscriptionStatus } from '../lib/subscription';

export default function PaymentRequiredPage() {
  const { profile, signOut } = useAuth();
  const { notify } = useApp();
  const navigate = useNavigate();
  const agency = profile?.agency;
  const status = getEffectiveSubscriptionStatus(agency);
  const isExpiredTrial = status === 'trial_expired';
  const whatsappMessage = `Bonjour MekLoc, mon essai gratuit est terminé.
Je souhaite activer mon abonnement.
Agence: ${agency?.name || profile?.email || 'Non renseignée'}
Email: ${profile?.email || agency?.email || 'Non renseigné'}
Plan: ${agency?.plan || 'Non renseigné'}
Prix: ${agency?.monthlyPrice || 0} MAD/mois
Merci.`;

  async function handleLogout() {
    await signOut();
    notify({ title: 'Déconnexion effectuée', type: 'info' });
    navigate('/auth', { replace: true });
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#050606] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(227,177,23,.14),transparent_32%)]" />
      <Card className="relative w-full max-w-2xl overflow-hidden border-[#E3B117]/25 p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,.55)] sm:p-10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-[#E3B117]/30 bg-[#E3B117]/10 text-[#F5C542]">
          {isExpiredTrial ? <Clock3 className="h-8 w-8" /> : <ShieldAlert className="h-8 w-8" />}
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-gold-300">MekLoc · Abonnement</p>
        <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">
          {isExpiredTrial ? 'Votre essai gratuit est terminé' : status === 'suspended' ? 'Votre accès est suspendu' : 'Activation de votre abonnement requise'}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-carbon-300 sm:text-lg">
          {isExpiredTrial
            ? `Les 7 jours d’essai de ${agency?.name || 'votre agence'} sont arrivés à échéance. Vos données sont conservées et seront disponibles dès la réactivation.`
            : 'Votre espace reste sécurisé, mais les fonctionnalités de gestion sont temporairement bloquées.'}
        </p>
        <div className="mt-6 rounded-2xl border border-[#E3B117]/20 bg-[#E3B117]/8 px-4 py-4 text-sm text-carbon-200">
          <strong className="text-[#F5C542]">{agency?.plan?.toUpperCase() || 'MEKLOC'}</strong>
          {' · '}
          {agency?.monthlyPrice ? `${agency.monthlyPrice} MAD` : 'Tarif selon votre plan'}
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent(whatsappMessage)}`}
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#E3B117] px-4 py-2 text-sm font-black text-carbon-950 transition hover:bg-[#F5C542]"
          >
            <MessageCircle className="h-4 w-4" /> Contacter MekLoc sur WhatsApp
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Réactivation MekLoc · ${agency?.name || 'Agence'}`)}`}
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-sm font-bold text-white transition hover:bg-white/[0.1]"
          >
            Demander la réactivation <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className="mt-3">
          <Button variant="secondary" icon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
            Retour à la connexion
          </Button>
        </div>
      </Card>
    </div>
  );
}
