import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { categorySchema } from '#shared/schemas/category.schema'
import type { CategoryDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<CategoryDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const parsed = await readValidatedBody(event, (body) => categorySchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados da categoria inválidos.' })
  }

  const { data, error } = await client
    .from('categories')
    .insert({
      establishment_id: establishment.id,
      name: parsed.data.name,
      sort_order: parsed.data.sortOrder,
    })
    .select('*')
    .single()

  if (error) {
    logServerError('admin.categories.create', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar a categoria.' })
  }

  return toCategoryDto(data)
})
