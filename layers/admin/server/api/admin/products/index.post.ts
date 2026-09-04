import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { productSchema } from '#shared/schemas/product.schema'
import type { ProductDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<ProductDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const parsed = await readValidatedBody(event, (body) => productSchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados do produto inválidos.' })
  }

  const input = parsed.data

  const categoryId = await resolveCategoryId(client, establishment.id, input.categoryId)

  const { data, error } = await client
    .from('products')
    .insert({
      establishment_id: establishment.id,
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
    .select('*')
    .single()

  if (error) {
    logServerError('admin.products.create', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar o produto.' })
  }

  const complementGroupIds = await syncProductComplementGroups(client, establishment.id, data.id, input.complementGroupIds)

  return toProductDto(data, complementGroupIds)
})
