import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import { createEstablishmentSchema } from '#shared/schemas/establishment.schema'
import type { EstablishmentDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<EstablishmentDto> => {
  const user = await requireAuthenticatedUser(event)

  const parsed = await readValidatedBody(event, (body) => createEstablishmentSchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados inválidos' })
  }

  const client = await serverSupabaseClient<Database>(event)

  const { data: existing } = await client
    .from('establishments')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Você já possui um estabelecimento cadastrado.' })
  }

  const slug = await generateUniqueSlug(client, parsed.data.name)

  const { data, error } = await client
    .from('establishments')
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      slug,
      segment: parsed.data.segment || null,
    })
    .select('id, name, slug, segment')
    .single()

  if (error) {
    logServerError('admin.establishment.insert', error)
    const statusMessage
      = error.code === '23505'
        ? 'Esse identificador já está em uso, tente novamente.'
        : 'Não foi possível criar o estabelecimento.'
    throw createError({ statusCode: 500, statusMessage })
  }

  return data
})
