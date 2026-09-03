<script setup lang="ts">
import { Search, Star, X } from '@lucide/vue'
import type { PublicMenuDto, PublicMenuProductDto } from '#shared/types/domain'

definePageMeta({ layout: false })

const route = useRoute()
const slug = String(route.params.slug)
// Widened to `string` on purpose: a template-literal URL here makes the
// compiler match it against every typed API route, which blows the stack.
const menuEndpoint: string = `/api/menu/${slug}`

const { data: menu, error } = await useAsyncData<PublicMenuDto>(`menu-${slug}`, () =>
  $fetch<PublicMenuDto>(menuEndpoint),
)

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: 'Cardápio não encontrado.',
    fatal: true,
  })
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function categorySlug(category: string) {
  return `categoria-${normalize(category).replace(/[^a-z0-9]+/g, '-')}`
}

const searchQuery = ref('')

const filteredProducts = computed(() => {
  const products = menu.value?.products ?? []
  const query = normalize(searchQuery.value.trim())
  if (!query) return products
  return products.filter((product) => {
    const haystack = normalize(`${product.name} ${product.description ?? ''}`)
    return haystack.includes(query)
  })
})

const featuredProducts = computed(() => filteredProducts.value.filter((product) => product.isFeatured))

const categories = computed(() => {
  const groups = new Map<string, PublicMenuProductDto[]>()

  for (const product of filteredProducts.value) {
    const key = product.category?.trim() || 'Cardápio'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(product)
  }

  return Array.from(groups.entries())
})

const allCategoryNames = computed(() => {
  const names = new Set<string>()
  for (const product of menu.value?.products ?? []) {
    names.add(product.category?.trim() || 'Cardápio')
  }
  return Array.from(names)
})

