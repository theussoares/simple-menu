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

  const { data, error } = await client
    .from('products')
    .insert({
      establishment_id: establishment.id,
      name: input.name,
      description: input.description || null,
      price: input.price,
      cost: input.cost ?? null,
      category: input.category || null,
      image_url: input.imageUrl || null,
      is_active: input.isActive,
      sort_order: input.sortOrder,
    })
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar o produto.' })
  }

  return toProductDto(data)
})
