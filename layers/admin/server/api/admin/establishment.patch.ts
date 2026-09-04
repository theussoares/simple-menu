import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { updateEstablishmentAppearanceSchema } from '#shared/schemas/establishment.schema'
import type { EstablishmentDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<EstablishmentDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const parsed = await readValidatedBody(event, (body) => updateEstablishmentAppearanceSchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados inválidos.' })
  }

  const newCoverImageUrl = parsed.data.coverImageUrl || null
  const newLogoUrl = parsed.data.logoUrl || null

  const { data, error } = await client
    .from('establishments')
    .update({ cover_image_url: newCoverImageUrl, logo_url: newLogoUrl })
    .eq('id', establishment.id)
    .select('*')
    .single()

  if (error) {
    logServerError('admin.establishment.update', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar o estabelecimento.' })
  }

  if (establishment.coverImageUrl && establishment.coverImageUrl !== newCoverImageUrl) {
    await deleteProductImageIfOwned(client, establishment.coverImageUrl)
  }
  if (establishment.logoUrl && establishment.logoUrl !== newLogoUrl) {
    await deleteProductImageIfOwned(client, establishment.logoUrl)
  }

  return toEstablishmentDto(data)
})
