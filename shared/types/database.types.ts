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
      products: {
        Row: {
          category: string | null
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
          category?: string | null
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
          category?: string | null
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
