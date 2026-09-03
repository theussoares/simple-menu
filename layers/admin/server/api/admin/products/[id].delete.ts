import { createError, defineEventHandler, getRouterParams } from 'h3'
import { productIdParamSchema } from '#shared/schemas/product.schema'

export default defineEventHandler(async (event) => {
  const { client, establishment } = await requireEstablishment(event)

  const params = productIdParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Produto inválido.' })
  }

  const { error, count } = await client
    .from('products')
    .delete({ count: 'exact' })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível excluir o produto.' })
  }
  if (!count) {
    throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado.' })
  }

  return { ok: true }
})
