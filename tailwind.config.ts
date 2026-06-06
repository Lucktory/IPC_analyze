import type { Config } from 'tailwindcss'

// Design system ported from Plager ERP prototype.
// Source: c:\HSH\chatActive\joao-br-plager-erp-refactor\prototipo-erp\tailwind.config.ts
// Rationale documented in WORKLOG.md.

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        coral: { DEFAULT: '#FF8552', dark: '#E66A36' },
        peach: '#FFBC7D',
        slate: { DEFAULT: '#7D8491', dark: '#4A4F58' },
        ink: { DEFAULT: '#1F1F1F', soft: '#2A2A2A' },
        paper: '#FFFFFF',
        cream: { DEFAULT: '#FAF6F1', 2: '#F3EEE6' },
        line: '#E6E1D8',
        royal: {
          DEFAULT: '#4068d8',
          dark: '#3457b8',
          deep: '#2A4DBC',
          light: '#5478e0',
          line: '#3F5FC8',
          ghost: '#EAF0FD',
        },
        action: { DEFAULT: '#22C55E', dark: '#16A34A' },
        navy: {
          DEFAULT: '#1E3A5F',
          light: '#2B4977',
          deep: '#16294A',
          line: '#385479',
        },
        success: '#16A34A',
        warn: '#F2994A',
        danger: '#DC2626',
        info: '#2563EB',
      },
      fontFamily: {
        sans: ['var(--font-lexend)', 'system-ui', 'sans-serif'],
        display: ['var(--font-lexend)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(17,17,17,0.04), 0 4px 12px rgba(17,17,17,0.04)',
        cardHover: '0 1px 2px rgba(17,17,17,0.06), 0 8px 24px rgba(17,17,17,0.06)',
      },
      maxWidth: { shell: '1440px' },
    },
  },
  plugins: [],
} satisfies Config
