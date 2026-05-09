import { Clock3, Mail, MessageCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function VerificationEnCoursPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const agency = searchParams.get('agency') || 'Agence';
  const plan = searchParams.get('plan') || 'starter';
  const createdAt = searchParams.get('created_at') || '';
  const note = searchParams.get('note') || '';

  return (
    <div className="grid min-h-screen place-items-center bg-carbon-950 px-4 py-10 text-white">
      <Card className="w-full max-w-xl p-6 sm:p-8">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-gold-300/35 bg-gold-400/10 text-gold-200">
          <Mail className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-black">Votre compte est en cours de vérification</h1>
        <p className="mt-3 text-center text-sm text-carbon-300">Nous avons bien reçu votre demande d’accès. Notre équipe vérifie vos informations et vous contactera prochainement.</p>
        {note ? <p className="mt-2 text-center text-sm text-gold-200">{note}</p> : null}
        <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-300">
          <p><strong className="text-white">Email:</strong> {email || '-'}</p>
          <p><strong className="text-white">Agence:</strong> {agency}</p>
          <p><strong className="text-white">Plan demandé:</strong> {plan}</p>
          <p><strong className="text-white">Statut:</strong> En vérification</p>
          <p><strong className="text-white">Date de demande:</strong> {createdAt ? createdAt.slice(0, 10) : '-'}</p>
        </div>
        <div className="mt-6 space-y-2">
          <div className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-gold-200" />Demande reçue</div>
          <div className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-gold-200" />Vérification</div>
          <div className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-carbon-500" />Activation</div>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/auth" className="flex-1"><Button variant="secondary" className="w-full">Retour à la connexion</Button></Link>
          <Button className="flex-1" icon={<MessageCircle className="h-4 w-4" />} onClick={() => window.open('https://wa.me/212762971653', '_blank')}>Contacter MekLoc sur WhatsApp</Button>
        </div>
      </Card>
    </div>
  );
}
