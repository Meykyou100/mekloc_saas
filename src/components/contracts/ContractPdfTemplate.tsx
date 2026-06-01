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
  rentalDays?: number;
  pickupLocation?: string;
  returnLocation?: string;
  agentName?: string;
};

export type ContractPdfClient = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  nationality?: string;
  address?: string;
  phone?: string;
  email?: string;
  idNumber?: string;
  licenseNumber?: string;
  licenseIssuedAt?: string;
  licenseExpiresAt?: string;
};

export type ContractPdfSecondDriver = {
  enabled: boolean;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  nationality?: string;
  idNumber?: string;
  licenseNumber?: string;
  phone?: string;
  address?: string;
};

export type ContractPdfVehicle = {
  brand?: string;
  model?: string;
  plate?: string;
  mileageOut?: string | number;
  mileageReturn?: string | number;
  fuelLevel?: string;
  insuranceAllRisk?: boolean | null;
  franchise?: string | number;
  observations?: string;
  damageObservations?: string;
  papers?: {
    registrationCard?: boolean;
    technicalInspection?: boolean;
    insurance?: boolean;
    vignette?: boolean;
    circulationAuthorization?: boolean;
  };
};

export type ContractPdfPayment = {
  totalAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  deposit?: number;
  method?: 'cash' | 'cheque' | 'card' | 'transfer' | string;
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

const emptyLine = '........................';
const missingMark = '—';

function valueOrLine(value: unknown) {
  if (value === null || value === undefined) return emptyLine;
  const normalized = String(value).trim();
  return normalized || emptyLine;
}

function isBlankValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return !value.trim() || value.trim() === emptyLine;
  return false;
}

function agencyInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AG';
}

