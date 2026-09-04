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

  const { data: existing, error: existingError } = await client
    .from('products')
    .select('image_url')
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)
    .maybeSingle()

  if (existingError) {
    logServerError('admin.products.update.lookup', existingError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar o produto.' })
  }
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado.' })
  }

  const categoryId = await resolveCategoryId(client, establishment.id, input.categoryId)

  const { data, error } = await client
    .from('products')
    .update({
      name: input.name,
      description: input.description || null,
      price: input.price,
      promo_price: input.promoPrice ?? null,
      cost: input.cost ?? null,
      category_id: categoryId,
      image_url: input.imageUrl || null,
      is_active: input.isActive,
      is_featured: input.isFeatured,
      sort_order: input.sortOrder,
    })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)
    .select('*')
    .single()

  if (error) {
    logServerError('admin.products.update', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar o produto.' })
  }

  const newImageUrl = input.imageUrl || null
  if (existing.image_url && existing.image_url !== newImageUrl) {
    await deleteProductImageIfOwned(client, existing.image_url)
  }

  const complementGroupIds = await syncProductComplementGroups(client, establishment.id, data.id, input.complementGroupIds)

  return toProductDto(data, complementGroupIds)
})
