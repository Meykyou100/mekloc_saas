import { Clock3, Mail, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { supabase } from '../lib/supabase';

function statusLabel(status: string) {
  if (status === 'pending' || status === 'pending_verification' || status === 'verified') return 'En cours de vérification';
  if (status === 'contacted') return 'Contact en cours';
  if (status === 'payment_pending') return 'Paiement en attente';
  return status || 'En cours de vérification';
}

export default function VerificationEnCoursPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';
  const fallbackAgency = searchParams.get('agency') || 'Agence';
  const fallbackPlan = searchParams.get('plan') || 'starter';
  const fallbackCreatedAt = searchParams.get('created_at') || '';
  const fallbackStatus = searchParams.get('status') || 'pending';
  const [agency, setAgency] = useState(fallbackAgency);
  const [plan, setPlan] = useState(fallbackPlan);
  const [createdAt, setCreatedAt] = useState(fallbackCreatedAt);
  const [status, setStatus] = useState(fallbackStatus);
  const formattedCreatedAt = createdAt
    ? new Date(createdAt).toLocaleString('fr-MA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    : 'Aujourd’hui';

  useEffect(() => {
    async function loadRequest() {
      if (!email) return navigate('/demande-acces', { replace: true });
      if (!supabase) return;
      const normalized = email.trim().toLowerCase();
      const { data, error } = await supabase
        .from('access_requests')
        .select('agency_name,selected_plan,created_at,status,email')
        .eq('email', normalized)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return;
      if (!data) {
        if (fallbackStatus === 'approved') {
          navigate(`/auth?email=${encodeURIComponent(normalized)}`, { replace: true });
        }
        return;
      }
      if (data.status === 'approved') {
        navigate(`/auth?email=${encodeURIComponent(normalized)}&approved=1`, { replace: true });
        return;
      }
      setAgency(data.agency_name || 'Agence');
      setPlan(data.selected_plan || 'starter');
      setCreatedAt(data.created_at || '');
      setStatus(data.status || 'pending');
    }
    loadRequest();
  }, [email, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-carbon-950 px-4 py-10 text-white">
      <Card className="w-full max-w-xl p-6 sm:p-8">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-gold-300/35 bg-gold-400/10 text-gold-200">
          <Mail className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-black">Votre compte est en cours de vérification</h1>
        <p className="mt-3 text-center text-sm text-carbon-300">Nous avons bien reçu votre demande d’accès. Notre équipe vérifie vos informations et vous contactera prochainement.</p>
        <p className="mt-2 text-center text-sm font-medium text-gold-100">Vous recevrez un email dès que votre compte sera validé.</p>
        <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-300">
          <p><strong className="text-white">Email:</strong> {email || '-'}</p>
          <p><strong className="text-white">Agence:</strong> {agency}</p>
          <p><strong className="text-white">Plan demandé:</strong> {plan}</p>
          <p><strong className="text-white">Statut:</strong> {statusLabel(status)}</p>
          <p><strong className="text-white">Date de demande:</strong> {formattedCreatedAt}</p>
        </div>
        <div className="mt-6 space-y-2">
          <div className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-gold-200" />Demande reçue</div>
          <div className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-gold-200" />Vérification en cours</div>
          <div className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-carbon-500" />Activation bientôt</div>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/auth" className="flex-1"><Button variant="secondary" className="w-full">Retour à la connexion</Button></Link>
          <Button className="flex-1" icon={<MessageCircle className="h-4 w-4" />} onClick={() => window.open('https://wa.me/212762971653', '_blank')}>Contacter MekLoc sur WhatsApp</Button>
        </div>
      </Card>
    </div>
  );
}
