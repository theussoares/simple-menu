export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      establishments: {
        Row: {
          cover_image_url: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          segment: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          segment?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          segment?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'categories_establishment_id_fkey'
            columns: ['establishment_id']
            isOneToOne: false
            referencedRelation: 'establishments'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cost: number | null
          created_at: string
          description: string | null
          establishment_id: string
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          price: number
          promo_price: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          establishment_id: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          price: number
          promo_price?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          establishment_id?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price?: number
          promo_price?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_establishment_id_fkey'
            columns: ['establishment_id']
            isOneToOne: false
            referencedRelation: 'establishments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      complement_groups: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          is_required: boolean
          max_select: number | null
          min_select: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          is_required?: boolean
          max_select?: number | null
          min_select?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          is_required?: boolean
          max_select?: number | null
          min_select?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'complement_groups_establishment_id_fkey'
            columns: ['establishment_id']
            isOneToOne: false
            referencedRelation: 'establishments'
            referencedColumns: ['id']
          },
        ]
      }
      complement_options: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_active: boolean
          name: string
          price_delta: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_active?: boolean
          name: string
          price_delta?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price_delta?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'complement_options_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'complement_groups'
            referencedColumns: ['id']
          },
        ]
      }
      product_complement_groups: {
        Row: {
          group_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          group_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          group_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'product_complement_groups_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_complement_groups_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'complement_groups'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>
type DefaultSchema = DatabaseWithoutInternals['public']

export type Tables<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Update']
