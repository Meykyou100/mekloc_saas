import type { ReactNode } from 'react';

export default function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-gold-300">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-black text-white light:text-carbon-950 sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-carbon-300 light:text-carbon-600">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
