import { defineEventHandler } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import type { SessionUserDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<SessionUserDto | null> => {
  const client = await serverSupabaseClient<Database>(event)
  const { data: userData } = await client.auth.getUser()
  const user = userData.user
  if (!user) return null

  const { data: establishment } = await client
    .from('establishments')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    email: user.email ?? null,
    establishment: establishment ? toEstablishmentDto(establishment) : null,
  }
})
