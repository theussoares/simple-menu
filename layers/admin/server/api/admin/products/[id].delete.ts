import { createError, defineEventHandler, getRouterParams } from 'h3'
import { productIdParamSchema } from '#shared/schemas/product.schema'

export default defineEventHandler(async (event) => {
  const { client, establishment } = await requireEstablishment(event)

  const params = productIdParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Produto inválido.' })
  }

  const { data: existing, error: existingError } = await client
    .from('products')
    .select('image_url')
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)
    .maybeSingle()

  if (existingError) {
    logServerError('admin.products.delete.lookup', existingError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível excluir o produto.' })
  }
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado.' })
  }

  const { error, count } = await client
    .from('products')
    .delete({ count: 'exact' })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)

  if (error) {
    logServerError('admin.products.delete', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível excluir o produto.' })
  }
  if (!count) {
    throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado.' })
  }

  await deleteProductImageIfOwned(client, existing.image_url)

  return { ok: true }
})
