import type { Tables } from '#shared/types/database.types'
import type { ProductDto, PublicMenuProductDto } from '#shared/types/domain'

export function toProductDto(row: Tables<'products'>): ProductDto {
  return {
    id: row.id,
    establishmentId: row.establishment_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    cost: row.cost === null ? null : Number(row.cost),
    category: row.category,
    imageUrl: row.image_url,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toPublicMenuProductDto(row: Tables<'products'>): PublicMenuProductDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    imageUrl: row.image_url,
  }
}
