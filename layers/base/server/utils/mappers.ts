import type { Tables } from '#shared/types/database.types'
import type { EstablishmentDto, ProductDto, PublicMenuProductDto } from '#shared/types/domain'

export function toEstablishmentDto(row: Tables<'establishments'>): EstablishmentDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    segment: row.segment,
    coverImageUrl: row.cover_image_url,
  }
}

export function toProductDto(row: Tables<'products'>): ProductDto {
  return {
    id: row.id,
    establishmentId: row.establishment_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    promoPrice: row.promo_price === null ? null : Number(row.promo_price),
    cost: row.cost === null ? null : Number(row.cost),
    category: row.category,
    imageUrl: row.image_url,
    isActive: row.is_active,
    isFeatured: row.is_featured,
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
    promoPrice: row.promo_price === null ? null : Number(row.promo_price),
    category: row.category,
    imageUrl: row.image_url,
    isFeatured: row.is_featured,
  }
}
