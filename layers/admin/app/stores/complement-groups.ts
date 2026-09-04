import { defineStore } from 'pinia'
import type { ComplementGroupDto } from '#shared/types/domain'
import type { ComplementGroupInput } from '#shared/schemas/complement-group.schema'

export const useComplementGroupsStore = defineStore('admin-complement-groups', {
  state: () => ({
    items: [] as ComplementGroupDto[],
    loaded: false,
    loading: false,
  }),

  actions: {
    async fetchAll(fetcher: typeof $fetch = $fetch) {
      this.loading = true
      try {
        this.items = await fetcher<ComplementGroupDto[]>('/api/admin/complement-groups')
        this.loaded = true
      }
      finally {
        this.loading = false
      }
    },

    async create(input: ComplementGroupInput) {
      const group = await $fetch<ComplementGroupDto>('/api/admin/complement-groups', {
        method: 'POST',
        body: input,
      })
      this.items.push(group)
      return group
    },

    async update(id: string, input: ComplementGroupInput) {
      const group = await $fetch<ComplementGroupDto>(`/api/admin/complement-groups/${id}`, {
        method: 'PATCH',
        body: input,
      })
      const index = this.items.findIndex((item) => item.id === id)
      if (index !== -1) this.items[index] = group
      return group
    },

    async remove(id: string) {
      await $fetch(`/api/admin/complement-groups/${id}`, { method: 'DELETE' })
      this.items = this.items.filter((item) => item.id !== id)
    },
  },
})
