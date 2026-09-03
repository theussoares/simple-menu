<script setup lang="ts">
import type { PublicMenuDto } from '#shared/types/domain'

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

const categories = computed(() => {
  const products = menu.value?.products ?? []
  const groups = new Map<string, typeof products>()

  for (const product of products) {
    const key = product.category?.trim() || 'Cardápio'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(product)
  }

  return Array.from(groups.entries())
})

useHead({
  title: menu.value ? `${menu.value.establishment.name} · Cardápio` : 'Cardápio',
})
</script>

<template>
  <main v-if="menu" class="mx-auto min-h-svh max-w-lg bg-background pb-16">
    <header class="border-b bg-secondary/40 px-5 py-6 text-center">
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cardápio digital</p>
      <h1 class="text-2xl font-semibold tracking-tight">{{ menu.establishment.name }}</h1>
    </header>

    <div v-if="menu.products.length === 0" class="px-5 py-16 text-center text-sm text-muted-foreground">
      Nenhum item disponível no momento.
    </div>

    <section v-for="[category, products] in categories" :key="category" class="px-5 pt-6">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {{ category }}
      </h2>
      <ul class="space-y-3">
        <li
          v-for="product in products"
          :key="product.id"
          class="flex gap-3 rounded-lg border bg-card p-3"
        >
          <img
            v-if="product.imageUrl"
            :src="product.imageUrl"
            :alt="product.name"
            class="size-16 shrink-0 rounded-md object-cover"
            loading="lazy"
          >
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p class="font-medium leading-snug">{{ product.name }}</p>
              <p class="shrink-0 font-semibold text-primary">{{ formatCurrency(product.price) }}</p>
            </div>
            <p v-if="product.description" class="mt-1 text-sm text-muted-foreground">
              {{ product.description }}
            </p>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>
