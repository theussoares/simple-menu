import { createError, defineEventHandler, getRouterParams } from 'h3'
import { categoryIdParamSchema } from '#shared/schemas/category.schema'

export default defineEventHandler(async (event) => {
  const { client, establishment } = await requireEstablishment(event)

  const params = categoryIdParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Categoria inválida.' })
  }

  const { error, count } = await client
    .from('categories')
    .delete({ count: 'exact' })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)

  if (error) {
    logServerError('admin.categories.delete', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível excluir a categoria.' })
  }
  if (!count) {
    throw createError({ statusCode: 404, statusMessage: 'Categoria não encontrada.' })
  }

  return { ok: true }
})
