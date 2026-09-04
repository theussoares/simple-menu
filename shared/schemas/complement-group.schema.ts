import { z } from 'zod'

export const complementOptionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  priceDelta: z.coerce.number().min(0).max(100_000).default(0),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
})

export const complementGroupSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    isRequired: z.boolean().default(false),
    minSelect: z.coerce.number().int().min(0).max(50).default(0),
    maxSelect: z.coerce.number().int().min(0).max(50).nullable().default(null),
    sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
    options: z.array(complementOptionSchema).min(1, 'Adicione ao menos uma opção.'),
  })
  .refine((data) => !data.isRequired || data.minSelect >= 1, {
    message: 'Grupos obrigatórios precisam de no mínimo 1 seleção.',
    path: ['minSelect'],
  })
  .refine((data) => data.maxSelect === null || data.maxSelect >= data.minSelect, {
    message: 'O máximo não pode ser menor que o mínimo.',
    path: ['maxSelect'],
  })

export type ComplementGroupInput = z.infer<typeof complementGroupSchema>
export type ComplementOptionInput = z.infer<typeof complementOptionSchema>

export const complementGroupIdParamSchema = z.object({
  id: z.string().uuid(),
})
