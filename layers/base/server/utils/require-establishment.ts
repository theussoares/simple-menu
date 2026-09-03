import { createError, type H3Event } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/**
 * Uses client.auth.getUser() (not the module's serverSupabaseUser helper,
 * which in this version returns raw JWT claims keyed by `sub` rather than a
 * proper User object) so `.id` / `.email` are always reliable.
 */
export async function requireAuthenticatedUser(event: H3Event) {
  const client = await serverSupabaseClient<Database>(event)
  const { data, error } = await client.auth.getUser()

  if (error || !data.user) {
    throw createError({ statusCode: 401, statusMessage: 'Nao autenticado' })
  }

  return data.user
}

/**
 * Loads the establishment owned by the current session and returns it
 * alongside a Supabase client bound to that session (RLS enforces the
 * ownership check on every subsequent query).
 */
export async function requireEstablishment(event: H3Event) {
  const user = await requireAuthenticatedUser(event)
  const client = await serverSupabaseClient<Database>(event)

  const { data, error } = await client
    .from('establishments')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (error) {
    logServerError('require-establishment.lookup', error)
    throw createError({ statusCode: 500, statusMessage: 'Erro ao carregar estabelecimento' })
  }
  if (!data) {
    throw createError({ statusCode: 409, statusMessage: 'Estabelecimento ainda nao foi configurado' })
  }

  return {
    client,
    user,
    establishment: toEstablishmentDto(data),
  }
}
