import type { Tables } from './database.types'

export interface ProductComplementOptionRow {
  id: string
  name: string
  price_delta: number
  is_active: boolean
  sort_order: number
}

export interface ProductComplementGroupRow {
  id: string
  name: string
  is_required: boolean
  complement_options: ProductComplementOptionRow[]
}

export interface ProductRowWithMenuRelations extends Tables<'products'> {
  categories: { id: string; name: string; sort_order: number } | null
  product_complement_groups: { complement_groups: ProductComplementGroupRow }[]
}

export interface ProductRowWithComplementGroupIds extends Tables<'products'> {
  product_complement_groups: { group_id: string }[]
}

export interface ComplementGroupRowWithOptions extends Tables<'complement_groups'> {
  complement_options: Tables<'complement_options'>[]
}
