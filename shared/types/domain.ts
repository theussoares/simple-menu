export interface EstablishmentDto {
  id: string
  name: string
  slug: string
  segment: string | null
  coverImageUrl: string | null
  logoUrl: string | null
}

export interface CategoryDto {
  id: string
  establishmentId: string
  name: string
  sortOrder: number
}

export interface ComplementOptionDto {
  id: string
  name: string
  priceDelta: number
  isActive: boolean
  sortOrder: number
}

export interface ComplementGroupDto {
  id: string
  establishmentId: string
  name: string
  isRequired: boolean
  minSelect: number
  maxSelect: number | null
  sortOrder: number
  options: ComplementOptionDto[]
}

export interface ProductDto {
  id: string
  establishmentId: string
  name: string
  description: string | null
  price: number
  promoPrice: number | null
  cost: number | null
  categoryId: string | null
  imageUrl: string | null
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  complementGroupIds: string[]
  createdAt: string
  updatedAt: string
}

export interface PublicMenuCategoryDto {
  id: string
  name: string
}

export interface PublicMenuComplementOptionDto {
  id: string
  name: string
  priceDelta: number
}

export interface PublicMenuComplementGroupDto {
  id: string
  name: string
  isRequired: boolean
  options: PublicMenuComplementOptionDto[]
}

export interface PublicMenuProductDto {
  id: string
  name: string
  description: string | null
  price: number
  promoPrice: number | null
  category: PublicMenuCategoryDto | null
  imageUrl: string | null
  isFeatured: boolean
  complementGroups: PublicMenuComplementGroupDto[]
}

export interface PublicMenuDto {
  establishment: EstablishmentDto
  products: PublicMenuProductDto[]
}

export interface SessionUserDto {
  id: string
  email: string | null
  establishment: EstablishmentDto | null
}
