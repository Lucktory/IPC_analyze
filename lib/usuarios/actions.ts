'use server'

// ============================================================================
// Usuarios server actions.
//
// Access model (enforced here, since the DB runs mostly RLS-off):
//   • Admin actions  → require super_admin, run through the SERVICE-ROLE client
//                      (createSupabaseAdmin) which can call the auth admin API.
//   • Self actions   → any logged-in user, but only ever touch their OWN row
//                      (id === auth.uid()), run through the normal session client.
//
// Every admin action calls requireSuperAdmin() FIRST. Never trust an id coming
// from the client for a self action — always use the session user's id.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser, requireSuperAdmin } from '@/lib/auth/current-user'
import { logAudit } from '@/lib/audit/log'
import type { UsuarioRow, UsuarioRole } from '@/lib/usuarios/types'

type Result = { ok: boolean; error: string | null }
type ListResult = Result & { usuarios?: UsuarioRow[] }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function mapRow(r: any): UsuarioRow {
  return {
    id:        r.id,
    email:     r.email,
    fullName:  r.full_name ?? null,
    phone:     r.phone ?? null,
    dni:       r.dni ?? null,
    photoUrl:  r.photo_url ?? null,
    role:      r.role === 'super_admin' ? 'super_admin' : 'user',
    active:    r.active === true,
    createdAt: r.created_at ?? null,
  }
}

// Build the service-role client, turning a missing SUPABASE_SERVICE_ROLE_KEY
// into a friendly result instead of a thrown 500 on the page.
type AdminHandle =
  | { ok: true;  client: ReturnType<typeof createSupabaseAdmin> }
  | { ok: false; error: string }

function adminOrError(): AdminHandle {
  try { return { ok: true, client: createSupabaseAdmin() } }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Cliente admin no disponible.' } }
}

