import type { LucideIcon } from 'lucide-react';
import Button from './Button';
import Card from './Card';

export default function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="grid place-items-center border-dashed border-[var(--app-border)] bg-[var(--app-card)] px-5 py-8 text-center sm:px-6 sm:py-12">
      <div className="grid max-w-md justify-items-center gap-3 sm:gap-4">
        <div className="rounded-2xl border border-gold-300/20 bg-gold-400/10 p-3 text-[var(--app-gold-text)] shadow-[0_0_34px_rgba(227,177,23,0.12)] sm:p-4">
          <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[var(--app-text)]">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">{message}</p>
        </div>
        {action && onAction ? <Button onClick={onAction}>{action}</Button> : null}
      </div>
    </Card>
  );
}
