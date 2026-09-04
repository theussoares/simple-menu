import { defineStore } from 'pinia'
import type { CategoryDto } from '#shared/types/domain'
import type { CategoryInput } from '#shared/schemas/category.schema'

export const useCategoriesStore = defineStore('admin-categories', {
  state: () => ({
    items: [] as CategoryDto[],
    loaded: false,
    loading: false,
  }),

  actions: {
    async fetchAll(fetcher: typeof $fetch = $fetch) {
      this.loading = true
      try {
        this.items = await fetcher<CategoryDto[]>('/api/admin/categories')
        this.loaded = true
      }
      finally {
        this.loading = false
      }
    },

    async create(input: CategoryInput) {
      const category = await $fetch<CategoryDto>('/api/admin/categories', {
        method: 'POST',
        body: input,
      })
      this.items.push(category)
      return category
    },

    async update(id: string, input: CategoryInput) {
      const category = await $fetch<CategoryDto>(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        body: input,
      })
      const index = this.items.findIndex((item) => item.id === id)
      if (index !== -1) this.items[index] = category
      return category
    },

    async remove(id: string) {
      await $fetch(`/api/admin/categories/${id}`, { method: 'DELETE' })
      this.items = this.items.filter((item) => item.id !== id)
    },
  },
})
