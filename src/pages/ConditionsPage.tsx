import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';

export default function ConditionsPage() {
  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <Link to="/demande-acces" className="inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <Card className="mt-4 p-6 sm:p-8">
          <h1 className="text-3xl font-black">Conditions d’utilisation</h1>
          <p className="mt-2 text-sm text-carbon-400">Dernière mise à jour : 13 mai 2026 · Applicable immédiatement</p>
          <div className="mt-6 space-y-5 text-sm leading-7 text-carbon-200">
            <p>Les présentes conditions régissent l’accès et l’utilisation de MekLoc. En utilisant la plateforme, vous acceptez ces conditions.</p>
            <p><strong>1. Société</strong><br />MekLoc est une solution SaaS de gestion pour agences de location automobile.</p>
            <p><strong>2. Éligibilité</strong><br />Vous confirmez avoir au moins 18 ans et utiliser la plateforme à des fins professionnelles légales.</p>
            <p><strong>3. Compte et activation</strong><br />L’accès est activé après validation de votre demande et activation de votre compte.</p>
            <p><strong>4. Abonnements et facturation</strong><br />Plans mensuels ou annuels, prix affichés en MAD, facturation selon le plan actif.</p>
            <p><strong>5. Annulation</strong><br />Annulation possible avant renouvellement. Aucun remboursement partiel de période en cours sauf accord écrit.</p>
            <p><strong>6. Changement de plan</strong><br />Upgrade immédiat (prorata possible). Downgrade au prochain cycle.</p>
            <p><strong>7. Utilisation acceptable</strong><br />Interdiction d’usage frauduleux, illégal, rétro-ingénierie, ou injection de code malveillant.</p>
            <p><strong>8. Données client</strong><br />Vos données restent votre propriété. MekLoc y accède uniquement pour support avec nécessité opérationnelle.</p>
            <p><strong>9. Propriété intellectuelle</strong><br />Le logiciel, les interfaces et la marque MekLoc sont protégés.</p>
            <p><strong>10. Limitation de responsabilité</strong><br />Le service est fourni “en l’état”. La responsabilité est limitée aux montants payés selon la loi applicable.</p>
            <p><strong>11. Disponibilité</strong><br />Des maintenances peuvent avoir lieu. MekLoc s’engage à informer dans un délai raisonnable.</p>
            <p><strong>12. Résiliation</strong><br />MekLoc peut suspendre un compte en cas de non-respect des présentes conditions.</p>
            <p><strong>13. Modifications</strong><br />Les conditions peuvent évoluer. La date de mise à jour fera foi.</p>
            <p><strong>14. Droit applicable</strong><br />Tout litige sera traité prioritairement par voie amiable.</p>
            <p><strong>15. Contact</strong><br />Email : <a className="text-gold-200 hover:text-gold-100" href="mailto:younesmekki100@gmail.com">younesmekki100@gmail.com</a><br />WhatsApp : <a className="text-gold-200 hover:text-gold-100" href="https://wa.me/212762971653" target="_blank" rel="noreferrer">+212 762971653</a></p>
          </div>
        </Card>
      </div>
    </div>
  );
}

