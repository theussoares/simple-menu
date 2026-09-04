import { createError, readMultipartFormData, type H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'

const PUBLIC_URL_MARKER = '/storage/v1/object/public/product-images/'
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

/**
 * Parses a single-file multipart upload and stores it under
 * `${folder}/${filePrefix}<uuid>.webp` in the shared product-images bucket.
 * Used for product photos as well as establishment cover/logo images -
 * all owner-scoped by the same `${establishmentId}/...` RLS policy.
 */
export async function uploadImageToStorage(
  event: H3Event,
  client: SupabaseClient<Database>,
  folder: string,
  filePrefix: string,
  errorContext: string,
): Promise<string> {
  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file')

  if (!file || !file.data.length) {
    throw createError({ statusCode: 400, statusMessage: 'Nenhuma imagem enviada.' })
  }
  if (!file.type?.startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: 'Arquivo enviado não é uma imagem.' })
  }
  if (file.data.length > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Imagem muito grande.' })
  }

  const path = `${folder}/${filePrefix}${randomUUID()}.webp`

  const { error: uploadError } = await client.storage
    .from('product-images')
    .upload(path, file.data, { contentType: 'image/webp' })

  if (uploadError) {
    logServerError(errorContext, uploadError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível enviar a imagem.' })
  }

  return client.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

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
