import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--app-gold)] text-carbon-950 shadow-[0_10px_24px_rgba(212,160,23,.16)] hover:bg-[var(--app-gold-hover)] border border-[color-mix(in_srgb,var(--app-gold)_70%,white_30%)]',
  secondary:
    'bg-[var(--app-surface-soft)] text-[var(--app-text)] border border-[var(--app-border)] hover:bg-[color-mix(in_srgb,var(--app-surface-soft)_70%,var(--app-text)_8%)]',
  ghost:
    'text-[var(--app-text-soft)] hover:bg-[var(--app-surface-soft)] border border-transparent',
  danger:
    'bg-rose-500/15 text-[var(--app-danger)] border border-rose-400/30 hover:bg-rose-500/25',
};

export default function Button({
  children,
  className = '',
  variant = 'primary',
  icon,
  loading,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      <span>{children}</span>
    </button>
  );
}
