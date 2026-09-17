import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)', dark: 'rgb(var(--brand-dark-rgb) / <alpha-value>)', soft: 'rgb(var(--brand-soft-rgb) / <alpha-value>)' },
      },
      fontFamily: { sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1)' },
    },
  },
  plugins: [],
} satisfies Config;
