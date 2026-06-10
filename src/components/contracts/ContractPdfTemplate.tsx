import type { ReactNode } from 'react';

export type ContractPdfAgency = {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string | null;
  rc?: string;
  ifNumber?: string;
  ice?: string;
  cnss?: string;
};

export type ContractPdfReservation = {
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  actualReturnDate?: string;
  actualReturnTime?: string;
  rentalDays?: number;
  pickupLocation?: string;
  returnLocation?: string;
};

export type ContractPdfClient = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthPlace?: string;
  nationality?: string;
  address?: string;
  phone?: string;
  email?: string;
  idNumber?: string;
  licenseNumber?: string;
  licenseIssuedAt?: string;
  licenseIssuedPlace?: string;
  licenseExpiresAt?: string;
};

export type ContractPdfSecondDriver = {
  enabled: boolean;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthPlace?: string;
  nationality?: string;
  idNumber?: string;
  licenseNumber?: string;
  licenseIssuedAt?: string;
  licenseIssuedPlace?: string;
  licenseExpiresAt?: string;
  phone?: string;
  address?: string;
};

export type ContractPdfVehicle = {
  brand?: string;
  model?: string;
  plate?: string;
  mileageOut?: string | number;
  mileageReturn?: string | number;
  fuelOut?: string;
  fuelReturn?: string;
  observations?: string;
  damageObservations?: string;
  papers?: {
    registrationCard?: boolean;
    technicalInspection?: boolean;
    insurance?: boolean;
    vignette?: boolean;
    circulationAuthorization?: boolean;
    other?: boolean;
  };
};

export type ContractPdfPayment = {
  dailyPrice?: number;
  rentalDays?: number;
  totalAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  deposit?: number;
  method?: 'cash' | 'cheque' | 'card' | 'transfer' | string;
  status?: string;
};

export type ContractPdfContract = {
  reference: string;
  date: string;
};

export type ContractPdfData = {
  agency: ContractPdfAgency;
  reservation: ContractPdfReservation;
  client: ContractPdfClient;
  secondDriver: ContractPdfSecondDriver;
  vehicle: ContractPdfVehicle;
  payment: ContractPdfPayment;
  contract: ContractPdfContract;
};

type ContractPdfTemplateProps = {
  data: ContractPdfData;
  logoBroken?: boolean;
  onLogoError?: () => void;
  className?: string;
};

const blankLine = '................................';

const conditions = [
  ['OBJET DU CONTRAT', 'Le présent contrat a pour objet la mise à disposition d’un véhicule automobile par l’agence au profit du locataire, selon les informations indiquées au recto.'],
  ['CONDITIONS D’ÉLIGIBILITÉ', 'Le locataire doit présenter une pièce d’identité valide et un permis de conduire valide. L’agence peut refuser la location si les documents sont incomplets ou non conformes.'],
  ['PRISE EN CHARGE DU VÉHICULE', 'Le locataire reconnaît avoir reçu le véhicule en bon état apparent de fonctionnement, propre et conforme à l’état indiqué au recto.'],
  ['UTILISATION DU VÉHICULE', 'Le véhicule doit être utilisé de manière normale, responsable et conforme à la loi. Toute utilisation dangereuse, abusive, illégale, sous-location ou conduite par une personne non déclarée est interdite.'],
  ['CONDUCTEUR AUTORISÉ', 'Le véhicule ne peut être conduit que par le locataire ou par le conducteur autorisé mentionné dans le contrat.'],
  ['CARBURANT', 'Le véhicule doit être restitué avec le même niveau de carburant qu’au départ. Toute différence peut être facturée au locataire.'],
  ['KILOMÉTRAGE', 'Le kilométrage au départ et au retour est indiqué au contrat. Tout dépassement ou anomalie peut être facturé selon les conditions de l’agence.'],
  ['RETOUR DU VÉHICULE', 'Le véhicule doit être restitué à la date, à l’heure et au lieu convenus. Tout retard peut entraîner des frais supplémentaires.'],
  ['CAUTION ET PAIEMENT', 'La caution peut être utilisée pour couvrir les dommages, retards, carburant, nettoyage, contraventions, documents ou accessoires manquants, ou tout autre montant dû.'],
  ['ASSURANCE ET RESPONSABILITÉ', 'Le véhicule est couvert selon les conditions d’assurance de l’agence. La franchise et les exclusions restent à la charge du locataire selon le cas.'],
  ['ACCIDENT OU SINISTRE', 'En cas d’accident, panne, vol ou dommage, le locataire doit informer immédiatement l’agence et fournir les documents nécessaires.'],
  ['PANNE / ASSISTANCE', 'Aucune réparation ne doit être engagée sans l’accord préalable de l’agence.'],
  ['VOL DU VÉHICULE', 'En cas de vol, le locataire doit déposer plainte et remettre à l’agence tous les documents et clés disponibles.'],
  ['INFRACTIONS ET AMENDES', 'Les amendes, contraventions, frais de fourrière, péages ou infractions pendant la location sont à la charge du locataire.'],
  ['PROLONGATION / MODIFICATION', 'Toute prolongation ou modification doit être validée par l’agence avant l’échéance prévue.'],
  ['NETTOYAGE ET ACCESSOIRES', 'Le véhicule doit être rendu dans un état de propreté normal avec ses documents, clés et accessoires. Tout élément manquant ou détérioré peut être facturé.'],
  ['PROTECTION DES DONNÉES', 'Les données du locataire sont utilisées uniquement pour la gestion de la location et peuvent être communiquées aux autorités en cas d’infraction ou de litige.'],
  ['ACCEPTATION', 'La signature du contrat vaut acceptation complète des présentes conditions générales de location.'],
] as const;

