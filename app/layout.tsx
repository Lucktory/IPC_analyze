import type { Metadata } from 'next'
import { Lexend } from 'next/font/google'
import './globals.css'
import { ThemeProvider, FOUC_PREVENTION_SCRIPT } from '@/lib/theme'

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-lexend',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Rental Admin',
  description: 'Gestión de alquileres con actualización por IPC',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={lexend.variable} suppressHydrationWarning>
      <head>
        {/* Runs synchronously before React hydrates — sets data-theme on
            <html> from localStorage / OS preference so the first paint
            matches the user's theme. Avoids a flash of light content
            for dark-mode users. */}
        <script dangerouslySetInnerHTML={{ __html: FOUC_PREVENTION_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
