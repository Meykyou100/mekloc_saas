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
    <Card className="grid place-items-center px-6 py-12 text-center">
      <div className="grid max-w-md justify-items-center gap-4">
        <div className="rounded-2xl border border-gold-300/20 bg-gold-400/10 p-4 text-gold-200">
          <Icon className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white light:text-carbon-950">{title}</h3>
          <p className="mt-2 text-sm text-carbon-300 light:text-carbon-600">{message}</p>
        </div>
        {action && onAction ? <Button onClick={onAction}>{action}</Button> : null}
      </div>
    </Card>
  );
}
