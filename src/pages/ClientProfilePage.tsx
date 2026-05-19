import { ArrowLeft, BadgeCheck, Car, CreditCard, FileSignature, FileText, MapPin, Phone } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { formatMAD } from '../data/mockData';
import { useData } from '../context/DataContext';

export default function ClientProfilePage() {
  const { id } = useParams();
  const { clients, reservations, payments } = useData();
  const client = clients.find((item) => item.id === id);
  if (!client) {
    return (
      <div>
        <Link to="/clients" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200 light:text-carbon-700">
          <ArrowLeft className="h-4 w-4" />
          Retour aux clients
        </Link>
        <Card className="p-6 text-carbon-300 light:text-carbon-700">Aucun client trouvé.</Card>
      </div>
    );
  }
  const clientReservations = reservations.filter((reservation) => reservation.clientId === client.id);
  const clientPayments = payments.filter((payment) => payment.client === client.fullName);

  return (
    <div>
      <Link to="/clients" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200 light:text-carbon-700">
        <ArrowLeft className="h-4 w-4" />
        Retour aux clients
      </Link>
      <PageHeader
        eyebrow="Profil client"
        title={client.fullName}
        description={`${client.cin} · Permis ${client.license}`}
        action={<Button variant="secondary" icon={<FileSignature className="h-4 w-4" />}>Créer un contrat</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gold-400 text-2xl font-black text-carbon-950">
              {client.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('')}
            </div>
            <Badge>{client.status}</Badge>
          </div>
          <h2 className="mt-6 text-2xl font-black text-white light:text-carbon-950">{client.fullName}</h2>
          <div className="mt-6 grid gap-4 text-sm">
            <p className="flex items-center gap-3 text-carbon-300 light:text-carbon-700"><Phone className="h-4 w-4 text-gold-300" />{client.phone}</p>
            <p className="flex items-center gap-3 text-carbon-300 light:text-carbon-700"><MapPin className="h-4 w-4 text-gold-300" />{client.address}</p>
            <p className="flex items-center gap-3 text-carbon-300 light:text-carbon-700"><BadgeCheck className="h-4 w-4 text-gold-300" />{client.email}</p>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="premium-surface rounded-2xl p-4">
              <p className="text-xs text-carbon-500">Total locations</p>
              <p className="mt-1 text-2xl font-black text-white light:text-carbon-950">{client.totalRentals}</p>
            </div>
            <div className="premium-surface rounded-2xl p-4">
              <p className="text-xs text-carbon-500">Total dépensé</p>
              <p className="mt-1 text-2xl font-black text-white light:text-carbon-950">{formatMAD(client.totalSpent)}</p>
            </div>
          </div>
          <div className="premium-surface mt-6 rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gold-200" />
              <p className="font-semibold text-white light:text-carbon-950">Pièces d’identité</p>
            </div>
            {client.idCardFrontUrl || client.idCardBackUrl ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs text-carbon-500">Recto</p>
                  {client.idCardFrontUrl ? (
                    <>
                      <img src={client.idCardFrontUrl} alt="Pièce identité recto" className="h-28 w-full rounded-xl border border-white/10 object-cover" />
                      <a href={client.idCardFrontUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-gold-200 hover:text-gold-100">
                        Ouvrir l’image
                      </a>
                    </>
                  ) : <p className="text-sm text-amber-200">Document manquant</p>}
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-carbon-500">Verso</p>
                  {client.idCardBackUrl ? (
                    <>
                      <img src={client.idCardBackUrl} alt="Pièce identité verso" className="h-28 w-full rounded-xl border border-white/10 object-cover" />
                      <a href={client.idCardBackUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-gold-200 hover:text-gold-100">
                        Ouvrir l’image
                      </a>
                    </>
                  ) : <p className="text-sm text-amber-200">Document manquant</p>}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                Documents manquants: ajoutez le recto et le verso dans la fiche client.
              </div>
            )}
            <div className="mt-3 grid gap-2 text-sm text-carbon-400">
              <p className="flex justify-between">CIN / Passeport <span className="font-semibold text-carbon-200 light:text-carbon-800">{client.cin || 'Non renseigné'}</span></p>
              <p className="flex justify-between">Permis <span className="font-semibold text-carbon-200 light:text-carbon-800">{client.license || 'Non renseigné'}</span></p>
            </div>
          </div>
        </Card>

        <div className="grid gap-6">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Car className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Historique des locations</h2>
            </div>
            <div className="grid gap-3">
              {clientReservations.length ? clientReservations.map((reservation) => (
                <div key={reservation.id} className="premium-surface rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-white light:text-carbon-950">{reservation.vehicle}</p>
                      <p className="mt-1 text-sm text-carbon-400">{reservation.pickupDate} → {reservation.returnDate}</p>
                    </div>
                    <Badge>{reservation.status}</Badge>
                  </div>
                </div>
              )) : <p className="text-sm text-carbon-400">Aucune location liée à ce client pour le moment.</p>}
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Historique des paiements</h2>
            </div>
            <div className="grid gap-3">
              {clientPayments.length ? clientPayments.map((payment) => (
                <div key={payment.id} className="premium-surface flex items-center justify-between rounded-2xl p-4">
                  <div>
                    <p className="font-bold text-white light:text-carbon-950">{payment.invoice}</p>
                    <p className="text-sm text-carbon-400">{payment.method}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gold-200">{formatMAD(payment.amount)}</p>
                    <Badge>{payment.status}</Badge>
                  </div>
                </div>
              )) : <p className="text-sm text-carbon-400">Aucun paiement lié à ce client pour le moment.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
