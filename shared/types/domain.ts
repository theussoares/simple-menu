export interface EstablishmentDto {
  id: string
  name: string
  slug: string
  segment: string | null
  coverImageUrl: string | null
}

export interface ProductDto {
  id: string
  establishmentId: string
  name: string
  description: string | null
  price: number
  promoPrice: number | null
  cost: number | null
  category: string | null
  imageUrl: string | null
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface PublicMenuProductDto {
  id: string
  name: string
  description: string | null
  price: number
  promoPrice: number | null
  category: string | null
  imageUrl: string | null
  isFeatured: boolean
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
