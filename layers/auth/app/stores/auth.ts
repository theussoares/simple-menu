import { defineStore } from 'pinia'
import type { SessionUserDto } from '#shared/types/domain'
import type { LoginInput, RegisterInput } from '#shared/schemas/auth.schema'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as SessionUserDto | null,
    loaded: false,
  }),

  getters: {
    isAuthenticated: (state) => state.user !== null,
    hasEstablishment: (state) => state.user?.establishment != null,
  },

  actions: {
    /**
     * On the server, plain $fetch doesn't forward the incoming request's
     * cookies, so a page load that runs this via SSR would see an anonymous
     * request and think nobody is logged in. useRequestFetch() forwards
     * them - but it must be obtained at the call site (middleware/page
     * setup), not from inside this action: Nuxt only instruments
     * <script setup> and middleware for context-preserving async calls,
     * not arbitrary Pinia actions, so calling it in here works during SSR
     * but throws during client hydration. Callers pass it in; we fall back
     * to the plain $fetch for calls that only ever happen client-side.
     */
    async fetchSession(fetcher: typeof $fetch = $fetch) {
      // /api/auth/me sends 204 (empty body) when there's no session, which
      // ofetch surfaces as `undefined` rather than `null` - normalize it so
      // `isAuthenticated` (state.user !== null) can't be fooled by that.
      this.user = (await fetcher<SessionUserDto | null>('/api/auth/me')) ?? null
      this.loaded = true
      return this.user
    },

    async login(payload: LoginInput) {
      await $fetch('/api/auth/login', { method: 'POST', body: payload })
      await this.fetchSession()
    },

    async register(payload: RegisterInput) {
      return await $fetch<{ hasSession: boolean }>('/api/auth/register', {
        method: 'POST',
        body: payload,
      })
    },

    async logout() {
      await $fetch('/api/auth/logout', { method: 'POST' })
      this.user = null
    },

    setEstablishment(establishment: NonNullable<SessionUserDto['establishment']>) {
      if (this.user) this.user.establishment = establishment
    },
  },
})
