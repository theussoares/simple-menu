import { createError, defineEventHandler } from 'h3'
import type { ProductRowWithComplementGroupIds } from '#shared/types/database-relations'
import type { ProductDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<ProductDto[]> => {
  const { client, establishment } = await requireEstablishment(event)

  const { data, error } = await client
    .from('products')
    .select('*, product_complement_groups(group_id)')
    .eq('establishment_id', establishment.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    logServerError('admin.products.list', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível carregar os produtos.' })
  }

  return (data as ProductRowWithComplementGroupIds[]).map((row) =>
    toProductDto(row, row.product_complement_groups.map((link) => link.group_id)),
  )
})
