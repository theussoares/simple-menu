import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { z } from 'zod'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

const confirmSchema = z.object({
  code: z.string().min(1).max(2048),
})

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, 'auth-confirm', 20, 60_000)

  const parsed = await readValidatedBody(event, (body) => confirmSchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Link de confirmação inválido.' })
  }

  const client = await serverSupabaseClient<Database>(event)
  const { error } = await client.auth.exchangeCodeForSession(parsed.data.code)

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Não foi possível confirmar seu e-mail. O link pode ter expirado - tente entrar normalmente.',
    })
  }

  return { ok: true }
})
