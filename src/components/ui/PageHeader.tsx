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
    <div className="mb-5 flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-zinc-950/95 via-black/80 to-zinc-950/70 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)] sm:mb-5 sm:gap-4 md:mb-6 md:flex-row md:items-end md:justify-between md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
      <div>
        {eyebrow ? (
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.26em] text-gold-300 sm:mb-2 sm:text-xs sm:tracking-[0.28em]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[1.7rem] font-black leading-tight text-white light:text-carbon-950 sm:text-2xl lg:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-carbon-300 light:text-carbon-600 sm:mt-2 sm:text-sm sm:leading-6">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex w-full md:w-auto [&>button]:w-full md:[&>button]:w-auto">{action}</div> : null}
    </div>
  );
}
