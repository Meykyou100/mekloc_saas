import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'fr';
type Theme = 'dark';

export type Toast = {
  id: number;
  title: string;
  message?: string;
  type?: 'success' | 'info' | 'warning';
};

type AppContextValue = {
  language: Language;
  setLanguage: (_language: Language) => void;
  theme: Theme;
  toggleTheme: () => void;
  toasts: Toast[];
  notify: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  t: (key: string) => string;
};

const translations: Record<Language, Record<string, string>> = {
  fr: {
    dashboard: 'Tableau',
    reservations: 'Réservations',
    vehicles: 'Véhicules',
    clients: 'Clients',
    contracts: 'Contrats',
    payments: 'Paiements',
    maintenance: 'Entretien',
    reports: 'Rapports',
    settings: 'Paramètres',
    search: 'Rechercher une réservation, un client, un véhicule...',
    startFree: 'Essai gratuit',
    bookDemo: 'Réserver une démo',
  },
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language] = useState<Language>('fr');
  const [theme] = useState<Theme>('dark');
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    localStorage.setItem('mekloc-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
    localStorage.setItem('mekloc-language', language);
  }, [language]);

  const value = useMemo<AppContextValue>(
    () => ({
      language,
      setLanguage: () => {},
      theme,
      toggleTheme: () => {},
      toasts,
      notify: (toast) => {
        const id = Date.now();
        setToasts((current) => [...current, { ...toast, id }]);
        window.setTimeout(() => {
          setToasts((current) => current.filter((item) => item.id !== id));
        }, 3400);
      },
      dismissToast: (id) => setToasts((current) => current.filter((item) => item.id !== id)),
      t: (key) => translations[language][key] || key,
    }),
    [language, theme, toasts],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return context;
}
