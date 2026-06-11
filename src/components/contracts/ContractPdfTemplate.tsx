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
  activityLabel?: string;
  city?: string;
  whatsapp?: string;
  website?: string;
  contractHeaderText?: string;
  arabicActivityLabel?: string;
  footerNote?: string;
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

const conditions = [
  ['OBJET DU CONTRAT', 'Le présent contrat a pour objet la mise à disposition d’un véhicule automobile par l’Agence au profit du Locataire, aux conditions définies ci-dessous.'],
  ['CONDITIONS D’ÉLIGIBILITÉ', 'Le Locataire doit être titulaire d’un permis de conduire valide et présenter une pièce d’identité en cours de validité. L’Agence se réserve le droit de refuser toute location si les documents sont incomplets ou non conformes.'],
  ['PRISE EN CHARGE DU VÉHICULE', 'Le véhicule est remis en bon état de marche, propre et complet, conformément à l’état des lieux. Le kilométrage et le niveau de carburant sont consignés au départ. Tout dommage non mentionné sera imputé au Locataire au retour.'],
  ['UTILISATION DU VÉHICULE', 'Le véhicule est loué pour un usage normal et légal. Le Locataire s’engage à respecter le Code de la Route et à n’autoriser la conduite qu’aux personnes inscrites au contrat. La sous-location, le prêt à un tiers et toute utilisation dangereuse sont interdits.'],
  ['CARBURANT', 'Le véhicule est fourni avec le niveau de carburant indiqué au départ. Le Locataire s’engage à le restituer avec le même niveau. Toute différence pourra être facturée.'],
  ['KILOMÉTRAGE', 'Le kilométrage au départ et au retour est indiqué au contrat. Tout dépassement ou toute anomalie pourra être facturé selon les conditions de l’Agence.'],
  ['RETOUR DU VÉHICULE', 'Le véhicule doit être restitué à la date, à l’heure et au lieu convenus. Tout retard doit être signalé immédiatement et peut entraîner des frais supplémentaires.'],
  ['CAUTION ET PAIEMENT', 'Une caution peut être exigée au début de la location. Elle est restituée après retour du véhicule, déduction faite des montants restant dus, dommages, carburant, nettoyage, infractions ou accessoires manquants.'],
  ['ASSURANCES ET RESPONSABILITÉS', 'Le véhicule est couvert conformément aux conditions d’assurance de l’Agence et à la législation marocaine. La franchise et les exclusions restent à la charge du Locataire selon le cas.'],
  ['ACCIDENT OU SINISTRE', 'En cas d’accident ou de sinistre, le Locataire doit informer immédiatement les autorités et l’Agence, remplir les documents nécessaires et ne reconnaître aucune responsabilité sans accord de l’Agence.'],
  ['PANNE / ASSISTANCE', 'En cas de panne non imputable au Locataire, l’Agence organisera l’assistance. Aucune réparation engagée sans autorisation écrite préalable ne sera prise en charge.'],
  ['VOL DU VÉHICULE', 'En cas de vol, le Locataire doit déposer plainte immédiatement et remettre à l’Agence le récépissé, les documents et les clés disponibles.'],
  ['INFRACTIONS ET AMENDES', 'Le Locataire est seul responsable des infractions commises pendant la location. Les amendes et frais reçus après restitution lui seront transmis et pourront être majorés de frais de gestion.'],
  ['PROLONGATION / MODIFICATION', 'Toute prolongation ou modification de la durée, du lieu de retour ou du conducteur doit être validée par écrit par l’Agence avant l’échéance prévue.'],
  ['RÉSILIATION', 'L’Agence peut résilier le contrat en cas de violation des présentes conditions et procéder à la récupération du véhicule. Les jours prépayés non utilisés ne donnent lieu à aucun remboursement sauf accord écrit.'],
  ['FORCE MAJEURE', 'Aucune partie ne peut être tenue responsable d’un manquement résultant d’un cas de force majeure, notamment catastrophe naturelle, émeute ou décision gouvernementale.'],
  ['PROTECTION DES DONNÉES', 'Les informations collectées sont utilisées pour la gestion du contrat et peuvent être communiquées aux autorités en cas d’infraction ou de litige, conformément à la réglementation applicable.'],
  ['LITIGES ET JURIDICTION', 'Tout litige relatif au présent contrat sera soumis aux tribunaux compétents conformément à la législation marocaine. Le présent contrat est régi par le droit marocain.'],
] as const;

