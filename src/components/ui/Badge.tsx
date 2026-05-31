import type { ReactNode } from 'react';

const badgeStyles: Record<string, string> = {
  Available: 'bg-emerald-400/15 text-emerald-700 border-emerald-300/30 dark:text-emerald-200',
  Rented: 'bg-gold-400/14 text-[var(--app-gold-text)] border-gold-300/30',
  Maintenance: 'bg-sky-400/15 text-sky-700 border-sky-300/30 dark:text-sky-200',
  Unavailable: 'bg-rose-400/15 text-rose-700 border-rose-300/30 dark:text-rose-200',
  Confirmed: 'bg-sky-400/15 text-sky-700 border-sky-300/30 dark:text-sky-200',
  Active: 'bg-gold-400/14 text-[var(--app-gold-text)] border-gold-300/30',
  Completed: 'bg-emerald-400/15 text-emerald-700 border-emerald-300/30 dark:text-emerald-200',
  Cancelled: 'bg-rose-400/15 text-rose-700 border-rose-300/30 dark:text-rose-200',
  Paid: 'bg-emerald-400/15 text-emerald-700 border-emerald-300/30 dark:text-emerald-200',
  Payé: 'bg-emerald-400/15 text-emerald-700 border-emerald-300/30 dark:text-emerald-200',
  Partial: 'bg-gold-400/14 text-[var(--app-gold-text)] border-gold-300/30',
  Partiel: 'bg-gold-400/14 text-[var(--app-gold-text)] border-gold-300/30',
  Impayé: 'bg-rose-400/15 text-rose-700 border-rose-300/30 dark:text-rose-200',
  Pending: 'bg-slate-400/15 text-slate-700 border-slate-300/30 dark:text-slate-200',
  'En attente': 'bg-slate-400/15 text-slate-700 border-slate-300/30 dark:text-slate-200',
  Late: 'bg-rose-400/15 text-rose-700 border-rose-300/30 dark:text-rose-200',
  'En retard': 'bg-rose-500/15 text-rose-700 border-rose-300/35 dark:text-rose-100',
  VIP: 'bg-gold-400/14 text-[var(--app-gold-text)] border-gold-300/30',
  Regular: 'bg-sky-400/15 text-sky-700 border-sky-300/30 dark:text-sky-200',
  New: 'bg-emerald-400/15 text-emerald-700 border-emerald-300/30 dark:text-emerald-200',
  High: 'bg-rose-400/15 text-rose-700 border-rose-300/30 dark:text-rose-200',
  Medium: 'bg-gold-400/14 text-[var(--app-gold-text)] border-gold-300/30',
  Low: 'bg-emerald-400/15 text-emerald-700 border-emerald-300/30 dark:text-emerald-200',
};

export default function Badge({ children }: { children: ReactNode }) {
  const key = String(children);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeStyles[key] || 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text-soft)]'}`}
    >
      {children}
    </span>
  );
}
