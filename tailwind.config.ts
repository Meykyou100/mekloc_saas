import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        carbon: {
          50: '#f6f7f7',
          100: '#e1e6e5',
          200: '#c3cdcb',
          300: '#9dadab',
          400: '#758987',
          500: '#596d6b',
          600: '#455655',
          700: '#394746',
          800: '#202826',
          900: '#101514',
          950: '#070909',
        },
        gold: {
          50: '#fff9de',
          100: '#fff1b2',
          200: '#ffe274',
          300: '#ffd13a',
          400: '#f7bd13',
          500: '#d99b06',
          600: '#b97702',
          700: '#935706',
          800: '#79450c',
          900: '#663a0f',
        },
        mint: {
          400: '#67e8b9',
          500: '#2dd4a3',
        },
      },
      boxShadow: {
        gold: '0 22px 70px rgba(247, 189, 19, 0.16)',
        glass: '0 18px 60px rgba(0, 0, 0, 0.32)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gold-sheen':
          'linear-gradient(135deg, rgba(255,209,58,.22), rgba(255,255,255,.05) 42%, rgba(45,212,163,.10))',
        'surface-grid':
          'linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-700px 0' },
          '100%': { backgroundPosition: '700px 0' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
