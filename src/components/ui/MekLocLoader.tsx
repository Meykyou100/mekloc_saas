type MekLocLoaderProps = {
  title?: string;
  subtitle?: string;
};

export default function MekLocLoader(_: MekLocLoaderProps) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#060708] px-6 py-[max(2rem,env(safe-area-inset-top))]" role="status" aria-label="Chargement MekLoc">
      <style>{`
        @keyframes mekloc-logo-breathe {
          0%, 100% { opacity: .78; transform: scale(.94); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        .mekloc-logo-loader { animation: mekloc-logo-breathe 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .mekloc-logo-loader { animation: none; opacity: 1; transform: none; } }
      `}</style>
      <img
        src="/mekloc-logo-original-transparent.png"
        alt="MekLoc"
        className="mekloc-logo-loader h-auto w-full max-w-[190px] object-contain sm:max-w-[230px]"
      />
    </div>
  );
}
