import { createError, defineEventHandler, getRouterParams } from 'h3'
import { z } from 'zod'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
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
    .select('id, name, slug, segment')
    .eq('slug', params.data.slug)
    .maybeSingle()

  if (establishmentError) {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível carregar o cardápio.' })
  }
  if (!establishment) {
    throw createError({ statusCode: 404, statusMessage: 'Cardápio não encontrado.' })
  }

  const { data: products, error: productsError } = await client
    .from('products')
    .select('*')
    .eq('establishment_id', establishment.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (productsError) {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível carregar o cardápio.' })
  }

  return {
    establishment,
    products: products.map(toPublicMenuProductDto),
  }
})
