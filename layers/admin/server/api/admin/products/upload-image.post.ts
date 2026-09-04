import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import { randomUUID } from 'node:crypto'

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

export default defineEventHandler(async (event): Promise<{ url: string }> => {
  const { client, establishment } = await requireEstablishment(event)

  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file')

  if (!file || !file.data.length) {
    throw createError({ statusCode: 400, statusMessage: 'Nenhuma imagem enviada.' })
  }
  if (file.type && !file.type.startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: 'Arquivo enviado não é uma imagem.' })
  }
  if (file.data.length > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Imagem muito grande.' })
  }

  const path = `${establishment.id}/${randomUUID()}.webp`

  const { error: uploadError } = await client.storage
    .from('product-images')
    .upload(path, file.data, { contentType: 'image/webp' })

  if (uploadError) {
    logServerError('admin.products.upload-image', uploadError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível enviar a imagem.' })
  }

  const { data } = client.storage.from('product-images').getPublicUrl(path)

  return { url: data.publicUrl }
})
