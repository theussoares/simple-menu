<script setup lang="ts">
import { QrCode } from '@lucide/vue'
import { TabsContent, TabsList, TabsTrigger } from '#layers/base/app/components/ui/tabs'

definePageMeta({
  middleware: ['auth', 'has-establishment'],
  layout: 'admin',
})

const auth = useAuthStore()
const productsStore = useProductsStore()
const categoriesStore = useCategoriesStore()
const complementGroupsStore = useComplementGroupsStore()

const requestFetch = useRequestFetch() as typeof $fetch
await Promise.all([
  useAsyncData('admin-products', () => productsStore.fetchAll(requestFetch)),
  useAsyncData('admin-categories', () => categoriesStore.fetchAll(requestFetch)),
  useAsyncData('admin-complement-groups', () => complementGroupsStore.fetchAll(requestFetch)),
])

const menuUrl = computed(() => {
  const slug = auth.user?.establishment?.slug
  return slug ? `/cardapio/${slug}` : null
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Produtos</h1>
        <p class="text-sm text-muted-foreground">Gerencie o que aparece no seu cardápio digital.</p>
      </div>
      <NuxtLink
        v-if="menuUrl"
        :to="menuUrl"
        target="_blank"
        class="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <QrCode class="size-4" />
        Ver cardápio
      </NuxtLink>
    </div>

    <Tabs default-value="produtos">
      <TabsList>
        <TabsTrigger value="produtos">Produtos</TabsTrigger>
        <TabsTrigger value="categorias">Categorias</TabsTrigger>
        <TabsTrigger value="complementos">Complementos</TabsTrigger>
      </TabsList>
      <TabsContent value="produtos">
        <ProductsTab />
      </TabsContent>
      <TabsContent value="categorias">
        <CategoriesTab />
      </TabsContent>
      <TabsContent value="complementos">
        <ComplementGroupsTab />
      </TabsContent>
    </Tabs>
  </div>
</template>
