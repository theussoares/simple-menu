import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event): Promise<{ url: string }> => {
  const { client, establishment } = await requireEstablishment(event)
  const url = await uploadImageToStorage(event, client, establishment.id, 'cover-', 'admin.establishment.upload-cover')
  return { url }
})
