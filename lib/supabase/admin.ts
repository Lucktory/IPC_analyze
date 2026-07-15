import { createClient } from '@supabase/supabase-js'

// ============================================================================
// Service-role Supabase client — SERVER ONLY.
//
// This client uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS and can call
// the auth admin API (createUser / deleteUser / updateUserById). It must NEVER
// be imported into a client component or exposed to the browser. Only
// role-gated server actions in lib/usuarios/actions.ts use it.
//
// The key is read from a NON-public env var so Next.js never bundles it into
// client output. If it's missing we throw a clear error rather than silently
// falling back to the anon key (which can't do admin operations).
// ============================================================================
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL no esta configurada.')
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no esta configurada. Agregala en las variables ' +
      'de entorno del servidor (Supabase > Settings > API > service_role).',
    )
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
