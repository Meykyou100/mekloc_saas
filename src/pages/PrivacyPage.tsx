import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, WHATSAPP_URL } from '../config/app';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <Link to="/demande-acces" className="inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <Card className="mt-4 p-6 sm:p-8">
          <h1 className="text-3xl font-black">Politique de confidentialité</h1>
          <p className="mt-2 text-sm text-carbon-400">Dernière mise à jour : 13 mai 2026 · Applicable immédiatement</p>
          <div className="mt-6 space-y-5 text-sm leading-7 text-carbon-200">
            <p>Chez MekLoc, nous protégeons vos données. Cette politique explique quelles données sont collectées, pourquoi, et comment elles sont sécurisées.</p>
            <p><strong>1. Données collectées</strong><br />Informations de compte, données d’utilisation, données techniques nécessaires à la sécurité et au fonctionnement du service.</p>
            <p><strong>2. Finalités</strong><br />Activation du compte, accès au service, support client, sécurité, amélioration continue.</p>
            <p><strong>3. Protection</strong><br />Transmission sécurisée (TLS), accès restreint, et hébergement cloud sécurisé.</p>
            <p><strong>4. Partage</strong><br />Aucune vente de données. Partage limité aux prestataires techniques nécessaires et obligations légales.</p>
            <p><strong>5. Cookies</strong><br />Cookies techniques et de performance uniquement.</p>
            <p><strong>6. Vos droits</strong><br />Accès, correction, suppression, export de vos données selon la réglementation applicable.</p>
            <p><strong>7. Conservation</strong><br />Les données sont conservées selon la durée nécessaire au service et aux obligations légales.</p>
            <p><strong>8. Contact</strong><br />Email : <a className="text-gold-200 hover:text-gold-100" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a><br />WhatsApp : <a className="text-gold-200 hover:text-gold-100" href={WHATSAPP_URL} target="_blank" rel="noreferrer">{SUPPORT_PHONE_DISPLAY}</a></p>
          </div>
        </Card>
      </div>
    </div>
  );
}
