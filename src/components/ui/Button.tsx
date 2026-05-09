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
    'bg-[#D4A017] text-carbon-950 shadow-[0_10px_24px_rgba(212,160,23,.16)] hover:bg-[#E8B923] border border-[#E8B923]/70',
  secondary:
    'bg-white/10 text-white border border-white/10 hover:bg-white/15 light:bg-carbon-950/5 light:text-carbon-950 light:border-carbon-950/10',
  ghost:
    'text-carbon-100 hover:bg-white/10 border border-transparent light:text-carbon-800 light:hover:bg-carbon-950/5',
  danger:
    'bg-rose-500/15 text-rose-100 border border-rose-400/30 hover:bg-rose-500/25 light:text-rose-700',
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
