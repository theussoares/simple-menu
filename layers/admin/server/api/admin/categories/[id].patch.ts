import { createError, defineEventHandler, getRouterParams, readValidatedBody } from 'h3'
import { categoryIdParamSchema, categorySchema } from '#shared/schemas/category.schema'
import type { CategoryDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<CategoryDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const params = categoryIdParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Categoria inválida.' })
  }

  const parsed = await readValidatedBody(event, (body) => categorySchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados da categoria inválidos.' })
  }

  const { data, error } = await client
    .from('categories')
    .update({ name: parsed.data.name, sort_order: parsed.data.sortOrder })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)
    .select('*')
    .maybeSingle()

  if (error) {
    logServerError('admin.categories.update', error)
    const statusMessage = error.code === '23505' ? 'Já existe uma categoria com esse nome.' : 'Não foi possível atualizar a categoria.'
    throw createError({ statusCode: error.code === '23505' ? 409 : 500, statusMessage })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Categoria não encontrada.' })
  }

  return toCategoryDto(data)
})