// ── List (admin) ────────────────────────────────────────────────────────────
export async function listUsuarios(): Promise<ListResult> {
  if (!(await requireSuperAdmin())) return { ok: false, error: 'No autorizado.' }
  const _a = adminOrError()
  if (!_a.ok) return { ok: false, error: _a.error }
  const admin = _a.client
  const { data, error } = await admin
    .from('usuarios')
    .select('id, email, full_name, phone, dni, photo_url, role, active, created_at')
    .order('created_at', { ascending: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, error: null, usuarios: (data ?? []).map(mapRow) }
}

// ── Create (admin) ──────────────────────────────────────────────────────────
export async function createUsuario(input: {
  email:    string
  password: string
  fullName?: string | null
  phone?:    string | null
  dni?:      string | null
  role?:     UsuarioRole
}): Promise<Result & { id?: string }> {
  if (!(await requireSuperAdmin())) return { ok: false, error: 'No autorizado.' }

  const email = input.email.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Email invalido.' }
  if (!input.password || input.password.length < 6) {
    return { ok: false, error: 'La contrasena debe tener al menos 6 caracteres.' }
  }
  const role: UsuarioRole = input.role === 'super_admin' ? 'super_admin' : 'user'

  const _a = adminOrError()
  if (!_a.ok) return { ok: false, error: _a.error }
  const admin = _a.client
  // Create the auth user (ready to log in — no email confirmation step).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  })
  if (createErr || !created?.user) {
    return { ok: false, error: createErr?.message ?? 'No se pudo crear el usuario.' }
  }

  // Upsert the profile (the trigger may have inserted a bare row already).
  const { error: profErr } = await admin.from('usuarios').upsert({
    id:        created.user.id,
    email,
    full_name: input.fullName?.trim() || null,
    phone:     input.phone?.trim() || null,
    dni:       input.dni?.trim() || null,
    role,
    active:    true,
    updated_at: new Date().toISOString(),
  })
  if (profErr) {
    // Roll back the auth user so we don't leave an orphan login.
    await admin.auth.admin.deleteUser(created.user.id)
    return { ok: false, error: profErr.message }
  }

  // Audit with the real actor (the admin creating the user).
  const { data: createdRow } = await admin.from('usuarios').select('*').eq('id', created.user.id).maybeSingle()
  await logAudit({ action: 'insert', entityType: 'usuarios', entityId: created.user.id, after: createdRow ?? null, summary: `Creo el usuario ${email}` })

  revalidatePath('/usuarios')
  return { ok: true, error: null, id: created.user.id }
}

// ── Update (admin) ──────────────────────────────────────────────────────────
export async function updateUsuario(id: string, patch: {
  fullName?:    string | null
  phone?:       string | null
  dni?:         string | null
  role?:        UsuarioRole
  active?:      boolean
  email?:       string
  newPassword?: string
}): Promise<Result> {
  const me = await requireSuperAdmin()
  if (!me) return { ok: false, error: 'No autorizado.' }

  const _a = adminOrError()
  if (!_a.ok) return { ok: false, error: _a.error }
  const admin = _a.client

  // Snapshot BEFORE for the audit diff (real actor logged below).
  const { data: beforeRow } = await admin.from('usuarios').select('*').eq('id', id).maybeSingle()

  // Guard: don't strip the last super_admin (either by demotion or deactivation).
  if ((patch.role === 'user' || patch.active === false)) {
    const demotingAdmin = await isSuperAdmin(admin, id)
    if (demotingAdmin && await isLastSuperAdmin(admin, id)) {
      return { ok: false, error: 'No podes dejar el sistema sin administradores.' }
    }
  }

  // Auth-side changes (email / password) via the admin API.
  if (patch.email !== undefined || patch.newPassword !== undefined) {
    const authPatch: { email?: string; password?: string } = {}
    if (patch.email !== undefined) {
      const email = patch.email.trim().toLowerCase()
      if (!EMAIL_RE.test(email)) return { ok: false, error: 'Email invalido.' }
      authPatch.email = email
    }
    if (patch.newPassword !== undefined && patch.newPassword !== '') {
      if (patch.newPassword.length < 6) {
        return { ok: false, error: 'La contrasena debe tener al menos 6 caracteres.' }
      }
      authPatch.password = patch.newPassword
    }
    if (Object.keys(authPatch).length > 0) {
      const { error: authErr } = await admin.auth.admin.updateUserById(id, authPatch)
      if (authErr) return { ok: false, error: authErr.message }
    }
  }

  // Profile-side changes.
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('fullName' in patch) updates.full_name = patch.fullName?.trim() || null
  if ('phone' in patch)    updates.phone = patch.phone?.trim() || null
  if ('dni' in patch)      updates.dni = patch.dni?.trim() || null
  if ('role' in patch)     updates.role = patch.role === 'super_admin' ? 'super_admin' : 'user'
  if ('active' in patch)   updates.active = patch.active === true
  if (patch.email !== undefined) updates.email = patch.email.trim().toLowerCase()

  const { error } = await admin.from('usuarios').update(updates).eq('id', id)
  if (error) return { ok: false, error: error.message }

  // Audit with the real actor + before/after so the diff shows what changed.
  const { data: afterRow } = await admin.from('usuarios').select('*').eq('id', id).maybeSingle()
  await logAudit({ action: 'update', entityType: 'usuarios', entityId: id, before: beforeRow ?? null, after: afterRow ?? null })

  revalidatePath('/usuarios')
  return { ok: true, error: null }
}

// ── Delete (admin) ──────────────────────────────────────────────────────────
export async function deleteUsuario(id: string): Promise<Result> {
  const me = await requireSuperAdmin()
  if (!me) return { ok: false, error: 'No autorizado.' }
  if (id === me.id) return { ok: false, error: 'No podes eliminar tu propia cuenta.' }

  const _a = adminOrError()
  if (!_a.ok) return { ok: false, error: _a.error }
  const admin = _a.client
  if (await isSuperAdmin(admin, id) && await isLastSuperAdmin(admin, id)) {
    return { ok: false, error: 'No podes eliminar al ultimo administrador.' }
  }

  // Snapshot BEFORE the cascade delete removes the row.
  const { data: beforeRow } = await admin.from('usuarios').select('*').eq('id', id).maybeSingle()

  // Deleting the auth user cascades to the usuarios row (FK on delete cascade).
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return { ok: false, error: error.message }

  // Best-effort: drop their avatar from storage so nothing is orphaned.
  await admin.storage.from('avatars').remove([`${id}/avatar`])

  // Audit with the real actor (the admin deleting the user).
  await logAudit({ action: 'delete', entityType: 'usuarios', entityId: id, before: beforeRow ?? null, summary: `Elimino el usuario ${(beforeRow as { email?: string } | null)?.email ?? ''}`.trim() })

  revalidatePath('/usuarios')
  return { ok: true, error: null }
}

// ── Self: update own profile (never role/active/email/password here) ─────────
export async function updateMyProfile(patch: {
  fullName?: string | null
  phone?:    string | null
  dni?:      string | null
}): Promise<Result> {
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: 'No autorizado.' }

  const supabase = await createSupabaseServer()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('fullName' in patch) updates.full_name = patch.fullName?.trim() || null
  if ('phone' in patch)    updates.phone = patch.phone?.trim() || null
  if ('dni' in patch)      updates.dni = patch.dni?.trim() || null

  // RLS restricts this to the caller's own row; the explicit eq is belt-and-braces.
  const { error } = await supabase.from('usuarios').update(updates).eq('id', me.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/mi-perfil')
  return { ok: true, error: null }
}

// ── Self: change own password ────────────────────────────────────────────────
// Requires the CURRENT password and verifies it before applying the new one.
// The verification uses a throwaway client with persistSession:false, so a
// wrong password is rejected without ever disturbing the live session cookies.
export async function changeMyPassword(input: {
  currentPassword: string
  newPassword:     string
}): Promise<Result> {
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: 'No autorizado.' }
  if (!me.email) return { ok: false, error: 'Tu cuenta no tiene email; no se puede verificar la contrasena.' }

  const { currentPassword, newPassword } = input
  if (!currentPassword) return { ok: false, error: 'Ingresa tu contrasena actual.' }
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: 'La nueva contrasena debe tener al menos 6 caracteres.' }
  }
  if (currentPassword === newPassword) {
    return { ok: false, error: 'La nueva contrasena debe ser distinta de la actual.' }
  }

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return { ok: false, error: 'Configuracion de Supabase incompleta.' }

  // Verify the current password (isolated client — no cookie persistence).
  const verifier = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: signInErr } = await verifier.auth.signInWithPassword({
    email:    me.email,
    password: currentPassword,
  })
  if (signInErr) return { ok: false, error: 'La contrasena actual no es correcta.' }

  // Apply the new password on the real session client.
  const supabase = await createSupabaseServer()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, error: error.message }
  return { ok: true, error: null }
}

