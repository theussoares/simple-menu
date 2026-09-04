import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { complementGroupSchema } from '#shared/schemas/complement-group.schema'
import type { ComplementGroupDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<ComplementGroupDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const parsed = await readValidatedBody(event, (body) => complementGroupSchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Dados do grupo inválidos.' })
  }

  const input = parsed.data

  const { data: group, error: groupError } = await client
    .from('complement_groups')
    .insert({
      establishment_id: establishment.id,
      name: input.name,
      is_required: input.isRequired,
      min_select: input.minSelect,
      max_select: input.maxSelect,
      sort_order: input.sortOrder,
    })
    .select('*')
    .single()

  if (groupError) {
    logServerError('admin.complement-groups.create', groupError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar o grupo de complementos.' })
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
    logServerError('admin.complement-groups.create-options', optionsError)
    throw createError({ statusCode: 500, statusMessage: 'Grupo criado, mas não foi possível salvar as opções.' })
  }

  return toComplementGroupDto({ ...group, complement_options: options })
})