function text(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function display(value: unknown) {
  return text(value) || blankLine;
}

function money(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return blankLine;
  return `${new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 2 }).format(value)} MAD`;
}

function agencyInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AG';
}

function Field({ label, value, className = '' }: { label: string; value?: ReactNode; className?: string }) {
  const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
  return (
    <div className={`cp-field ${className}`}>
      <span className="cp-field-label">{label}</span>
      <span className={`cp-field-value${hasValue ? '' : ' cp-field-empty'}`}>{hasValue ? value : blankLine}</span>
    </div>
  );
}

function Section({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`cp-section ${className}`}>
      <div className="cp-section-title">{title}</div>
      <div className="cp-section-body">{children}</div>
    </section>
  );
}

function Check({ checked, label }: { checked?: boolean; label: string }) {
  return (
    <span className="cp-check">
      <span className="cp-check-box">{checked ? '✓' : ''}</span>
      {label}
    </span>
  );
}

function CarView({ label, kind }: { label: string; kind: 'front' | 'rear' | 'side' | 'top' }) {
  const isSide = kind === 'side';
  const isTop = kind === 'top';
  return (
    <div className={`cp-car-view cp-car-${kind}`}>
      <svg viewBox="0 0 150 64" aria-hidden="true">
        {isSide ? (
          <>
            <path d="M17 43h116l-7-21-27-8H55l-24 9-14 20Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M48 22h56l18 17H31l17-17Z" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <circle cx="43" cy="45" r="8" fill="white" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="111" cy="45" r="8" fill="white" stroke="currentColor" strokeWidth="1.5" />
          </>
        ) : isTop ? (
          <>
            <rect x="48" y="5" width="54" height="54" rx="18" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="55" y="17" width="40" height="29" rx="9" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <path d="M55 23h40M55 41h40" fill="none" stroke="currentColor" strokeWidth="1" />
          </>
        ) : (
          <>
            <path d="M39 50h72l8-19-17-16H48L31 31l8 19Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M48 17h54l10 14H38l10-14Z" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <rect x="38" y="37" width="16" height="7" rx="2" fill="none" stroke="currentColor" />
            <rect x="96" y="37" width="16" height="7" rx="2" fill="none" stroke="currentColor" />
          </>
        )}
      </svg>
      <span>{label}</span>
    </div>
  );
}