function scrollToCategory(category: string) {
  const el = document.getElementById(categorySlug(category))
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const selectedProduct = ref<PublicMenuProductDto | null>(null)
const detailOpen = ref(false)

function openDetail(product: PublicMenuProductDto) {
  selectedProduct.value = product
  detailOpen.value = true
}

useHead({
  title: menu.value ? `${menu.value.establishment.name} · Cardápio` : 'Cardápio',
})
</script>

<template>
  <main v-if="menu" class="mx-auto min-h-svh max-w-lg bg-background pb-16">
    <header
      class="relative flex flex-col items-center justify-end gap-1 bg-secondary/40 bg-cover bg-center px-5 pb-6 pt-10 text-center"
      :style="menu.establishment.coverImageUrl ? { backgroundImage: `url(${menu.establishment.coverImageUrl})` } : undefined"
    >
      <div v-if="menu.establishment.coverImageUrl" class="absolute inset-0 bg-black/45" />
      <div class="relative">
        <p
          class="text-xs font-medium uppercase tracking-wide"
          :class="menu.establishment.coverImageUrl ? 'text-white/80' : 'text-muted-foreground'"
        >
          Cardápio digital
        </p>
        <h1
          class="text-2xl font-semibold tracking-tight"
          :class="menu.establishment.coverImageUrl ? 'text-white' : 'text-foreground'"
        >
          {{ menu.establishment.name }}
        </h1>
      </div>
    </header>

    <div class="sticky top-0 z-10 space-y-3 border-b bg-background/95 px-5 py-3 backdrop-blur">
      <div class="relative">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Buscar no cardápio"
          class="h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-9 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
        <button
          v-if="searchQuery"
          type="button"
          aria-label="Limpar busca"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          @click="searchQuery = ''"
        >
          <X class="size-4" />
        </button>
      </div>

      <div v-if="allCategoryNames.length > 1" class="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
        <button
          v-for="category in allCategoryNames"
          :key="category"
          type="button"
          class="shrink-0 rounded-full border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="scrollToCategory(category)"
        >
          {{ category }}
        </button>
      </div>
    </div>

    <div v-if="menu.products.length === 0" class="px-5 py-16 text-center text-sm text-muted-foreground">
      Nenhum item disponível no momento.
    </div>

    <div v-else-if="filteredProducts.length === 0" class="px-5 py-16 text-center text-sm text-muted-foreground">
      Nenhum item encontrado para "{{ searchQuery }}".
    </div>

    <template v-else>
      <section v-if="featuredProducts.length > 0" class="pt-6">
        <h2 class="mb-3 flex items-center gap-1.5 px-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Star class="size-3.5 fill-primary text-primary" />
          Destaques
        </h2>
        <ul class="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
          <li
            v-for="product in featuredProducts"
            :key="product.id"
            class="w-40 shrink-0 cursor-pointer overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
            @click="openDetail(product)"
          >
            <div class="flex aspect-square items-center justify-center bg-muted">
              <img
                v-if="product.imageUrl"
                :src="product.imageUrl"
                :alt="product.name"
                class="size-full object-cover"
                loading="lazy"
              >
              <span v-else class="text-2xl font-semibold text-muted-foreground">{{ product.name.charAt(0) }}</span>
            </div>
            <div class="p-2.5">
              <p class="line-clamp-1 text-sm font-medium leading-snug">{{ product.name }}</p>
              <p class="mt-1 text-sm font-semibold text-primary">{{ formatCurrency(product.promoPrice ?? product.price) }}</p>
            </div>
          </li>
        </ul>
      </section>

      <section v-for="[category, products] in categories" :id="categorySlug(category)" :key="category" class="scroll-mt-32 px-5 pt-6">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {{ category }}
        </h2>
        <ul class="space-y-3">
          <li
            v-for="product in products"
            :key="product.id"
            class="flex cursor-pointer gap-3 rounded-lg border bg-card p-3 transition-shadow hover:shadow-md"
            @click="openDetail(product)"
          >
            <div class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
              <img
                v-if="product.imageUrl"
                :src="product.imageUrl"
                :alt="product.name"
                class="size-full object-cover"
                loading="lazy"
              >
              <span v-else class="text-lg font-semibold text-muted-foreground">{{ product.name.charAt(0) }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <p class="font-medium leading-snug">{{ product.name }}</p>
                <div class="shrink-0 text-right">
                  <p v-if="product.promoPrice" class="text-xs text-muted-foreground line-through">
                    {{ formatCurrency(product.price) }}
                  </p>
                  <p class="font-semibold text-primary">
                    {{ formatCurrency(product.promoPrice ?? product.price) }}
                  </p>
                </div>
              </div>
              <p v-if="product.description" class="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {{ product.description }}
              </p>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <Dialog v-model:open="detailOpen">
      <DialogContent v-if="selectedProduct" class="max-w-sm p-0">
        <div class="flex aspect-video items-center justify-center bg-muted">
          <img
            v-if="selectedProduct.imageUrl"
            :src="selectedProduct.imageUrl"
            :alt="selectedProduct.name"
            class="size-full object-cover"
          >
          <span v-else class="text-4xl font-semibold text-muted-foreground">{{ selectedProduct.name.charAt(0) }}</span>
        </div>
        <div class="space-y-3 p-5">
          <DialogHeader class="space-y-1 text-left">
            <DialogTitle>{{ selectedProduct.name }}</DialogTitle>
            <p v-if="selectedProduct.category" class="text-xs uppercase tracking-wide text-muted-foreground">
              {{ selectedProduct.category }}
            </p>
          </DialogHeader>
          <p v-if="selectedProduct.description" class="text-sm text-muted-foreground">
            {{ selectedProduct.description }}
          </p>
          <div class="flex items-baseline gap-2 pt-1">
            <p v-if="selectedProduct.promoPrice" class="text-sm text-muted-foreground line-through">
              {{ formatCurrency(selectedProduct.price) }}
            </p>
            <p class="text-xl font-semibold text-primary">
              {{ formatCurrency(selectedProduct.promoPrice ?? selectedProduct.price) }}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </main>
</template>
