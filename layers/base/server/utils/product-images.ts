import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'

const PUBLIC_URL_MARKER = '/storage/v1/object/public/product-images/'

/** Returns the storage path for a product image URL, or null if it wasn't uploaded to our bucket (e.g. a legacy external URL). */
export function extractProductImagePath(imageUrl: string): string | null {
  const index = imageUrl.indexOf(PUBLIC_URL_MARKER)
  if (index === -1) return null
  return imageUrl.slice(index + PUBLIC_URL_MARKER.length)
}

export async function deleteProductImageIfOwned(client: SupabaseClient<Database>, imageUrl: string | null) {
  if (!imageUrl) return
  const path = extractProductImagePath(imageUrl)
  if (!path) return

  const { error } = await client.storage.from('product-images').remove([path])
  if (error) logServerError('product-images.delete', error)
}
