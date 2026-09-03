import { createError, defineEventHandler } from 'h3'
import type { ProductDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<ProductDto[]> => {
  const { client, establishment } = await requireEstablishment(event)

  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('establishment_id', establishment.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    logServerError('admin.products.list', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível carregar os produtos.' })
  }

  return data.map(toProductDto)
})
