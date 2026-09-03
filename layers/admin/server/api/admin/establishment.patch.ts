import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { updateEstablishmentAppearanceSchema } from '#shared/schemas/establishment.schema'
import type { EstablishmentDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<EstablishmentDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const parsed = await readValidatedBody(event, (body) => updateEstablishmentAppearanceSchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados inválidos.' })
  }

  const { data, error } = await client
    .from('establishments')
    .update({ cover_image_url: parsed.data.coverImageUrl || null })
    .eq('id', establishment.id)
    .select('*')
    .single()

  if (error) {
    logServerError('admin.establishment.update', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar o estabelecimento.' })
  }

  return toEstablishmentDto(data)
})
