import { createError } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'

/**
 * Replaces a product's linked complement groups, silently dropping any id
 * that isn't a group owned by this establishment (defends against a
 * cross-establishment id slipping through, since RLS on the join table only
 * checks product ownership, not group ownership).
 */
export async function syncProductComplementGroups(
  client: SupabaseClient<Database>,
  establishmentId: string,
  productId: string,
  requestedGroupIds: string[],
): Promise<string[]> {
  let validGroupIds: string[] = []

  if (requestedGroupIds.length > 0) {
    const { data: ownedGroups, error: ownedGroupsError } = await client
      .from('complement_groups')
      .select('id')
      .eq('establishment_id', establishmentId)
      .in('id', requestedGroupIds)

    if (ownedGroupsError) {
      logServerError('product-complement-groups.validate', ownedGroupsError)
      throw createError({ statusCode: 500, statusMessage: 'Não foi possível validar os complementos.' })
    }

    validGroupIds = ownedGroups.map((group) => group.id)
  }

  const { error: deleteError } = await client.from('product_complement_groups').delete().eq('product_id', productId)
  if (deleteError) {
    logServerError('product-complement-groups.clear', deleteError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar os complementos do produto.' })
  }

  if (validGroupIds.length > 0) {
    const { error: insertError } = await client
      .from('product_complement_groups')
      .insert(validGroupIds.map((groupId, index) => ({ product_id: productId, group_id: groupId, sort_order: index })))

    if (insertError) {
      logServerError('product-complement-groups.insert', insertError)
      throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar os complementos do produto.' })
    }
  }

  return validGroupIds
}

/**
 * Resolves a category id against the caller's own categories, silently
 * falling back to null when it's missing, deleted, or belongs to another
 * establishment (a stale client can resend a category id that was just
 * unlinked server-side, and categories are fully public-read so a caller
 * could otherwise pass another establishment's id).
 */
export async function resolveCategoryId(
  client: SupabaseClient<Database>,
  establishmentId: string,
  categoryId: string | null,
): Promise<string | null> {
  if (!categoryId) return null

  const { data, error } = await client
    .from('categories')
    .select('id')
    .eq('establishment_id', establishmentId)
    .eq('id', categoryId)
    .maybeSingle()

  if (error) {
    logServerError('products.resolve-category', error)
    return null
  }

  return data?.id ?? null
}
