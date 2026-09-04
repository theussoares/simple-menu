import { createError, defineEventHandler } from 'h3'
import type { ComplementGroupRowWithOptions } from '#shared/types/database-relations'
import type { ComplementGroupDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<ComplementGroupDto[]> => {
  const { client, establishment } = await requireEstablishment(event)

  const { data, error } = await client
    .from('complement_groups')
    .select('*, complement_options(*)')
    .eq('establishment_id', establishment.id)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    logServerError('admin.complement-groups.list', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível carregar os complementos.' })
  }

  return (data as ComplementGroupRowWithOptions[]).map(toComplementGroupDto)
})
