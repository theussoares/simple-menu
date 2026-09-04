import type { Tables } from '#shared/types/database.types'
import type { ComplementGroupRowWithOptions, ProductRowWithMenuRelations } from '#shared/types/database-relations'
import type {
  CategoryDto,
  ComplementGroupDto,
  EstablishmentDto,
  ProductDto,
  PublicMenuProductDto,
} from '#shared/types/domain'

export function toEstablishmentDto(row: Tables<'establishments'>): EstablishmentDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    segment: row.segment,
    coverImageUrl: row.cover_image_url,
  }
}

export function toProductDto(row: Tables<'products'>, complementGroupIds: string[]): ProductDto {
  return {
    id: row.id,
    establishmentId: row.establishment_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    promoPrice: row.promo_price === null ? null : Number(row.promo_price),
    cost: row.cost === null ? null : Number(row.cost),
    categoryId: row.category_id,
    imageUrl: row.image_url,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    complementGroupIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toPublicMenuProductDto(row: ProductRowWithMenuRelations): PublicMenuProductDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    promoPrice: row.promo_price === null ? null : Number(row.promo_price),
    category: row.categories ? { id: row.categories.id, name: row.categories.name } : null,
    imageUrl: row.image_url,
    isFeatured: row.is_featured,
    complementGroups: row.product_complement_groups
      .map((link) => link.complement_groups)
      .map((group) => ({
        id: group.id,
        name: group.name,
        isRequired: group.is_required,
        options: group.complement_options
          .filter((option) => option.is_active)
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((option) => ({ id: option.id, name: option.name, priceDelta: Number(option.price_delta) })),
      }))
      .filter((group) => group.options.length > 0),
  }
}

export function toCategoryDto(row: Tables<'categories'>): CategoryDto {
  return {
    id: row.id,
    establishmentId: row.establishment_id,
    name: row.name,
    sortOrder: row.sort_order,
  }
}

export function toComplementGroupDto(row: ComplementGroupRowWithOptions): ComplementGroupDto {
  return {
    id: row.id,
    establishmentId: row.establishment_id,
    name: row.name,
    isRequired: row.is_required,
    minSelect: row.min_select,
    maxSelect: row.max_select,
    sortOrder: row.sort_order,
    options: row.complement_options
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((option) => ({
        id: option.id,
        name: option.name,
        priceDelta: Number(option.price_delta),
        isActive: option.is_active,
        sortOrder: option.sort_order,
      })),
  }
}
