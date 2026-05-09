import { Languages } from 'lucide-react';
import { useApp, type Language } from '../../context/AppContext';

const languages: { label: string; value: Language }[] = [
  { label: 'FR', value: 'fr' },
];

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useApp();

  return (
    <div
      aria-label="Language"
      className={`focus-within:ring-2 focus-within:ring-gold-300/70 ${
        compact ? 'h-10' : 'h-11'
      } inline-flex items-center gap-1 rounded-2xl border border-gold-300/20 bg-gold-400/10 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-xl light:border-gold-600/20 light:bg-gold-400/15`}
    >
      <Languages className={`${compact ? 'ml-2 h-4 w-4' : 'ml-2.5 h-4 w-4'} text-gold-300 light:text-gold-700`} />
      {languages.map((item) => {
        const active = language === item.value;
        return (
          <button
            key={item.value}
            type="button"
            className={`focus-ring ${
              compact ? 'h-8 px-3' : 'h-9 px-3.5'
            } rounded-xl text-xs font-black transition-all duration-200 ${
              active
                ? 'bg-gold-400 text-carbon-950 shadow-gold'
                : 'text-carbon-300 hover:bg-white/10 hover:text-white light:text-carbon-700 light:hover:text-carbon-950'
            }`}
            onClick={() => setLanguage(item.value)}
            aria-pressed={active}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
