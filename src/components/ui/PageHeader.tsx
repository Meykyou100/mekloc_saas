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
    <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:gap-4 md:mb-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-gold-300 sm:mb-2 sm:text-xs sm:tracking-[0.28em]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-xl font-black text-white light:text-carbon-950 sm:text-2xl lg:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-carbon-300 light:text-carbon-600 sm:mt-2 sm:text-sm sm:leading-6">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
