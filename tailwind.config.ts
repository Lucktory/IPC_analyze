import type { Config } from 'tailwindcss'

// Design system ported from Plager ERP prototype, theming added on top.
// Surface + text + semantic colors resolve to CSS variables defined in
// app/globals.css, so existing utilities (bg-paper, text-ink, …) work
// automatically in light AND dark — no `dark:` variant proliferation.
//
// Accent and chart colors stay as static hex (they look right on both
// surfaces); chart components branch on theme internally via useTheme().

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // ── Themed tokens — resolve to CSS variables ──
        paper:  'rgb(var(--color-paper) / <alpha-value>)',
        cream: {
          DEFAULT: 'rgb(var(--color-cream)   / <alpha-value>)',
          2:       'rgb(var(--color-cream-2) / <alpha-value>)',
        },
        line:   'rgb(var(--color-line) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--color-ink)      / <alpha-value>)',
          soft:    'rgb(var(--color-ink-soft) / <alpha-value>)',
        },
        slate: {
          DEFAULT: 'rgb(var(--color-slate)      / <alpha-value>)',
          dark:    'rgb(var(--color-slate-dark) / <alpha-value>)',
        },
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warn:    'rgb(var(--color-warn)    / <alpha-value>)',
        danger:  'rgb(var(--color-danger)  / <alpha-value>)',
        info:    'rgb(var(--color-info)    / <alpha-value>)',
        nav: {
          bg:    'rgb(var(--color-nav-bg)    / <alpha-value>)',
          text:  'rgb(var(--color-nav-text)  / <alpha-value>)',
          muted: 'rgb(var(--color-nav-muted) / <alpha-value>)',
        },

        // ── Static tokens — not theme-dependent ──
        coral: { DEFAULT: '#FF8552', dark: '#E66A36' },
        peach: '#FFBC7D',
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
        // Premium chart palette used on /dashboard. Muted so the same hex
        // reads premium on both light and dark surfaces.
        accent: {
          gold:    '#D4A857',
          slate:   '#7E8696',
          emerald: '#6FB783',
          amethyst:'#9B8EC5',
        },
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
