import { createError, defineEventHandler, getRouterParams, readValidatedBody } from 'h3'
import { productIdParamSchema, productSchema } from '#shared/schemas/product.schema'
import type { ProductDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<ProductDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const params = productIdParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Produto inválido.' })
  }

  const parsed = await readValidatedBody(event, (body) => productSchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados do produto inválidos.' })
  }

  const input = parsed.data

  const { data, error } = await client
    .from('products')
    .update({
      name: input.name,
      description: input.description || null,
      price: input.price,
      promo_price: input.promoPrice ?? null,
      cost: input.cost ?? null,
      category: input.category || null,
      image_url: input.imageUrl || null,
      is_active: input.isActive,
      is_featured: input.isFeatured,
      sort_order: input.sortOrder,
    })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)
    .select('*')
    .maybeSingle()

  if (error) {
    logServerError('admin.products.update', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar o produto.' })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado.' })
  }

  return toProductDto(data)
})
