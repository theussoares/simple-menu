import { createError, defineEventHandler } from 'h3'
import type { CategoryDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<CategoryDto[]> => {
  const { client, establishment } = await requireEstablishment(event)

  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('establishment_id', establishment.id)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    logServerError('admin.categories.list', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível carregar as categorias.' })
  }

  return data.map(toCategoryDto)
})