// ── Photo (admin for anyone, or a user for themselves) ───────────────────────
// The file is uploaded to the public `avatars` bucket via the service-role
// client, then its public URL (cache-busted) is stored in usuarios.photo_url.
export async function setUsuarioPhoto(
  userId: string,
  formData: FormData,
): Promise<Result & { photoUrl?: string }> {
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: 'No autorizado.' }
  if (me.role !== 'super_admin' && me.id !== userId) return { ok: false, error: 'No autorizado.' }

  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'No se selecciono ninguna imagen.' }
  if (!file.type.startsWith('image/')) return { ok: false, error: 'El archivo debe ser una imagen.' }
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: 'La imagen no puede superar los 5 MB.' }

  const _a = adminOrError()
  if (!_a.ok) return { ok: false, error: _a.error }
  const admin = _a.client

  try {
    const path = `${userId}/avatar`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await admin.storage
      .from('avatars')
      .upload(path, buffer, { upsert: true, contentType: file.type })
    if (upErr) return { ok: false, error: upErr.message }

    const { data: pub } = admin.storage.from('avatars').getPublicUrl(path)
    const photoUrl = `${pub.publicUrl}?v=${Date.now()}`
    const { error } = await admin
      .from('usuarios')
      .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) return { ok: false, error: error.message }

    await logAudit({ action: 'update', entityType: 'usuarios', entityId: userId, summary: 'Actualizo la foto de perfil' })

    revalidatePath('/usuarios')
    revalidatePath('/mi-perfil')
    return { ok: true, error: null, photoUrl }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo subir la foto.' }
  }
}

export async function removeUsuarioPhoto(userId: string): Promise<Result> {
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: 'No autorizado.' }
  if (me.role !== 'super_admin' && me.id !== userId) return { ok: false, error: 'No autorizado.' }

  const _a = adminOrError()
  if (!_a.ok) return { ok: false, error: _a.error }
  const admin = _a.client

  await admin.storage.from('avatars').remove([`${userId}/avatar`])
  const { error } = await admin
    .from('usuarios')
    .update({ photo_url: null, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) return { ok: false, error: error.message }

  await logAudit({ action: 'update', entityType: 'usuarios', entityId: userId, summary: 'Quito la foto de perfil' })

  revalidatePath('/usuarios')
  revalidatePath('/mi-perfil')
  return { ok: true, error: null }
}

// ── helpers (service-role client) ────────────────────────────────────────────
async function isSuperAdmin(admin: ReturnType<typeof createSupabaseAdmin>, id: string): Promise<boolean> {
  const { data } = await admin.from('usuarios').select('role').eq('id', id).maybeSingle()
  return (data as { role?: string } | null)?.role === 'super_admin'
}

async function isLastSuperAdmin(admin: ReturnType<typeof createSupabaseAdmin>, id: string): Promise<boolean> {
  const { data } = await admin.from('usuarios').select('id').eq('role', 'super_admin').eq('active', true)
  const admins = (data ?? []) as { id: string }[]
  return admins.length <= 1 && admins.some(a => a.id === id)
}