function optionalValue(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function formatMoney(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return emptyLine;
  return new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(value);
}

function checked(value?: boolean | null) {
  return value ? '☑' : '☐';
}

function paymentChecked(method: ContractPdfPayment['method'], target: string) {
  const normalized = String(method || '').toLowerCase();
  const aliases: Record<string, string[]> = {
    cash: ['cash', 'espèces', 'especes'],
    cheque: ['cheque', 'chèque', 'check'],
    card: ['card', 'carte', 'carte bancaire'],
    transfer: ['transfer', 'bank transfer', 'virement'],
  };
  return aliases[target]?.some((item) => normalized.includes(item)) ? '☑' : '☐';
}

function fullSecondDriverName(secondDriver: ContractPdfSecondDriver) {
  return [secondDriver.lastName, secondDriver.firstName].map(optionalValue).filter(Boolean).join(' ');
}

function FieldRow({
  label,
  value,
  unit,
  narrow = false,
}: {
  label: string;
  value?: ReactNode;
  unit?: string;
  narrow?: boolean;
}) {
  const missing = isBlankValue(value);
  return (
    <div className={`cp-field-row${narrow ? ' cp-field-row-narrow' : ''}`}>
      <span className={`cp-field-label${narrow ? ' cp-field-label-narrow' : ''}`}>{label}</span>
      <span className={`cp-field-value ${missing ? 'cp-field-value-empty' : 'cp-field-value-filled'}`}>{missing ? emptyLine : value}</span>
      {unit ? <span className="cp-field-unit">{unit}</span> : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  const missing = isBlankValue(value);
  return (
    <div className="cp-detail-row">
      <span className="cp-detail-label">{label}</span>
      <span className={`cp-detail-value ${missing ? 'cp-detail-value-empty' : ''}`}>{missing ? missingMark : value}</span>
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

function FuelTrack({ value }: { value?: string }) {
  const normalized = optionalValue(value).toLowerCase();
  const filledSegments = normalized.includes('plein') || normalized.includes('full') ? 8 : normalized.includes('1/2') || normalized.includes('demi') ? 4 : 0;
  return (
    <div className="cp-fuel-row">
      <span className="cp-field-label">Carburant :</span>
      <div className="cp-fuel-track">
        <span className="cp-fuel-label">E</span>
        {Array.from({ length: 8 }).map((_, index) => (
          <span key={index} className={`cp-fuel-seg${index < filledSegments ? ' cp-fuel-seg-filled' : ''}`} />
        ))}
        <span className="cp-fuel-label">F</span>
        {!normalized ? <span className="cp-fuel-text">Non renseigné</span> : null}
        {normalized && !filledSegments ? <span className="cp-fuel-text">{value}</span> : null}
      </div>
    </div>
  );
}

function CarDiagram() {
  return (
    <div className="cp-vehicle-diagram">
      <svg className="cp-vehicle-svg" viewBox="0 0 120 56" width="110" height="52" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="10" y="12" width="100" height="32" rx="10" ry="10" fill="none" stroke="#333" strokeWidth="1.5" />
        <rect x="32" y="14" width="56" height="28" rx="5" fill="none" stroke="#333" strokeWidth="1" />
        <rect x="10" y="10" width="14" height="9" rx="3" fill="none" stroke="#333" strokeWidth="1" />
        <rect x="96" y="10" width="14" height="9" rx="3" fill="none" stroke="#333" strokeWidth="1" />
        <rect x="10" y="37" width="14" height="9" rx="3" fill="none" stroke="#333" strokeWidth="1" />
        <rect x="96" y="37" width="14" height="9" rx="3" fill="none" stroke="#333" strokeWidth="1" />
        <text x="60" y="8" textAnchor="middle" fontSize="5" fill="#666">AVANT</text>
      </svg>
      <span className="cp-damage-note">Indiquer les dommages sur le schéma</span>
    </div>
  );
}

export default function ContractPdfTemplate({ data, logoBroken = false, onLogoError, className = '' }: ContractPdfTemplateProps) {
  const { agency, reservation, client, secondDriver, vehicle, payment, contract } = data;
  const secondDriverName = secondDriver.enabled ? fullSecondDriverName(secondDriver) : '';
  const agencyName = optionalValue(agency.name);
  const agencyContactLines = [
    optionalValue(agency.address),
    [agency.phone ? `Tél : ${agency.phone}` : '', agency.email ? `Email : ${agency.email}` : ''].filter(Boolean).join(' · '),
  ].filter(Boolean);
  const agencyLegalItems = [
    ['RC', agency.rc],
    ['IF', agency.ifNumber],
    ['ICE', agency.ice],
    ['CNSS', agency.cnss],
  ].map(([label, value]) => ({ label, value: optionalValue(value) })).filter((item) => item.value);
  const remainingAmount =
    typeof payment.remainingAmount === 'number'
      ? payment.remainingAmount
      : typeof payment.totalAmount === 'number' && typeof payment.paidAmount === 'number'
        ? Math.max(0, payment.totalAmount - payment.paidAmount)
        : undefined;

  return (
    <div className={`contract-pdf-template ${className}`}>
      <style>{`
        .contract-pdf-template {
          --cp-ink: #1c1b19;
          --cp-mid: #55514c;
          --cp-light: #88827a;
          --cp-line: #d8d3ca;
          --cp-paper: #fffdfa;
          width: 794px;
          color: var(--cp-ink);
          font-family: Arial, Helvetica, sans-serif;
          line-height: 1.28;
        }
        .cp-page {
          position: relative;
          width: 794px;
          height: 1123px;
          overflow: hidden;
          background: var(--cp-paper);
          padding: 42px;
          box-sizing: border-box;
          border: 1px solid #e6e0d7;
          box-shadow: 0 18px 45px rgba(0,0,0,.16);
        }
        .cp-page + .cp-page { margin-top: 18px; }
        .cp-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding-bottom: 11px;
          border-bottom: 2px solid var(--cp-ink);
        }
        .cp-logo-block {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-width: 0;
          flex: 1 1 auto;
        }
        .cp-logo-img {
          display: block;
          width: auto;
          max-width: 70px;
          max-height: 45px;
          object-fit: contain;
          flex: 0 0 auto;
        }
        .cp-logo-fallback {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border: 1px solid var(--cp-ink);
          font-weight: 800;
          font-size: 13px;
          letter-spacing: .02em;
          text-transform: uppercase;
        }
        .cp-agency-name {
          font-size: 17px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .04em;
          line-height: 1.1;
        }
        .cp-agency-sub, .cp-reg-row {
          color: var(--cp-mid);
          font-size: 9.6px;
          line-height: 1.45;
        }
        .cp-reg-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 3px 9px;
        }
        .cp-header-right {
          max-width: 300px;
          flex: 0 0 300px;
          text-align: right;
          padding-top: 2px;
        }
        .cp-title-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 10px 0 8px;
          padding: 8px 11px;
          background: var(--cp-ink);
          color: #fff;
          text-transform: uppercase;
          letter-spacing: .08em;
          font-size: 18.5px;
          font-weight: 800;
        }
        .cp-contract-meta {
          display: flex;
          gap: 14px;
          font-size: 10.4px;
          font-weight: 600;
          letter-spacing: .04em;
        }
        .cp-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
          margin-bottom: 7px;
        }
        .cp-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 7px;
          margin-top: 2px;
        }
        .cp-section {
          border: 1px solid var(--cp-line);
          background: #fff;
        }
        .cp-section-title {
          background: #f1eee9;
          border-bottom: 1px solid var(--cp-line);
          padding: 4px 7px;
          color: var(--cp-ink);
          font-size: 10.5px;
          font-weight: 800;
          letter-spacing: .11em;
          text-transform: uppercase;
        }
        .cp-section-body {
          padding: 6px 7px;
        }
        .cp-field-row {
          display: grid;
          grid-template-columns: 98px minmax(0, 1fr) auto;
          align-items: center;
          gap: 5px;
          min-height: 21px;
          margin-bottom: 2px;
          color: var(--cp-mid);
          font-size: 10.7px;
          line-height: 1;
        }
        .cp-field-row-narrow {
          grid-template-columns: 82px minmax(0, 1fr) auto;
        }
        .cp-field-label {
          display: flex;
          align-items: center;
          min-height: 18px;
          color: var(--cp-mid);
          font-weight: 700;
          line-height: 1;
          white-space: nowrap;
        }
        .cp-field-label-narrow { font-size: 9.7px; }
        .cp-field-value {
          display: block;
          position: relative;
          top: -1px;
          align-items: center;
          min-width: 0;
          min-height: 18px;
          box-sizing: border-box;
          color: var(--cp-ink);
          font-weight: 700;
          line-height: 18px;
          padding: 0 4px;
          overflow: visible;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .cp-field-value-empty {
          color: var(--cp-light);
          font-weight: 500;
          border-bottom: 1px dotted #999;
          background: transparent;
        }
        .cp-field-value-filled {
          border-bottom: 0;
          background: transparent;
          box-shadow: none;
        }
        .cp-detail-row {
          display: grid;
          grid-template-columns: 86px minmax(0, 1fr);
          gap: 6px;
          align-items: center;
          min-height: 20px;
          margin-bottom: 2px;
          color: var(--cp-mid);
          font-size: 9.8px;
          line-height: 1;
        }
        .cp-detail-label {
          display: flex;
          align-items: center;
          min-height: 18px;
          color: var(--cp-mid);
          font-weight: 800;
          line-height: 1;
          white-space: nowrap;
        }
        .cp-detail-value {
          display: block;
          position: relative;
          top: -1px;
          align-items: center;
          min-width: 0;
          min-height: 18px;
          box-sizing: border-box;
          padding: 0 4px;
          background: transparent;
          border-bottom: 0;
          box-shadow: none;
          overflow-wrap: anywhere;
          word-break: break-word;
          color: var(--cp-ink);
          font-weight: 700;
          line-height: 18px;
        }
        .cp-detail-value-empty {
          background: transparent;
          border-bottom: 1px dotted #bdb7ad;
          box-shadow: none;
          color: var(--cp-light);
          font-weight: 600;
        }
        .cp-field-unit {
          display: flex;
          align-items: center;
          min-height: 18px;
          color: var(--cp-light);
          font-size: 9.3px;
          line-height: 1;
        }
        .cp-field-inline-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .cp-stack {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cp-check-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px 8px;
        }
        .cp-check-row {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--cp-mid);
          font-size: 9.5px;
          font-weight: 600;
        }
        .cp-cb {
          color: var(--cp-ink);
          font-size: 10.5px;
          line-height: 1;
        }
        .cp-fuel-row {
          display: flex;
          align-items: center;
          gap: 5px;
          margin: 4px 0 2px;
        }
        .cp-fuel-track {
          display: flex;
          gap: 2px;
          align-items: center;
          min-width: 0;
        }
        .cp-fuel-label, .cp-fuel-text {
          color: var(--cp-light);
          font-size: 8.5px;
        }
        .cp-fuel-seg {
          width: 16px;
          height: 10px;
          border: 1px solid #999;
          box-sizing: border-box;
        }
        .cp-fuel-seg-filled {
          background: #1c1b19;
        }
        .cp-vehicle-diagram {
          position: relative;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          margin: 4px 0;
          border: 1px solid #ccc;
          background: #fafafa;
        }
        .cp-vehicle-svg { opacity: .35; }
        .cp-damage-note {
          position: absolute;
          right: 5px;
          bottom: 3px;
          color: var(--cp-light);
          font-size: 8.4px;
        }
        .cp-observation-box {
          width: 100%;
          min-height: 22px;
          border: 1px dotted #bbb;
          color: var(--cp-mid);
          font-size: 9.4px;
          padding: 3px;
          box-sizing: border-box;
        }
        .cp-payment-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.4px;
          line-height: 1.15;
        }
        .cp-payment-table td {
          height: 21px;
          padding: 4px 6px;
          border-bottom: 1px solid #e0ddd8;
          vertical-align: middle;
        }
        .cp-payment-table td:last-child {
          text-align: right;
          font-weight: 700;
          color: var(--cp-ink);
          white-space: nowrap;
        }
        .cp-payment-table tr.cp-total td {
          border-top: 1.5px solid var(--cp-ink);
          border-bottom: 0;
          font-weight: 800;
          font-size: 11.2px;
        }
        .cp-sig-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin-top: 8px;
        }
        .cp-sig-box {
          min-height: 78px;
          border: 1px solid #bbb;
          background: #fafafa;
          padding: 5px 6px;
          box-sizing: border-box;
        }
        .cp-sig-label {
          margin-bottom: 4px;
          padding-bottom: 3px;
          border-bottom: 1px solid #ddd;
          color: var(--cp-mid);
          font-size: 8.5px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .cp-sig-subtext {
          color: var(--cp-light);
          font-size: 8.4px;
          line-height: 1.55;
        }
        .cp-acceptance {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid #e0ddd8;
          color: var(--cp-mid);
          font-size: 9.2px;
          font-style: italic;
          text-align: center;
        }
        .cp-page-num {
          position: absolute;
          right: 42px;
          bottom: 23px;
          color: var(--cp-light);
          font-size: 9.2px;
          letter-spacing: .06em;
        }
        .cp-cg-header-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .cp-cg-logo-mini {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 4px 8px;
          border: 1.5px solid var(--cp-ink);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .cp-cg-logo-img {
          width: auto;
          max-width: 34px;
          max-height: 24px;
          object-fit: contain;
        }
        .cp-cg-title {
          margin-bottom: 12px;
          padding-bottom: 7px;
          border-bottom: 2px solid var(--cp-ink);
          color: var(--cp-ink);
          font-size: 24.5px;
          font-weight: 700;
          letter-spacing: .03em;
          text-align: center;
        }
        .cp-cg-cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .cp-cg-article {
          margin-bottom: 10px;
        }
        .cp-cg-article-title {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 5px;
          padding: 3px 6px;
          background: var(--cp-ink);
          color: #fff;
          font-size: 10.4px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .cp-cg-article-num {
          opacity: .75;
          font-size: 9px;
        }
        .cp-cg-article p,
        .cp-cg-article li {
          margin: 0 0 3px;
          color: var(--cp-mid);
          font-size: 9.15px;
          line-height: 1.52;
        }
        .cp-cg-article ul {
          margin: 2px 0 0;
          padding-left: 14px;
        }
        .cp-cg-sig-block {
          margin-top: 13px;
          padding-top: 9px;
          border-top: 2px solid var(--cp-ink);
        }
        .cp-cg-sig-title {
          margin-bottom: 7px;
          color: var(--cp-ink);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .12em;
          text-align: center;
          text-transform: uppercase;
        }
        .cp-cg-sig-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .cp-cg-sig-box {
          min-height: 64px;
          border: 1px solid #bbb;
          background: #fafafa;
          padding: 5px 6px;
          box-sizing: border-box;
        }
        .cp-cg-sig-lbl {
          margin-bottom: 3px;
          padding-bottom: 3px;
          border-bottom: 1px solid #e0ddd8;
          color: var(--cp-mid);
          font-size: 8.5px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .cp-cg-sig-sub {
          color: var(--cp-light);
          font-size: 8.4px;
          line-height: 1.55;
        }
      `}</style>

      <div className="cp-page contract-pdf-page" data-contract-page="1">
        <header className="cp-header">
          <div className="cp-logo-block">
            {agency.logoUrl && !logoBroken ? (
              <img
                src={agency.logoUrl}
                alt={`${agency.name || 'Agence'} logo`}
                className="cp-logo-img"
                data-pdf-logo="agency"
                crossOrigin="anonymous"
                onError={onLogoError}
              />
            ) : (
              <div className="cp-logo-fallback">{agencyInitials(agencyName)}</div>
            )}
            <div>
              <div className="cp-agency-name">{valueOrLine(agency.name)}</div>
              <div className="cp-agency-sub">
                {agencyContactLines.length ? (
                  agencyContactLines.map((line) => <div key={line}>{line}</div>)
                ) : (
                  <div>Informations agence non renseignées</div>
                )}
              </div>
            </div>
          </div>
          {agencyLegalItems.length ? (
            <div className="cp-header-right">
              <div className="cp-reg-row">
                {agencyLegalItems.map((item) => (
                  <span key={item.label}>{item.label} : {item.value}</span>
                ))}
              </div>
            </div>
          ) : null}
        </header>

        <div className="cp-title-bar">
          <span>Contrat de Location</span>
          <div className="cp-contract-meta">
            <span>N° {valueOrLine(contract.reference)}</span>
            <span>Date : {valueOrLine(contract.date)}</span>
          </div>
        </div>

        <div className="cp-grid-2">
          <Section title="Durée de location">
            <FieldRow label="Départ :" value={reservation.pickupDate} unit={reservation.pickupTime ? `à ${reservation.pickupTime}` : 'à ........'} />
            <FieldRow label="Retour :" value={reservation.returnDate} unit={reservation.returnTime ? `à ${reservation.returnTime}` : 'à ........'} />
            <FieldRow label="Durée :" value={reservation.rentalDays} unit="jour(s)" />
            <FieldRow label="Lieu de livraison :" value={reservation.pickupLocation} />
            <FieldRow label="Lieu de reprise :" value={reservation.returnLocation} />
          </Section>

          <Section title="Informations véhicule">
            <div className="cp-field-inline-2">
              <FieldRow label="Marque :" value={vehicle.brand} narrow />
              <FieldRow label="Modèle :" value={vehicle.model} narrow />
            </div>
            <FieldRow label="Immatriculation :" value={vehicle.plate ? <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{vehicle.plate}</span> : ''} />
            <div className="cp-field-inline-2">
              <FieldRow label="Km départ :" value={vehicle.mileageOut} narrow />
              <FieldRow label="Km retour :" value={vehicle.mileageReturn} narrow />
            </div>
            <FuelTrack value={vehicle.fuelLevel} />
            <FieldRow label="Agent commercial :" value={reservation.agentName} />
          </Section>
        </div>

        <div className="cp-grid-2">
          <Section title="Informations locataire">
            <FieldRow label="Nom complet :" value={client.fullName} />
            <div className="cp-field-inline-2">
              <FieldRow label="Date naissance :" value={client.birthDate} narrow />
              <FieldRow label="Nationalité :" value={client.nationality} narrow />
            </div>
            <FieldRow label="Adresse :" value={client.address} />
            <div className="cp-field-inline-2">
              <FieldRow label="Téléphone :" value={client.phone} narrow />
              <FieldRow label="CIN / Passeport :" value={client.idNumber} narrow />
            </div>
            <FieldRow label="Permis N° :" value={client.licenseNumber} />
            <div className="cp-field-inline-2">
              <FieldRow label="Délivré le :" value={client.licenseIssuedAt} narrow />
              <FieldRow label="Valable jusqu'au :" value={client.licenseExpiresAt} narrow />
            </div>
          </Section>

          <div className="cp-stack">
            <Section title="2ème conducteur">
              <DetailRow label="Nom complet :" value={secondDriverName} />
              <DetailRow label="CIN / Passeport :" value={secondDriver.idNumber} />
              <DetailRow label="Téléphone :" value={secondDriver.phone} />
              <DetailRow label="Permis N° :" value={secondDriver.licenseNumber} />
              <DetailRow label="Naissance :" value={secondDriver.birthDate} />
              <DetailRow label="Nationalité :" value={secondDriver.nationality} />
            </Section>
            <Section title="Papiers du véhicule">
              <div className="cp-check-grid">
                <div className="cp-check-row"><span className="cp-cb">{checked(vehicle.papers?.registrationCard)}</span> Carte grise</div>
                <div className="cp-check-row"><span className="cp-cb">{checked(vehicle.papers?.technicalInspection)}</span> Visite technique</div>
                <div className="cp-check-row"><span className="cp-cb">{checked(vehicle.papers?.insurance)}</span> Assurance</div>
                <div className="cp-check-row"><span className="cp-cb">{checked(vehicle.papers?.vignette)}</span> Vignette</div>
                <div className="cp-check-row" style={{ gridColumn: 'span 2' }}><span className="cp-cb">{checked(vehicle.papers?.circulationAuthorization)}</span> Autorisation de circulation</div>
              </div>
            </Section>
          </div>
        </div>

        <div className="cp-grid-3">
          <Section title="Assurance & franchise">
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: 'var(--cp-mid)', marginBottom: 3, fontWeight: 700 }}>Assurance tous risques :</div>
              <div style={{ display: 'flex', gap: 14 }}>
                <div className="cp-check-row"><span className="cp-cb">{checked(vehicle.insuranceAllRisk === true)}</span> Oui</div>
                <div className="cp-check-row"><span className="cp-cb">{checked(vehicle.insuranceAllRisk === false)}</span> Non</div>
              </div>
            </div>
            <FieldRow label="Franchise :" value={vehicle.franchise} unit="DH" narrow />
            <div style={{ fontSize: 9, color: 'var(--cp-mid)', margin: '4px 0 2px', fontWeight: 700 }}>Observations :</div>
            <div className="cp-observation-box">{optionalValue(vehicle.observations)}</div>
          </Section>

          <Section title="État du véhicule">
            <CarDiagram />
            <div style={{ fontSize: 8.5, color: 'var(--cp-mid)', marginTop: 3 }}>
              Observations :
              <div className="cp-observation-box" style={{ minHeight: 17, marginTop: 2 }}>{optionalValue(vehicle.damageObservations)}</div>
            </div>
          </Section>

          <Section title="Paiement">
            <table className="cp-payment-table">
              <tbody>
                <tr>
                  <td>Total général</td>
                  <td>{formatMoney(payment.totalAmount)} DH</td>
                </tr>
                <tr>
                  <td>Caution</td>
                  <td>{formatMoney(payment.deposit)} DH</td>
                </tr>
                <tr>
                  <td>Montant payé</td>
                  <td>{formatMoney(payment.paidAmount)} DH</td>
                </tr>
                <tr className="cp-total">
                  <td>Reste à payer</td>
                  <td>{formatMoney(remainingAmount)} DH</td>
                </tr>
              </tbody>
            </table>
            <div style={{ fontSize: 8.5, color: 'var(--cp-mid)', fontWeight: 800, margin: '5px 0 3px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Mode de règlement :</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px' }}>
              <div className="cp-check-row"><span className="cp-cb">{paymentChecked(payment.method, 'cash')}</span> Espèces</div>
              <div className="cp-check-row"><span className="cp-cb">{paymentChecked(payment.method, 'cheque')}</span> Chèque</div>
              <div className="cp-check-row"><span className="cp-cb">{paymentChecked(payment.method, 'card')}</span> Carte bancaire</div>
              <div className="cp-check-row"><span className="cp-cb">{paymentChecked(payment.method, 'transfer')}</span> Virement</div>
            </div>
          </Section>
        </div>

        <div className="cp-sig-grid">
          <div className="cp-sig-box">
            <div className="cp-sig-label">Le locataire</div>
            <div className="cp-sig-subtext">Lu et approuvé</div>
          </div>
          <div className="cp-sig-box">
            <div className="cp-sig-label">2ème conducteur</div>
            <div className="cp-sig-subtext">Lu et approuvé</div>
          </div>
          <div className="cp-sig-box">
            <div className="cp-sig-label">Le loueur / Agence</div>
            <div className="cp-sig-subtext">{valueOrLine(agency.name)}</div>
          </div>
          <div className="cp-sig-box">
            <div className="cp-sig-label">Signature & date de retour</div>
            <div className="cp-sig-subtext">Date : .........................<br />Heure : ......................<br />Lieu : ..........................</div>
          </div>
        </div>

        <div className="cp-acceptance">
          J'ai lu et accepté les conditions générales de location figurant au verso du présent contrat. Le locataire est seul responsable des infractions au code de la route commises durant la période de location.
        </div>
        <div className="cp-page-num">Page 1 / 2</div>
      </div>

      <div className="cp-page contract-pdf-page" data-contract-page="2">
        <div className="cp-cg-header-strip">
          <div className="cp-cg-logo-mini">
            {agency.logoUrl && !logoBroken ? (
              <img
                src={agency.logoUrl}
                alt={`${agency.name || 'Agence'} logo`}
                className="cp-cg-logo-img"
                data-pdf-logo="agency"
                crossOrigin="anonymous"
                onError={onLogoError}
              />
            ) : null}
            {valueOrLine(agency.name)}
          </div>
          <div style={{ color: 'var(--cp-light)', fontSize: 9, lineHeight: 1.7, textAlign: 'right' }}>
            Réf. contrat N° {valueOrLine(contract.reference)}<br />
            Date : {valueOrLine(contract.date)}
          </div>
        </div>

        <div className="cp-cg-title">Conditions Générales de Location</div>

        <div className="cp-cg-cols">
          <div>
            <div className="cp-cg-article">
              <div className="cp-cg-article-title"><span className="cp-cg-article-num">ART. 1</span> État du véhicule, usage et réparations</div>
              <p>Le locataire déclare avoir pris connaissance du véhicule et constate son bon état général. Il s'engage à le restituer dans un état propre, à l'intérieur comme à l'extérieur, à défaut de quoi les frais de nettoyage lui seront facturés.</p>
              <p>Les pneumatiques du véhicule sont réputés en bon état à la remise des clés. Toute détérioration anormale sera à la charge du locataire, qui devra les remplacer par des pneus de même dimension et marque.</p>
              <p>Les réparations mécaniques résultant d'une utilisation normale sont à la charge de l'agence. Toute réparation résultant d'une négligence, d'un mauvais usage ou d'un impact anormal est à la charge exclusive du locataire.</p>
              <p>Le locataire ne peut prétendre à aucune indemnisation pour retard de remise ou immobilisation du véhicule due à un incident imprévu en cours de location.</p>
              <p>Le véhicule ne peut être utilisé pour :</p>
              <ul>
                <li>Transport de marchandises illicites ou de passagers à titre lucratif</li>
                <li>Remorquage ou dépannage d'autres véhicules</li>
                <li>Compétitions sportives ou circuits</li>
                <li>Terrains inadaptés à la nature du véhicule</li>
                <li>Sortie du territoire national sans accord écrit préalable de l'agence</li>
              </ul>
            </div>

            <div className="cp-cg-article">
              <div className="cp-cg-article-title"><span className="cp-cg-article-num">ART. 2</span> Assurance, accident, vol et responsabilité</div>
              <p>Le véhicule bénéficie d'une couverture assurance comprenant : responsabilité civile, vol, incendie, dommages collision, personnes transportées et défense-recours, conformément aux polices souscrites par l'agence de location.</p>
              <p>En cas d'accident, le locataire s'engage à déclarer immédiatement l'incident à l'agence, fournir un constat amiable signé et, le cas échéant, un rapport des autorités compétentes.</p>
              <p>La franchise contractuelle reste à la charge du locataire, ainsi que les frais d'immobilisation du véhicule pendant la durée des réparations. Les effets personnels et accessoires ne sont pas couverts par l'assurance.</p>
              <p>Le nombre de passagers ne doit pas dépasser la capacité indiquée sur la police d'assurance du véhicule.</p>
            </div>

            <div className="cp-cg-article">
              <div className="cp-cg-article-title"><span className="cp-cg-article-num">ART. 3</span> Paiement, durée et prolongation</div>
              <p>Le montant de la location est payable d'avance. Toute journée commencée est intégralement due.</p>
              <p>Toute prolongation doit faire l'objet d'un accord écrit de l'agence de location, accompagné du règlement correspondant. À défaut de restitution dans les 48 heures suivant l'échéance du contrat, le locataire s'expose à des poursuites pénales pour détournement de véhicule, conformément aux articles 505 et 547 du Code Pénal marocain.</p>
              <p>L'agence se réserve le droit de récupérer le véhicule sans préavis par voie d'huissier de justice. Toute contestation devra être notifiée par e-mail ou lettre recommandée avec accusé de réception.</p>
            </div>
          </div>

          <div>
            <div className="cp-cg-article">
              <div className="cp-cg-article-title"><span className="cp-cg-article-num">ART. 4</span> Restitution du véhicule, documents et clés</div>
              <p>Le véhicule doit être restitué au siège de l'agence de location, accompagné de l'ensemble des documents de bord et des clés. Toute pièce manquante entraîne la facturation du contrat jusqu'à récupération ou reconstitution du document.</p>
              <p>En cas de perte de clé, le locataire devra signer un engagement de remboursement et prendre en charge les frais de duplication ou de remplacement du système de démarrage.</p>
              <p>Le locataire s'engage à ne laisser conduire le véhicule qu'à lui-même ou aux conducteurs expressément autorisés par écrit par l'agence.</p>
            </div>

            <div className="cp-cg-article">
              <div className="cp-cg-article-title"><span className="cp-cg-article-num">ART. 5</span> Conducteur autorisé</div>
              <p>Seuls les conducteurs expressément mentionnés sur le présent contrat sont habilités à conduire le véhicule loué. Tout conducteur doit être titulaire d'un permis de conduire valide correspondant à la catégorie du véhicule.</p>
              <p>Le locataire ne peut réclamer aucun remboursement pour une durée de location non consommée, sauf accord écrit de l'agence.</p>
            </div>

            <div className="cp-cg-article">
              <div className="cp-cg-article-title"><span className="cp-cg-article-num">ART. 6</span> Contraventions, radar et infractions</div>
              <p>Le locataire reconnaît être seul responsable de toute infraction au code de la route commise durant la période de location, qu'elle soit constatée en temps réel ou ultérieurement par contrôle automatisé. Les frais d'amende, de traitement administratif et les pénalités éventuelles seront facturés au locataire.</p>
            </div>

            <div className="cp-cg-article">
              <div className="cp-cg-article-title"><span className="cp-cg-article-num">ART. 7</span> GPS / Suivi du véhicule</div>
              <p>L'ensemble des véhicules de l'agence est équipé d'un traceur GPS permettant la localisation en cas de sinistre, de vol ou d'urgence, ainsi que le suivi de l'entretien préventif. Le locataire déclare en avoir été informé et y consent expressément.</p>
            </div>

            <div className="cp-cg-article">
              <div className="cp-cg-article-title"><span className="cp-cg-article-num">ART. 8</span> Litiges et juridiction</div>
              <p>En cas de litige, et à défaut de règlement amiable, les parties conviennent de soumettre le différend aux tribunaux compétents du lieu de situation de l'agence de location, ou, à l'initiative de l'agence, aux tribunaux du lieu de résidence du locataire.</p>
              <p>Le non-respect de l'une des clauses du présent contrat autorise l'agence de location à récupérer le véhicule sans préavis et à engager toute action en justice appropriée.</p>
            </div>
          </div>
        </div>

        <div className="cp-cg-sig-block">
          <div className="cp-cg-sig-title">Article 9 — Signature du locataire</div>
          <div style={{ color: 'var(--cp-mid)', fontSize: 9.5, marginBottom: 8, textAlign: 'center' }}>
            En signant ce document, le locataire déclare avoir lu, compris et accepté l'intégralité des présentes conditions générales de location.
          </div>
          <div className="cp-cg-sig-grid">
            <div className="cp-cg-sig-box">
              <div className="cp-cg-sig-lbl">Le locataire</div>
              <div className="cp-cg-sig-sub">Fait le : ____/____/________<br />à _____________ h _________<br />à ________________________</div>
            </div>
            <div className="cp-cg-sig-box">
              <div className="cp-cg-sig-lbl">2ème conducteur (si applicable)</div>
              <div className="cp-cg-sig-sub">Fait le : ____/____/________<br />à _____________ h _________</div>
            </div>
            <div className="cp-cg-sig-box">
              <div className="cp-cg-sig-lbl">L'agence de location</div>
              <div className="cp-cg-sig-sub">{valueOrLine(agency.name)}<br />Cachet & signature :</div>
            </div>
          </div>
        </div>

        <div className="cp-page-num">Page 2 / 2</div>
      </div>
    </div>
  );
}
