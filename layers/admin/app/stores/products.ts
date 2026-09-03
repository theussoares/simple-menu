import { defineStore } from 'pinia'
import type { ProductDto } from '#shared/types/domain'
import type { ProductInput } from '#shared/schemas/product.schema'

export const useProductsStore = defineStore('admin-products', {
  state: () => ({
    items: [] as ProductDto[],
    loaded: false,
    loading: false,
  }),

  actions: {
    async fetchAll() {
      this.loading = true
      try {
        // See auth store's fetchSession() for why this needs
        // useRequestFetch() rather than the global $fetch: this action is
        // called from useAsyncData on page load, which runs on the server
        // and would otherwise send the request without the user's cookies.
        const requestFetch = useRequestFetch()
        this.items = await requestFetch<ProductDto[]>('/api/admin/products')
        this.loaded = true
      }
      finally {
        this.loading = false
      }
    },

    async create(input: ProductInput) {
      const product = await $fetch<ProductDto>('/api/admin/products', {
        method: 'POST',
        body: input,
      })
      this.items.unshift(product)
      return product
    },

    async update(id: string, input: ProductInput) {
      const product = await $fetch<ProductDto>(`/api/admin/products/${id}`, {
        method: 'PATCH',
        body: input,
      })
      const index = this.items.findIndex((item) => item.id === id)
      if (index !== -1) this.items[index] = product
      return product
    },

    async remove(id: string) {
      await $fetch(`/api/admin/products/${id}`, { method: 'DELETE' })
      this.items = this.items.filter((item) => item.id !== id)
    },
  },
})