const personalizeCondition = (body: string, agencyName: string) =>
  body.split('l’Agence').join(agencyName).split('L’Agence').join(agencyName);

function text(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function agencyInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AG';
}

function LineField({
  label,
  value,
  className = '',
  suffix,
}: {
  label: string;
  value?: ReactNode;
  className?: string;
  suffix?: string;
}) {
  return (
    <div className={`rc-line-field ${className}`}>
      <span className="rc-line-label">{label}</span>
      <span className="rc-line-value">{value || ''}</span>
      {suffix ? <span className="rc-line-suffix">{suffix}</span> : null}
    </div>
  );
}

function BlackTitle({ children }: { children: ReactNode }) {
  return <div className="rc-black-title">{children}</div>;
}

function VehicleDamagePanel({ observations }: { observations?: string }) {
  return (
    <div className="rc-damage-panel">
      <img src="/contract-vehicle-damage-panel.png" alt="Schéma d’état du véhicule" />
      {observations ? <p>{observations}</p> : null}
    </div>
  );
}

function HeaderCars() {
  return (
    <div className="rc-header-cars" aria-hidden="true">
      <img src="/contract-header-dacia.jpeg" alt="" />
    </div>
  );
}

function AgencyBrand({
  agency,
  logoBroken,
  onLogoError,
  compact = false,
}: {
  agency: ContractPdfAgency;
  logoBroken: boolean;
  onLogoError?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`rc-brand${compact ? ' rc-brand-compact' : ''}`}>
      {agency.logoUrl && !logoBroken ? (
        <img
          src={agency.logoUrl}
          alt={`${agency.name || 'Agence'} logo`}
          className="rc-brand-logo"
          data-pdf-logo="agency"
          crossOrigin="anonymous"
          onError={onLogoError}
        />
      ) : (
        <div className="rc-brand-fallback">
          <span>{agencyInitials(agency.name)}</span>
          <strong>{text(agency.name) || 'AGENCE'}</strong>
        </div>
      )}
      {!compact ? (
        <div className="rc-brand-contact">
          <strong>{agency.activityLabel || 'LOCATION DE VOITURE'}</strong>
          <span>{[agency.address, agency.city].filter(Boolean).join(' · ') || 'Adresse non renseignée'}</span>
          <span>{[agency.phone, agency.whatsapp ? `WhatsApp ${agency.whatsapp}` : '', agency.email].filter(Boolean).join(' · ') || 'Contact non renseigné'}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function ContractPdfTemplate({ data, logoBroken = false, onLogoError, className = '' }: ContractPdfTemplateProps) {
  const { agency, reservation, client, secondDriver, vehicle, contract } = data;
  const agencyName = text(agency.name) || 'L’AGENCE';
  const leftConditions = conditions.slice(0, 8);
  const rightConditions = conditions.slice(8);
  const birthClient = [client.birthDate, client.birthPlace].filter(Boolean).join(' à ');
  const birthDriver = [secondDriver.birthDate, secondDriver.birthPlace].filter(Boolean).join(' à ');

  return (
    <div className={`contract-pdf-template ${className}`}>
      <style>{`
        .contract-pdf-template {
          width: 794px;
          color: #0a0a0a;
          font-family: "Arial Narrow", Arial, Helvetica, sans-serif;
          line-height: 1.15;
        }
        .rc-page {
          position: relative;
          width: 794px;
          height: 1123px;
          overflow: hidden;
          box-sizing: border-box;
          background: #fff;
          border: 1px solid #ddd;
          box-shadow: 0 18px 45px rgba(0,0,0,.16);
        }
        .rc-page + .rc-page { margin-top: 18px; }
        .rc-page-one { padding: 27px 32px 24px 56px; }
        .rc-top {
          display: grid;
          grid-template-columns: 300px 1fr;
          min-height: 174px;
          gap: 12px;
        }
        .rc-brand { min-width: 0; text-align: center; }
        .rc-brand-logo { display: block; width: auto; max-width: 270px; max-height: 100px; margin: 0 auto 4px; object-fit: contain; }
        .rc-brand-fallback { position: relative; padding-top: 21px; text-transform: uppercase; }
        .rc-brand-fallback::before {
          content: "";
          position: absolute;
          left: 32px;
          right: 32px;
          top: 5px;
          height: 31px;
          border-top: 4px solid #000;
          border-radius: 50% 50% 0 0;
          transform: skewX(-18deg);
        }
        .rc-brand-fallback span { position: relative; display: block; font-size: 34px; font-weight: 900; letter-spacing: .02em; }
        .rc-brand-fallback strong { position: relative; display: block; margin-top: -3px; font-size: 20px; }
        .rc-brand-contact { display: flex; flex-direction: column; gap: 3px; margin-top: 5px; font-size: 10.5px; font-weight: 700; }
        .rc-brand-contact strong { font-size: 14px; }
        .rc-header-right { position: relative; min-width: 0; }
        .rc-header-cars { height: 158px; overflow: hidden; }
        .rc-header-cars img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }
        .rc-contract-ref { position: absolute; left: 58px; top: 153px; font-size: 16px; font-weight: 900; letter-spacing: .16em; }
        .rc-main-title {
          height: 35px;
          margin: 2px 0 8px;
          border-radius: 6px;
          background: #050505;
          color: #fff;
          font-size: 22px;
          line-height: 35px;
          letter-spacing: .08em;
          text-align: center;
          text-transform: uppercase;
        }
        .rc-side-notice {
          position: absolute;
          left: 17px;
          top: 245px;
          height: 755px;
          writing-mode: vertical-rl;
          text-orientation: mixed;
          font-size: 9.5px;
          font-weight: 800;
          letter-spacing: .025em;
        }
        .rc-vehicle-area {
          display: grid;
          grid-template-columns: 64% 36%;
          gap: 8px;
          margin-bottom: 8px;
        }
        .rc-rounded-box {
          border: 1.8px solid #111;
          border-radius: 14px;
          padding: 10px 12px 9px;
          box-sizing: border-box;
        }
        .rc-rounded-box + .rc-rounded-box { margin-top: 9px; }
        .rc-line-field {
          display: grid;
          grid-template-columns: max-content minmax(0, 1fr) max-content;
          align-items: end;
          gap: 6px;
          min-height: 29px;
          font-size: 10.8px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .rc-line-label { white-space: nowrap; }
        .rc-line-value {
          min-width: 0;
          min-height: 17px;
          padding: 0 3px 2px;
          border-bottom: 1.2px dotted #333;
          font-size: 10px;
          font-weight: 700;
          text-transform: none;
          overflow-wrap: anywhere;
        }
        .rc-line-suffix { white-space: nowrap; }
        .rc-inline-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .rc-inline-2 .rc-line-field { grid-template-columns: max-content minmax(0, 1fr); }
        .rc-damage-panel {
          position: relative;
          height: 100%;
          min-height: 230px;
          overflow: hidden;
          background: #fff;
        }
        .rc-damage-panel img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center top;
        }
        .rc-damage-panel p {
          position: absolute;
          left: 7px;
          right: 7px;
          bottom: 14px;
          max-height: 42px;
          margin: 0;
          overflow: hidden;
          color: #222;
          font-size: 8px;
          font-weight: 700;
          line-height: 1.25;
        }
        .rc-black-title {
          height: 31px;
          border-radius: 5px 5px 0 0;
          background: #050505;
          color: #fff;
          font-size: 19px;
          line-height: 31px;
          letter-spacing: .04em;
          text-align: center;
          text-transform: uppercase;
        }
        .rc-person-box {
          border: 1.8px solid #111;
          border-top: 0;
          border-radius: 0 0 13px 13px;
          padding: 8px 11px 7px;
        }
        .rc-person-box .rc-line-field { min-height: 24px; font-size: 10.2px; }
        .rc-person-box .rc-line-value { font-size: 9.7px; }
        .rc-person-section { margin-bottom: 7px; }
        .rc-declaration { margin: 9px 7px 0; font-size: 10.4px; font-weight: 700; line-height: 1.4; }
        .rc-page-one-footer { position: absolute; right: 34px; bottom: 12px; color: #555; font-size: 7.5px; }
        .rc-page-two { padding: 39px 43px 25px; }
        .rc-terms-header {
          display: grid;
          grid-template-columns: 180px 1fr 73px;
          align-items: center;
          gap: 15px;
        }
        .rc-brand-compact .rc-brand-logo { max-width: 165px; max-height: 65px; margin: 0; }
        .rc-brand-compact .rc-brand-fallback span { font-size: 20px; }
        .rc-brand-compact .rc-brand-fallback strong { font-size: 12px; }
        .rc-terms-title {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: -.02em;
          text-align: center;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .rc-page-badge {
          border: 1px solid #222;
          padding: 6px 7px;
          font-size: 8.5px;
          font-weight: 900;
          text-align: center;
        }
        .rc-terms-rule { height: 1.5px; margin: 19px 0 16px; background: #222; }
        .rc-terms-cols {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .rc-terms-cols::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 1px;
          background: #c7c7c7;
        }
        .rc-term { margin-bottom: 11px; break-inside: avoid; }
        .rc-term-title {
          min-height: 22px;
          padding: 0 6px;
          background: #050505;
          color: #fff;
          font-size: 9.6px;
          font-weight: 900;
          line-height: 22px;
          letter-spacing: .03em;
          text-transform: uppercase;
        }
        .rc-term p {
          margin: 4px 3px 0;
          color: #111;
          font-size: 9.15px;
          line-height: 1.38;
          text-align: justify;
        }
        .rc-signature-panel {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 111px;
          margin-top: 9px;
          border: 1.5px solid #111;
          border-radius: 12px;
          overflow: hidden;
        }
        .rc-signature-side { padding: 9px 12px; font-size: 9px; }
        .rc-signature-side + .rc-signature-side { border-left: 1px solid #999; }
        .rc-signature-side strong { display: block; margin-bottom: 5px; font-size: 10px; text-transform: uppercase; }
        .rc-signature-line { display: inline-block; min-width: 130px; border-bottom: 1px solid #555; }
        .rc-terms-footer {
          margin-top: 8px;
          text-align: center;
          font-size: 8px;
          font-weight: 700;
          white-space: nowrap;
        }
      `}</style>

      <div className="rc-page rc-page-one contract-pdf-page" data-contract-page="1">
        <div className="rc-top">
          <AgencyBrand agency={agency} logoBroken={logoBroken} onLogoError={onLogoError} />
          <div className="rc-header-right">
            <HeaderCars />
          </div>
        </div>
        <div className="rc-contract-ref">N° {contract.reference}</div>
        <div className="rc-main-title">Contrat de location</div>
        <div className="rc-side-notice">
          Le locataire est le seul conducteur du véhicule et s’engage à ne pas céder à autrui à moins d’une stipulation sur le présent contrat.
        </div>

        <div className="rc-vehicle-area">
          <div>
            <div className="rc-rounded-box">
              <div className="rc-inline-2">
                <LineField label="Marque :" value={[vehicle.brand, vehicle.model].filter(Boolean).join(' ')} />
                <LineField label="N° immatriculation :" value={vehicle.plate ? <span dir="ltr">{vehicle.plate}</span> : ''} />
              </div>
              <LineField label="Lieu de livraison :" value={reservation.pickupLocation} />
              <LineField label="Lieu de reprise :" value={reservation.returnLocation} />
            </div>
            <div className="rc-rounded-box">
              <LineField label="Date et heure de départ :" value={[reservation.pickupDate, reservation.pickupTime].filter(Boolean).join(' à ')} suffix="H." />
              <LineField label="Date et heure de retour prévu :" value={[reservation.returnDate, reservation.returnTime].filter(Boolean).join(' à ')} suffix="H." />
              <LineField label="Durée location :" value={reservation.rentalDays} suffix="jours" />
              <LineField label="Date et heure de retour réel :" value={[reservation.actualReturnDate, reservation.actualReturnTime].filter(Boolean).join(' à ')} suffix="H." />
            </div>
          </div>
          <VehicleDamagePanel observations={vehicle.damageObservations || vehicle.observations} />
        </div>

        <div className="rc-person-section">
          <BlackTitle>Le locataire</BlackTitle>
          <div className="rc-person-box">
            <div className="rc-inline-2">
              <LineField label="Nom :" value={client.lastName || client.fullName} />
              <LineField label="Prénom :" value={client.firstName} />
            </div>
            <LineField label="Date et lieu de naissance :" value={birthClient} />
            <LineField label="Adresse au Maroc :" value={client.address} />
            <LineField label="" value="" className="rc-spacer-line" />
            <LineField label="Nationalité :" value={client.nationality} />
            <LineField label="Permis de conduire N° :" value={client.licenseNumber} />
            <div className="rc-inline-2">
              <LineField label="Délivré le :" value={client.licenseIssuedAt} />
              <LineField label="À :" value={client.licenseIssuedPlace} />
            </div>
            <LineField label="C.I.N & Passeport N° :" value={client.idNumber} />
            <div className="rc-inline-2">
              <LineField label="Délivré le :" value="" />
              <LineField label="Tél :" value={client.phone} />
            </div>
          </div>
        </div>

        <div className="rc-person-section">
          <BlackTitle>Chauffeur autorisé</BlackTitle>
          <div className="rc-person-box">
            <div className="rc-inline-2">
              <LineField label="Nom :" value={secondDriver.enabled ? secondDriver.lastName : ''} />
              <LineField label="Prénom :" value={secondDriver.enabled ? secondDriver.firstName : ''} />
            </div>
            <LineField label="Date et lieu de naissance :" value={secondDriver.enabled ? birthDriver : ''} />
            <LineField label="Adresse au Maroc :" value={secondDriver.enabled ? secondDriver.address : ''} />
            <LineField label="" value="" className="rc-spacer-line" />
            <LineField label="Nationalité :" value={secondDriver.enabled ? secondDriver.nationality : ''} />
            <LineField label="Permis de conduire N° :" value={secondDriver.enabled ? secondDriver.licenseNumber : ''} />
            <div className="rc-inline-2">
              <LineField label="Délivré le :" value={secondDriver.enabled ? secondDriver.licenseIssuedAt : ''} />
              <LineField label="À :" value={secondDriver.enabled ? secondDriver.licenseIssuedPlace : ''} />
            </div>
            <LineField label="C.I.N & Passeport N° :" value={secondDriver.enabled ? secondDriver.idNumber : ''} />
            <div className="rc-inline-2">
              <LineField label="Délivré le :" value="" />
              <LineField label="Tél :" value={secondDriver.enabled ? secondDriver.phone : ''} />
            </div>
          </div>
        </div>

        <p className="rc-declaration">
          Le locataire du véhicule {agencyName} déclare avoir pris connaissance des clauses stipulées ci-dessus et au verso du présent contrat, et avoir reçu un véhicule dont le compteur kilométrique et l’état ont été constatés.
        </p>
        <div className="rc-page-one-footer">Page 1 / 2 · {contract.date}</div>
      </div>

      <div className="rc-page rc-page-two contract-pdf-page" data-contract-page="2">
        <div className="rc-terms-header">
          <AgencyBrand agency={agency} logoBroken={logoBroken} onLogoError={onLogoError} compact />
          <div className="rc-terms-title">Conditions générales de location</div>
          <div className="rc-page-badge">PAGE 2 / 2</div>
        </div>
        <div className="rc-terms-rule" />

        <div className="rc-terms-cols">
          <div>
            {leftConditions.map(([title, body], index) => (
              <article className="rc-term" key={title}>
                <div className="rc-term-title">{index + 1}. {title}</div>
                <p>{personalizeCondition(body, agencyName)}</p>
              </article>
            ))}
          </div>
          <div>
            {rightConditions.map(([title, body], index) => (
              <article className="rc-term" key={title}>
                <div className="rc-term-title">{index + 9}. {title}</div>
                <p>{personalizeCondition(body, agencyName)}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rc-signature-panel">
          <div className="rc-signature-side">
            <strong>Signature du locataire</strong>
            Lu et approuvé
            <p>Date : <span className="rc-signature-line" /> &nbsp; Lieu : <span className="rc-signature-line" /></p>
            <p>Signature : <span className="rc-signature-line" style={{ minWidth: 250 }} /></p>
          </div>
          <div className="rc-signature-side">
            <strong>Cachet et signature de l’agence</strong>
            {agencyName}
          </div>
        </div>
        <div className="rc-terms-footer">
          {[agency.name, agency.address, agency.city, agency.phone, agency.whatsapp, agency.email, agency.website].filter(Boolean).join(' — ')}
          {agency.footerNote ? ` — ${agency.footerNote}` : ''}
        </div>
      </div>
    </div>
  );
}
