type MekLocLoaderProps = {
  title?: string;
  subtitle?: string;
};

const steps = [
  'Vérification de la session',
  'Chargement des données agence',
  'Préparation du tableau de bord',
];

export default function MekLocLoader({
  title = 'MekLoc prépare votre espace',
  subtitle = 'Connexion sécurisée à votre agence…',
}: MekLocLoaderProps) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#060708] px-5 py-[max(2rem,env(safe-area-inset-top))] text-white">
      <style>{`
        @keyframes mekloc-loader-enter { from { opacity: 0; transform: translate3d(0, 10px, 0) scale(.985); } to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
        @keyframes mekloc-loader-ring { from { transform: perspective(360px) rotateX(62deg) rotateZ(0deg); } to { transform: perspective(360px) rotateX(62deg) rotateZ(360deg); } }
        @keyframes mekloc-loader-ring-reverse { from { transform: perspective(360px) rotateY(58deg) rotateZ(360deg); } to { transform: perspective(360px) rotateY(58deg) rotateZ(0deg); } }
        @keyframes mekloc-loader-logo-float { 0%, 100% { transform: translate3d(0,0,0) rotateX(0deg); } 50% { transform: translate3d(0,-6px,0) rotateX(8deg); } }
        @keyframes mekloc-loader-orbit-dot { from { transform: rotate(0deg) translateX(51px) rotate(0deg); } to { transform: rotate(360deg) translateX(51px) rotate(-360deg); } }
        @keyframes mekloc-loader-shimmer { from { transform: translateX(-120%); } to { transform: translateX(240%); } }
        @keyframes mekloc-loader-dot { 0%, 80%, 100% { opacity: .3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
        .mekloc-loader-card { animation: mekloc-loader-enter .45s ease-out both; }
        .mekloc-loader-logo { animation: mekloc-loader-logo-float 2.8s ease-in-out infinite; }
        .mekloc-loader-ring { animation: mekloc-loader-ring 4.6s linear infinite; }
        .mekloc-loader-ring-reverse { animation: mekloc-loader-ring-reverse 6.2s linear infinite; }
        .mekloc-loader-orbit-dot { animation: mekloc-loader-orbit-dot 3.2s linear infinite; }
        .mekloc-loader-shimmer { animation: mekloc-loader-shimmer 1.8s ease-in-out infinite; }
        .mekloc-loader-dot:nth-child(2) { animation-delay: .15s; }
        .mekloc-loader-dot:nth-child(3) { animation-delay: .3s; }
        .mekloc-loader-dot { animation: mekloc-loader-dot 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .mekloc-loader-card, .mekloc-loader-logo, .mekloc-loader-ring, .mekloc-loader-ring-reverse, .mekloc-loader-orbit-dot, .mekloc-loader-shimmer, .mekloc-loader-dot { animation: none; } }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(227,177,23,.14),transparent_28%),linear-gradient(rgba(255,255,255,.024)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:auto,52px_52px,52px_52px]" />
      <div className="mekloc-loader-card relative w-full max-w-[440px] rounded-[30px] border border-gold-300/25 bg-[#0d0f11] p-7 shadow-[0_26px_80px_rgba(0,0,0,.48),0_0_42px_rgba(227,177,23,.08)] sm:p-9" role="status" aria-live="polite">
        <div className="relative mx-auto grid h-[82px] w-[82px] place-items-center" style={{ perspective: '500px' }}>
          <span className="mekloc-loader-ring absolute -inset-3 rounded-full border border-transparent border-t-gold-300/80 border-r-gold-300/30" />
          <span className="mekloc-loader-ring-reverse absolute -inset-1 rounded-full border border-dashed border-gold-300/35" />
          <span className="mekloc-loader-orbit-dot absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full bg-gold-300 shadow-[0_0_14px_rgba(247,189,19,.8)]" />
          <div className="mekloc-loader-logo grid h-[82px] w-[82px] place-items-center rounded-[26px] border border-gold-300/25 bg-gold-400/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,.13),0_12px_30px_rgba(0,0,0,.25)]">
            <img src="/mekloc-logo-mark.png" alt="MekLoc" className="h-12 w-12 object-contain" />
          </div>
        </div>
        <div className="mt-8 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-gold-300">CHARGEMENT</p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-carbon-300">{subtitle}</p>
        </div>
        <div className="mt-7 overflow-hidden rounded-full bg-white/[0.08] p-[3px]">
          <div className="relative h-2 w-2/3 overflow-hidden rounded-full bg-gradient-to-r from-gold-500 via-gold-300 to-gold-400">
            <span className="mekloc-loader-shimmer absolute inset-y-0 w-1/3 bg-white/55" />
          </div>
        </div>
        <div className="mt-7 space-y-3">
          {steps.map((step, index) => (
            <div key={step} className={`flex items-center gap-3 text-sm ${index === 0 ? 'text-white' : 'text-carbon-400'}`}>
              <span className={`grid h-5 w-5 place-items-center rounded-full border ${index === 0 ? 'border-gold-300/45 bg-gold-400/15' : 'border-white/10 bg-white/[0.03]'}`}>
                {index === 0 ? <span className="flex gap-0.5">{[0, 1, 2].map((dot) => <i key={dot} className="mekloc-loader-dot block h-1 w-1 rounded-full bg-gold-300" />)}</span> : <span className="h-1.5 w-1.5 rounded-full bg-carbon-500" />}
              </span>
              <span className="font-medium">{step}</span>
            </div>
          ))}
        </div>
        <p className="mt-8 border-t border-white/8 pt-5 text-center text-xs font-medium text-carbon-400">Vos données restent protégées.</p>
      </div>
    </div>
  );
}
