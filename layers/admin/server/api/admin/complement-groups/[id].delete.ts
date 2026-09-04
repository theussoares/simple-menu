import { createError, defineEventHandler, getRouterParams } from 'h3'
import { complementGroupIdParamSchema } from '#shared/schemas/complement-group.schema'

export default defineEventHandler(async (event) => {
  const { client, establishment } = await requireEstablishment(event)

  const params = complementGroupIdParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Grupo inválido.' })
  }

  const { error, count } = await client
    .from('complement_groups')
    .delete({ count: 'exact' })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)

  if (error) {
    logServerError('admin.complement-groups.delete', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível excluir o grupo de complementos.' })
  }
  if (!count) {
    throw createError({ statusCode: 404, statusMessage: 'Grupo não encontrado.' })
  }

  return { ok: true }
})
