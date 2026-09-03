<script setup lang="ts">
import { Pencil, Plus, QrCode, Trash2 } from '@lucide/vue'
import type { ProductDto } from '#shared/types/domain'

definePageMeta({
  middleware: ['auth', 'has-establishment'],
  layout: 'admin',
})

const auth = useAuthStore()
const store = useProductsStore()

const requestFetch = useRequestFetch() as typeof $fetch
await useAsyncData('admin-products', () => store.fetchAll(requestFetch))

const formOpen = ref(false)
const deleteOpen = ref(false)
const activeProduct = ref<ProductDto | null>(null)

function openCreate() {
  activeProduct.value = null
  formOpen.value = true
}

function openEdit(product: ProductDto) {
  activeProduct.value = product
  formOpen.value = true
}

function openDelete(product: ProductDto) {
  activeProduct.value = product
  deleteOpen.value = true
}

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
      <div class="flex items-center gap-2">
        <NuxtLink
          v-if="menuUrl"
          :to="menuUrl"
          target="_blank"
          class="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <QrCode class="size-4" />
          Ver cardápio
        </NuxtLink>
        <Button class="gap-2" @click="openCreate">
          <Plus class="size-4" />
          Novo produto
        </Button>
      </div>
    </div>

    <Card>
      <CardContent class="p-0">
        <div v-if="store.loading && !store.loaded" class="space-y-2 p-6">
          <div class="h-10 animate-pulse rounded-md bg-muted" />
          <div class="h-10 animate-pulse rounded-md bg-muted" />
          <div class="h-10 animate-pulse rounded-md bg-muted" />
        </div>

        <div v-else-if="store.items.length === 0" class="flex flex-col items-center gap-3 p-12 text-center">
          <p class="text-sm font-medium">Nenhum produto cadastrado ainda</p>
          <p class="max-w-sm text-sm text-muted-foreground">
            Adicione o primeiro item do seu cardápio para começar.
          </p>
          <Button class="gap-2" @click="openCreate">
            <Plus class="size-4" />
            Novo produto
          </Button>
        </div>

        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="product in store.items" :key="product.id">
              <TableCell>
                <p class="font-medium">{{ product.name }}</p>
                <p v-if="product.description" class="line-clamp-1 text-xs text-muted-foreground">
                  {{ product.description }}
                </p>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ product.category || '—' }}
              </TableCell>
              <TableCell>{{ formatCurrency(product.price) }}</TableCell>
              <TableCell>
                <Badge :variant="product.isActive ? 'success' : 'secondary'">
                  {{ product.isActive ? 'Ativo' : 'Inativo' }}
                </Badge>
              </TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" aria-label="Editar" @click="openEdit(product)">
                    <Pencil class="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Excluir" @click="openDelete(product)">
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <ProductFormDialog v-model="formOpen" :product="activeProduct" />
    <DeleteProductDialog v-model="deleteOpen" :product="activeProduct" />
  </div>
</template>
