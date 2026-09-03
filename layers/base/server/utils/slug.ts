import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'

const COMBINING_DIACRITICS_UNICODE_RANGE_START = 0x0300
const COMBINING_DIACRITICS_UNICODE_RANGE_END = 0x036f

function stripDiacritics(value: string): string {
  return Array.from(value.normalize('NFD'))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code < COMBINING_DIACRITICS_UNICODE_RANGE_START || code > COMBINING_DIACRITICS_UNICODE_RANGE_END
    })
    .join('')
}

export function slugify(input: string): string {
  const slug = stripDiacritics(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  return slug || 'estabelecimento'
}

/** Best-effort unique slug. The DB unique constraint is the real safety net. */
export async function generateUniqueSlug(client: SupabaseClient<Database>, name: string) {
  const base = slugify(name)
  const { data } = await client.from('establishments').select('id').eq('slug', base).maybeSingle()
  if (!data) return base
  return `${base}-${Math.random().toString(36).slice(2, 6)}`
}
