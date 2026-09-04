import { z } from 'zod'

export const createEstablishmentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  segment: z.string().trim().max(60).optional().or(z.literal('')),
})

export type CreateEstablishmentInput = z.infer<typeof createEstablishmentSchema>

export const updateEstablishmentAppearanceSchema = z.object({
  coverImageUrl: z.string().trim().url().max(2048).optional().or(z.literal('')),
  logoUrl: z.string().trim().url().max(2048).optional().or(z.literal('')),
})

export type UpdateEstablishmentAppearanceInput = z.infer<typeof updateEstablishmentAppearanceSchema>
