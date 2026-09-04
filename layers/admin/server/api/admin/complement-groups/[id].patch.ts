import { createError, defineEventHandler, getRouterParams, readValidatedBody } from 'h3'
import { complementGroupIdParamSchema, complementGroupSchema } from '#shared/schemas/complement-group.schema'
import type { ComplementGroupDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<ComplementGroupDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const params = complementGroupIdParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Grupo inválido.' })
  }

  const parsed = await readValidatedBody(event, (body) => complementGroupSchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Dados do grupo inválidos.' })
  }

  const input = parsed.data

  const { data: group, error: groupError } = await client
    .from('complement_groups')
    .update({
      name: input.name,
      is_required: input.isRequired,
      min_select: input.minSelect,
      max_select: input.maxSelect,
      sort_order: input.sortOrder,
    })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)
    .select('*')
    .maybeSingle()

  if (groupError) {
    logServerError('admin.complement-groups.update', groupError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar o grupo de complementos.' })
  }
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Grupo não encontrado.' })
  }

  const { error: deleteError } = await client.from('complement_options').delete().eq('group_id', group.id)
  if (deleteError) {
    logServerError('admin.complement-groups.update-options-delete', deleteError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar as opções do grupo.' })
  }

  const { data: options, error: optionsError } = await client
    .from('complement_options')
    .insert(
      input.options.map((option, index) => ({
        group_id: group.id,
        name: option.name,
        price_delta: option.priceDelta,
        sort_order: option.sortOrder ?? index,
      })),
    )
    .select('*')

  if (optionsError) {
    logServerError('admin.complement-groups.update-options-insert', optionsError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar as opções do grupo.' })
  }

  return toComplementGroupDto({ ...group, complement_options: options })
})
