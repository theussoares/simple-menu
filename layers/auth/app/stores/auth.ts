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
    async fetchSession() {
      // /api/auth/me sends 204 (empty body) when there's no session, which
      // ofetch surfaces as `undefined` rather than `null` - normalize it so
      // `isAuthenticated` (state.user !== null) can't be fooled by that.
      this.user = (await $fetch<SessionUserDto | null>('/api/auth/me')) ?? null
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