function AgencyHeader({
  agency,
  contract,
  logoBroken,
  onLogoError,
  compact = false,
}: {
  agency: ContractPdfAgency;
  contract: ContractPdfContract;
  logoBroken: boolean;
  onLogoError?: () => void;
  compact?: boolean;
}) {
  const legal = [
    agency.ice ? `ICE ${agency.ice}` : '',
    agency.rc ? `RC ${agency.rc}` : '',
    agency.ifNumber ? `IF ${agency.ifNumber}` : '',
    agency.cnss ? `CNSS ${agency.cnss}` : '',
  ].filter(Boolean);
  return (
    <header className={`cp-header${compact ? ' cp-header-compact' : ''}`}>
      <div className="cp-agency">
        {agency.logoUrl && !logoBroken ? (
          <img
            src={agency.logoUrl}
            alt={`${agency.name || 'Agence'} logo`}
            className="cp-logo"
            data-pdf-logo="agency"
            crossOrigin="anonymous"
            onError={onLogoError}
          />
        ) : (
          <div className="cp-logo-fallback">{agencyInitials(agency.name)}</div>
        )}
        <div className="cp-agency-copy">
          <strong>{display(agency.name)}</strong>
          <span>{text(agency.address) || 'Adresse agence non renseignée'}</span>
          <span>{[agency.phone, agency.email].filter(Boolean).join(' · ') || 'Contact non renseigné'}</span>
          {legal.length ? <span>{legal.join(' · ')}</span> : null}
        </div>
      </div>
      <div className="cp-header-meta">
        <span>Contrat N° <strong>{display(contract.reference)}</strong></span>
        <span>Date <strong>{display(contract.date)}</strong></span>
      </div>
    </header>
  );
}

