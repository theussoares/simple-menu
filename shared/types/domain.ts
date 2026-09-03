export interface EstablishmentDto {
  id: string
  name: string
  slug: string
  segment: string | null
}

export interface ProductDto {
  id: string
  establishmentId: string
  name: string
  description: string | null
  price: number
  cost: number | null
  category: string | null
  imageUrl: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface PublicMenuProductDto {
  id: string
  name: string
  description: string | null
  price: number
  category: string | null
  imageUrl: string | null
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
