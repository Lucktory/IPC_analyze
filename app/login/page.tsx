'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // After a successful login we show a centered "Aviso" modal first, and
  // only navigate to the panel once the user clicks Aceptar.
  const [showNotice, setShowNotice] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Credenciales incorrectas.')
      setLoading(false)
      return
    }
    // Auth OK — show the centered "Aviso" notice; navigate on Aceptar.
    setLoading(false)
    setShowNotice(true)
  }

  function handleAcceptNotice() {
    router.push('/liquidacion')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-8">
          <p className="label-cap">Administración Alejandro</p>
          <h1 className="font-display text-[28px] mt-2">Iniciar sesión</h1>
          <p className="text-slate text-[14px] mt-1">
            Ingresá tus credenciales para acceder al panel.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-paper border border-line rounded shadow-card p-6"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="label-cap block mb-1.5">Correo</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-line bg-cream text-[14px] outline-none focus:border-ink focus:bg-paper transition-colors"
                placeholder="alejandro@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="label-cap block mb-1.5">Contraseña</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-line bg-cream text-[14px] outline-none focus:border-ink focus:bg-paper transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="text-[12px] text-danger mt-3 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 h-10 bg-ink text-paper rounded-sm text-[13.5px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-[11px] text-slate text-center mt-6">
          Acceso restringido al equipo de administración.
        </p>
      </div>

      {/* Post-login "Aviso" notice — centered on the screen. Shown after a
          successful login; Aceptar continues to the panel. */}
      {showNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="aviso-title"
            className="w-full max-w-[420px] bg-paper border border-line rounded-lg shadow-card p-6"
          >
            <h2 id="aviso-title" className="font-display text-[20px] text-ink text-center">Aviso</h2>
            <div className="text-[14px] text-slate-dark mt-4 leading-relaxed space-y-3">
              <p>Hola Alejandro,</p>
              <p>
                Ahora mismo no puedo contactarte por WhatsApp porque perdí mi teléfono
                accidentalmente, así que esta fue la única forma que encontré para
                comunicarme contigo.
              </p>
              <p>
                Si ves este mensaje, te agradecería mucho que me contactaras por correo
                electrónico en{' '}
                <a
                  href="mailto:xautosolution@gmail.com"
                  className="text-info underline underline-offset-2"
                >
                  xautosolution@gmail.com
                </a>
                .
              </p>
              <p>Muchas gracias.</p>
              <p>Medhi</p>
            </div>
            <button
              type="button"
              autoFocus
              onClick={handleAcceptNotice}
              className="w-full mt-6 h-10 bg-ink text-paper rounded-sm text-[13.5px] font-medium hover:opacity-90 transition-opacity"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