export default function ContractPdfTemplate({ data, logoBroken = false, onLogoError, className = '' }: ContractPdfTemplateProps) {
  const { agency, reservation, client, secondDriver, vehicle, payment, contract } = data;
  const remaining = typeof payment.remainingAmount === 'number'
    ? payment.remainingAmount
    : Math.max(0, (payment.totalAmount || 0) - (payment.paidAmount || 0));
  const firstConditions = conditions.slice(0, 9);
  const secondConditions = conditions.slice(9);

  return (
    <div className={`contract-pdf-template ${className}`}>
      <style>{`
        .contract-pdf-template {
          --cp-black: #111;
          --cp-gray: #555;
          --cp-line: #9b9b9b;
          width: 794px;
          color: var(--cp-black);
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10px;
          line-height: 1.25;
        }
        .cp-page {
          position: relative;
          width: 794px;
          height: 1123px;
          box-sizing: border-box;
          overflow: hidden;
          padding: 30px 34px 28px;
          background: #fff;
          border: 1px solid #ddd;
          box-shadow: 0 18px 45px rgba(0,0,0,.16);
        }
        .cp-page + .cp-page { margin-top: 18px; }
        .cp-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          min-height: 58px;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--cp-black);
        }
        .cp-header-compact { min-height: 48px; }
        .cp-agency { display: flex; min-width: 0; gap: 10px; }
        .cp-logo { width: auto; max-width: 72px; max-height: 48px; object-fit: contain; }
        .cp-logo-fallback {
          display: grid;
          width: 48px;
          height: 48px;
          flex: 0 0 auto;
          place-items: center;
          border: 2px solid var(--cp-black);
          font-size: 14px;
          font-weight: 900;
        }
        .cp-agency-copy { display: flex; min-width: 0; flex-direction: column; gap: 1px; }
        .cp-agency-copy strong { font-size: 16px; line-height: 1.05; text-transform: uppercase; }
        .cp-agency-copy span { color: var(--cp-gray); font-size: 8.4px; }
        .cp-header-meta { display: flex; flex-direction: column; gap: 5px; text-align: right; font-size: 9.5px; }
        .cp-document-title {
          margin: 8px 0 7px;
          padding: 7px 10px;
          background: var(--cp-black);
          color: #fff;
          text-align: center;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .cp-document-subtitle { display: block; margin-top: 2px; font-size: 8px; letter-spacing: .22em; }
        .cp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px; }
        .cp-grid-condition { display: grid; grid-template-columns: 1.36fr .84fr; gap: 6px; margin-bottom: 6px; }
        .cp-section { min-width: 0; border: 1px solid var(--cp-black); background: #fff; }
        .cp-section-title {
          padding: 4px 7px;
          background: var(--cp-black);
          color: #fff;
          font-size: 9.3px;
          font-weight: 900;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .cp-section-body { padding: 5px 7px; }
        .cp-field {
          display: grid;
          grid-template-columns: 103px minmax(0, 1fr);
          gap: 5px;
          align-items: start;
          min-height: 16px;
          margin-bottom: 1px;
          font-size: 8.8px;
        }
        .cp-field-label { color: var(--cp-gray); font-weight: 700; }
        .cp-field-value {
          min-width: 0;
          min-height: 14px;
          padding: 0 2px 1px;
          border-bottom: 1px dotted var(--cp-line);
          color: var(--cp-black);
          font-weight: 700;
          overflow-wrap: anywhere;
        }
        .cp-field-empty { color: #888; font-weight: 400; letter-spacing: .03em; }
        .cp-inline-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .cp-inline-2 .cp-field { grid-template-columns: 70px minmax(0, 1fr); }
        .cp-checks { display: flex; flex-wrap: wrap; gap: 4px 10px; }
        .cp-check { display: inline-flex; align-items: center; gap: 4px; font-size: 8.5px; color: var(--cp-gray); }
        .cp-check-box {
          display: inline-grid;
          width: 10px;
          height: 10px;
          place-items: center;
          border: 1px solid var(--cp-black);
          color: var(--cp-black);
          font-size: 8px;
          line-height: 1;
        }
        .cp-car-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
        }
        .cp-car-view {
          min-height: 48px;
          padding: 2px;
          border: 1px solid #bbb;
          color: #555;
          text-align: center;
          box-sizing: border-box;
        }
        .cp-car-side { grid-column: span 2; }
        .cp-car-view svg { display: block; width: 100%; height: 35px; }
        .cp-car-view span { display: block; margin-top: -1px; font-size: 7px; font-weight: 800; text-transform: uppercase; }
        .cp-observations {
          min-height: 31px;
          margin-top: 4px;
          padding: 4px;
          border: 1px dotted var(--cp-line);
          color: var(--cp-gray);
          font-size: 8.5px;
          overflow-wrap: anywhere;
        }
        .cp-payment-table { width: 100%; border-collapse: collapse; font-size: 8.8px; }
        .cp-payment-table td { padding: 3px 4px; border-bottom: 1px solid #ddd; }
        .cp-payment-table td:last-child { text-align: right; font-weight: 800; white-space: nowrap; }
        .cp-payment-table tr:last-child td { border-top: 1.5px solid var(--cp-black); border-bottom: 0; font-size: 9.4px; }
        .cp-payment-meta { margin-top: 5px; padding-top: 4px; border-top: 1px dotted var(--cp-line); }
        .cp-signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px; }
        .cp-signature {
          min-height: 70px;
          padding: 5px;
          border: 1px solid var(--cp-black);
          box-sizing: border-box;
        }
        .cp-signature strong { display: block; padding-bottom: 3px; border-bottom: 1px solid #ccc; font-size: 8.2px; text-transform: uppercase; }
        .cp-signature span { display: block; margin-top: 4px; color: var(--cp-gray); font-size: 8px; }
        .cp-acceptance { margin-top: 5px; text-align: center; color: var(--cp-gray); font-size: 7.8px; font-style: italic; }
        .cp-page-number { position: absolute; right: 34px; bottom: 15px; color: #777; font-size: 8px; }
        .cp-conditions-title {
          margin: 9px 0 8px;
          padding-bottom: 6px;
          border-bottom: 2px solid var(--cp-black);
          text-align: center;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .cp-conditions-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cp-condition { margin-bottom: 5px; break-inside: avoid; }
        .cp-condition-title {
          padding: 3px 5px;
          background: var(--cp-black);
          color: #fff;
          font-size: 7.6px;
          font-weight: 900;
          letter-spacing: .045em;
          text-transform: uppercase;
        }
        .cp-condition p { margin: 3px 2px 0; color: #333; font-size: 7.55px; line-height: 1.34; text-align: justify; }
        .cp-conditions-signatures {
          margin-top: 7px;
          padding-top: 6px;
          border-top: 2px solid var(--cp-black);
        }
        .cp-conditions-signatures > strong { display: block; margin-bottom: 5px; text-align: center; font-size: 9px; text-transform: uppercase; }
        .cp-conditions-signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .cp-conditions-signature {
          min-height: 72px;
          padding: 5px;
          border: 1px solid var(--cp-black);
          box-sizing: border-box;
          color: var(--cp-gray);
          font-size: 8px;
        }
        .cp-conditions-signature b { display: block; margin-bottom: 4px; color: var(--cp-black); text-transform: uppercase; }
      `}</style>

      <div className="cp-page contract-pdf-page" data-contract-page="1">
        <AgencyHeader agency={agency} contract={contract} logoBroken={logoBroken} onLogoError={onLogoError} />
        <div className="cp-document-title">
          Contrat de location
          <span className="cp-document-subtitle">Location de voiture · Rent car</span>
        </div>

        <div className="cp-grid-2">
          <Section title="Location">
            <div className="cp-inline-2">
              <Field label="Départ" value={[reservation.pickupDate, reservation.pickupTime].filter(Boolean).join(' à ')} />
              <Field label="Retour prévu" value={[reservation.returnDate, reservation.returnTime].filter(Boolean).join(' à ')} />
            </div>
            <div className="cp-inline-2">
              <Field label="Durée" value={reservation.rentalDays ? `${reservation.rentalDays} jour(s)` : ''} />
              <Field label="Retour réel" value={[reservation.actualReturnDate, reservation.actualReturnTime].filter(Boolean).join(' à ')} />
            </div>
            <Field label="Lieu de livraison / départ" value={reservation.pickupLocation} />
            <Field label="Lieu de reprise / retour" value={reservation.returnLocation} />
          </Section>

          <Section title="Véhicule">
            <div className="cp-inline-2">
              <Field label="Marque" value={vehicle.brand} />
              <Field label="Modèle" value={vehicle.model} />
            </div>
            <Field label="N° immatriculation" value={vehicle.plate ? <span dir="ltr">{vehicle.plate}</span> : ''} />
            <div className="cp-inline-2">
              <Field label="Km départ" value={vehicle.mileageOut} />
              <Field label="Km retour" value={vehicle.mileageReturn} />
            </div>
            <div className="cp-inline-2">
              <Field label="Carburant départ" value={vehicle.fuelOut} />
              <Field label="Carburant retour" value={vehicle.fuelReturn} />
            </div>
          </Section>
        </div>

        <div className="cp-grid-2">
          <Section title="Locataire">
            <Field label="Nom complet" value={client.fullName} />
            <div className="cp-inline-2">
              <Field label="Nom" value={client.lastName} />
              <Field label="Prénom" value={client.firstName} />
            </div>
            <div className="cp-inline-2">
              <Field label="Date de naissance" value={client.birthDate} />
              <Field label="Lieu de naissance" value={client.birthPlace} />
            </div>
            <Field label="Adresse au Maroc" value={client.address} />
            <div className="cp-inline-2">
              <Field label="Nationalité" value={client.nationality} />
              <Field label="Téléphone" value={client.phone} />
            </div>
            <div className="cp-inline-2">
              <Field label="CIN / Passeport" value={client.idNumber} />
              <Field label="Permis N°" value={client.licenseNumber} />
            </div>
            <div className="cp-inline-2">
              <Field label="Permis délivré le" value={client.licenseIssuedAt} />
              <Field label="Permis délivré à" value={client.licenseIssuedPlace} />
            </div>
            <Field label="Permis valable jusqu’au" value={client.licenseExpiresAt} />
          </Section>

          <Section title="Chauffeur autorisé / 2ème conducteur">
            <div className="cp-inline-2">
              <Field label="Nom" value={secondDriver.enabled ? secondDriver.lastName : ''} />
              <Field label="Prénom" value={secondDriver.enabled ? secondDriver.firstName : ''} />
            </div>
            <div className="cp-inline-2">
              <Field label="Date de naissance" value={secondDriver.enabled ? secondDriver.birthDate : ''} />
              <Field label="Lieu de naissance" value={secondDriver.enabled ? secondDriver.birthPlace : ''} />
            </div>
            <Field label="Adresse au Maroc" value={secondDriver.enabled ? secondDriver.address : ''} />
            <div className="cp-inline-2">
              <Field label="Nationalité" value={secondDriver.enabled ? secondDriver.nationality : ''} />
              <Field label="Téléphone" value={secondDriver.enabled ? secondDriver.phone : ''} />
            </div>
            <div className="cp-inline-2">
              <Field label="CIN / Passeport" value={secondDriver.enabled ? secondDriver.idNumber : ''} />
              <Field label="Permis N°" value={secondDriver.enabled ? secondDriver.licenseNumber : ''} />
            </div>
            <div className="cp-inline-2">
              <Field label="Délivré le" value={secondDriver.enabled ? secondDriver.licenseIssuedAt : ''} />
              <Field label="Délivré à" value={secondDriver.enabled ? secondDriver.licenseIssuedPlace : ''} />
            </div>
            <Field label="Valable jusqu’au" value={secondDriver.enabled ? secondDriver.licenseExpiresAt : ''} />
          </Section>
        </div>

        <div className="cp-grid-condition">
          <Section title="État du véhicule">
            <div className="cp-car-grid">
              <CarView label="Avant" kind="front" />
              <CarView label="Vue gauche" kind="side" />
              <CarView label="Arrière" kind="rear" />
              <CarView label="Vue droite" kind="side" />
              <CarView label="Dessus" kind="top" />
            </div>
            <div className="cp-observations">
              <strong>Observations / dommages :</strong> {text(vehicle.damageObservations) || text(vehicle.observations) || blankLine}
            </div>
          </Section>

          <div>
            <Section title="Paiement" className="cp-payment-section">
              <table className="cp-payment-table">
                <tbody>
                  <tr><td>Prix journalier</td><td>{money(payment.dailyPrice)}</td></tr>
                  <tr><td>Nombre de jours</td><td>{payment.rentalDays || reservation.rentalDays || blankLine}</td></tr>
                  <tr><td>Total location</td><td>{money(payment.totalAmount)}</td></tr>
                  <tr><td>Caution</td><td>{money(payment.deposit)}</td></tr>
                  <tr><td>Montant payé</td><td>{money(payment.paidAmount)}</td></tr>
                  <tr><td>Reste à payer</td><td>{money(remaining)}</td></tr>
                </tbody>
              </table>
              <div className="cp-payment-meta">
                <Field label="Mode de paiement" value={payment.method} />
                <Field label="Statut" value={payment.status} />
              </div>
            </Section>

            <Section title="Papiers du véhicule" className="cp-papers-section">
              <div className="cp-checks">
                <Check checked={vehicle.papers?.registrationCard} label="Carte grise" />
                <Check checked={vehicle.papers?.insurance} label="Assurance" />
                <Check checked={vehicle.papers?.technicalInspection} label="Visite technique" />
                <Check checked={vehicle.papers?.vignette} label="Vignette" />
                <Check checked={vehicle.papers?.circulationAuthorization} label="Autorisation de circulation" />
                <Check checked={vehicle.papers?.other} label="Autre" />
              </div>
            </Section>
          </div>
        </div>

        <div className="cp-signatures">
          <div className="cp-signature">
            <strong>Signature locataire</strong>
            <span>Lu et approuvé</span>
          </div>
          <div className="cp-signature">
            <strong>{secondDriver.enabled ? 'Signature chauffeur autorisé' : 'Chauffeur autorisé'}</strong>
            <span>{secondDriver.enabled ? 'Lu et approuvé' : 'Non applicable / signature libre'}</span>
          </div>
          <div className="cp-signature">
            <strong>Signature agence</strong>
            <span>{display(agency.name)}<br />Cachet et signature</span>
          </div>
        </div>
        <div className="cp-acceptance">La signature du présent contrat vaut lecture et acceptation des conditions générales figurant au verso.</div>
        <div className="cp-page-number">Page 1 / 2</div>
      </div>

      <div className="cp-page contract-pdf-page" data-contract-page="2">
        <AgencyHeader agency={agency} contract={contract} logoBroken={logoBroken} onLogoError={onLogoError} compact />
        <div className="cp-conditions-title">Conditions générales de location</div>

        <div className="cp-conditions-columns">
          <div>
            {firstConditions.map(([title, body], index) => (
              <article className="cp-condition" key={title}>
                <div className="cp-condition-title">{index + 1}. {title}</div>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <div>
            {secondConditions.map(([title, body], index) => (
              <article className="cp-condition" key={title}>
                <div className="cp-condition-title">{index + 10}. {title}</div>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="cp-conditions-signatures">
          <strong>Acceptation et signatures</strong>
          <div className="cp-conditions-signature-grid">
            <div className="cp-conditions-signature">
              <b>Signature du locataire</b>
              Date : ........................................<br />
              Lieu : ........................................<br />
              Signature :
            </div>
            <div className="cp-conditions-signature">
              <b>Cachet et signature de l’agence</b>
              {display(agency.name)}<br />
              Date : ........................................<br />
              Signature / cachet :
            </div>
          </div>
        </div>
        <div className="cp-page-number">Page 2 / 2</div>
      </div>
    </div>
  );
}
