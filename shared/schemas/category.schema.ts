import { z } from 'zod'

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
})

export type CategoryInput = z.infer<typeof categorySchema>

export const categoryIdParamSchema = z.object({
  id: z.string().uuid(),
})
