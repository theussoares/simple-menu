import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import { loginSchema } from '#shared/schemas/auth.schema'
import { toFriendlyAuthMessage } from '../../utils/auth-errors'

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, 'auth-login', 10, 60_000)

  const parsed = await readValidatedBody(event, (body) => loginSchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados inválidos' })
  }

  const client = await serverSupabaseClient<Database>(event)
  const { email, password } = parsed.data

  const { error } = await client.auth.signInWithPassword({ email, password })

  if (error) {
    throw createError({ statusCode: 401, statusMessage: toFriendlyAuthMessage(error) })
  }

  return { ok: true }
})
