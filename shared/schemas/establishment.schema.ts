import { z } from 'zod'

export const createEstablishmentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  segment: z.string().trim().max(60).optional().or(z.literal('')),
})

export type CreateEstablishmentInput = z.infer<typeof createEstablishmentSchema>
