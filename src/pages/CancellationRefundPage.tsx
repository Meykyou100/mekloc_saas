import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, WHATSAPP_URL } from '../config/app';

export default function CancellationRefundPage() {
  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <Link to="/demande-acces" className="inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <Card className="mt-4 p-6 sm:p-8">
          <h1 className="text-3xl font-black">Annulation & Remboursement</h1>
          <p className="mt-2 text-sm text-carbon-400">Dernière mise à jour : 2 avril 2026 · Applicable immédiatement</p>
          <div className="mt-6 space-y-5 text-sm leading-7 text-carbon-200">
            <p>
              Chez MekLoc, nous souhaitons que vous soyez entièrement satisfait de votre abonnement.
              Cette politique explique comment fonctionnent les annulations et les remboursements pour
              nos services. Veuillez la lire attentivement avant de souscrire.
            </p>

            <p>
              <strong>1. Activation du compte</strong><br />
              La création d&apos;un compte MekLoc ne nécessite aucune carte bancaire. L&apos;accès au service
              est activé après la sélection d&apos;un plan d&apos;abonnement et la confirmation du paiement.
            </p>

            <p>
              <strong>2. Politique d&apos;annulation</strong><br />
              Vous pouvez annuler votre abonnement à tout moment. Les annulations prennent effet avant
              la prochaine date de renouvellement. Si vous annulez après renouvellement, l&apos;annulation
              s&apos;appliquera à la période suivante.<br />
              Vous conservez l&apos;accès à la plateforme jusqu&apos;à la fin de la période payée en cours.<br />
              Pour annuler, contactez-nous à{' '}
              <a className="text-gold-200 hover:text-gold-100" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{' '}
              ou via WhatsApp au{' '}
              <a className="text-gold-200 hover:text-gold-100" href={WHATSAPP_URL} target="_blank" rel="noreferrer">{SUPPORT_PHONE_DISPLAY}</a>{' '}
              avant votre date de renouvellement.<br />
              Après demande d&apos;annulation, les abonnés peuvent exporter leurs données avant la fin d&apos;accès.
            </p>

            <p>
              <strong>3. Politique de remboursement</strong><br />
              Nous offrons une fenêtre de remboursement de 7 jours à compter de la date de chaque
              renouvellement. Les demandes soumises dans ce délai sont éligibles à un remboursement
              partiel selon la formule ci-dessous.
            </p>

            <p>
              <strong>Formule de remboursement partiel</strong><br />
              Montant remboursé = (Prix de l&apos;abonnement ÷ Nombre total de jours de la période) × Jours restants après la fenêtre de 7 jours
            </p>

            <p>
              Exemple — Plan Starter facturé 2 394 MAD pour 6 mois (180 jours) :<br />
              Tarif journalier : 2 394 ÷ 180 = 13,30 MAD/jour<br />
              Demande le jour 5 : facturation 5 × 13,30 = 66,50 MAD<br />
              Remboursement : 2 394 − 66,50 = 2 327,50 MAD<br />
              Les demandes soumises après 7 jours ne sont pas éligibles.
            </p>

            <p>
              <strong>4. Cas non remboursables</strong><br />
              Demandes soumises plus de 7 jours après renouvellement, périodes d&apos;essai gratuit, comptes
              suspendus pour violation des conditions d&apos;utilisation, et frais de services d&apos;intégration.
            </p>

            <p>
              <strong>5. Comment demander un remboursement</strong><br />
              Contactez-nous dans le délai de 7 jours :<br />
              Email :{' '}
              <a className="text-gold-200 hover:text-gold-100" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{' '}
              (indiquez l&apos;email de votre compte et la raison)<br />
              WhatsApp :{' '}
              <a className="text-gold-200 hover:text-gold-100" href={WHATSAPP_URL} target="_blank" rel="noreferrer">{SUPPORT_PHONE_DISPLAY}</a><br />
              Le traitement se fait sous 5 à 10 jours ouvrables via le mode de paiement d&apos;origine.
            </p>

            <p>
              <strong>6. Changement de plan</strong><br />
              Si vous passez à un plan supérieur ou inférieur en cours de cycle, la différence de prix
              sera appliquée à la prochaine date de renouvellement. Aucun crédit partiel n&apos;est appliqué
              en cours de cycle.
            </p>

            <p>
              <strong>7. Modifications de cette politique</strong><br />
              MekLoc peut mettre à jour cette politique à tout moment. Les modifications sont communiquées
              via la date de mise à jour affichée en haut de cette page.
            </p>

            <p>
              <strong>8. Contact</strong><br />
              Email : <a className="text-gold-200 hover:text-gold-100" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a><br />
              WhatsApp : <a className="text-gold-200 hover:text-gold-100" href={WHATSAPP_URL} target="_blank" rel="noreferrer">{SUPPORT_PHONE_DISPLAY}</a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
