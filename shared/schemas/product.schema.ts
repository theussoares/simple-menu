import { z } from 'zod'

export const productSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional().or(z.literal('')),
    price: z.coerce.number().min(0).max(1_000_000),
    promoPrice: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
    cost: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
    category: z.string().trim().max(60).optional().or(z.literal('')),
    imageUrl: z.string().trim().url().max(2048).optional().or(z.literal('')),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .refine((data) => data.promoPrice == null || data.promoPrice < data.price, {
    message: 'O preço promocional deve ser menor que o preço normal.',
    path: ['promoPrice'],
  })

export type ProductInput = z.infer<typeof productSchema>

export const productIdParamSchema = z.object({
  id: z.string().uuid(),
})
