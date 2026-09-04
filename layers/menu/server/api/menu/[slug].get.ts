import { createError, defineEventHandler, getRouterParams } from 'h3'
import { z } from 'zod'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import type { ProductRowWithMenuRelations } from '#shared/types/database-relations'
import type { PublicMenuDto } from '#shared/types/domain'

const slugParamSchema = z.object({
  slug: z.string().trim().min(1).max(80),
})

export default defineEventHandler(async (event): Promise<PublicMenuDto> => {
  const params = slugParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Cardápio inválido.' })
  }

  const client = await serverSupabaseClient<Database>(event)

  const { data: establishment, error: establishmentError } = await client
    .from('establishments')
    .select('*')
    .eq('slug', params.data.slug)
    .maybeSingle()

  if (establishmentError) {
    logServerError('menu.establishment.lookup', establishmentError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível carregar o cardápio.' })
  }
  if (!establishment) {
    throw createError({ statusCode: 404, statusMessage: 'Cardápio não encontrado.' })
  }

  const { data: products, error: productsError } = await client
    .from('products')
    .select(
      `*,
      categories (id, name, sort_order),
      product_complement_groups (
        complement_groups (
          id, name, is_required,
          complement_options (id, name, price_delta, is_active, sort_order)
        )
      )`,
    )
    .eq('establishment_id', establishment.id)
    .eq('is_active', true)

  if (productsError) {
    logServerError('menu.products.list', productsError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível carregar o cardápio.' })
  }

  const sorted = (products as unknown as ProductRowWithMenuRelations[]).slice().sort((a, b) => {
    const categoryOrder =
      (a.categories?.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.categories?.sort_order ?? Number.MAX_SAFE_INTEGER)
    if (categoryOrder !== 0) return categoryOrder
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.name.localeCompare(b.name)
  })

  return {
    establishment: toEstablishmentDto(establishment),
    products: sorted.map(toPublicMenuProductDto),
  }
})
