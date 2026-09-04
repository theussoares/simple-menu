<script setup lang="ts">
import {
  ArrowLeft,
  ChevronDown,
  ImageOff,
  Search,
  SearchX,
  Star,
  X,
} from "@lucide/vue";
import { cn } from "#layers/base/app/lib/utils";
import type { PublicMenuDto, PublicMenuProductDto } from "#shared/types/domain";

definePageMeta({ layout: false });

const route = useRoute();
const slug = String(route.params.slug);
// Widened to `string` on purpose: a template-literal URL here makes the
// compiler match it against every typed API route, which blows the stack.
const menuEndpoint: string = `/api/menu/${slug}`;

const { data: menu, error } = await useAsyncData<PublicMenuDto>(
  `menu-${slug}`,
  () => $fetch<PublicMenuDto>(menuEndpoint),
);

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: "Cardápio não encontrado.",
    fatal: true,
  });
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function categorySlug(category: string) {
  return `categoria-${normalize(category).replace(/[^a-z0-9]+/g, "-")}`;
}

function discountPercent(product: PublicMenuProductDto) {
  if (!product.promoPrice) return null;
  const pct = Math.round((1 - product.promoPrice / product.price) * 100);
  return pct > 0 ? pct : null;
}

const itemCountLabel = computed(() => {
  const count = menu.value?.products.length ?? 0;
  return `${count} ${count === 1 ? "item" : "itens"} no cardápio`;
});

const searchQuery = ref("");

const filteredProducts = computed(() => {
  const products = menu.value?.products ?? [];
  const query = normalize(searchQuery.value.trim());
  if (!query) return products;
  return products.filter((product) => {
    const haystack = normalize(`${product.name} ${product.description ?? ""}`);
    return haystack.includes(query);
  });
});

const featuredProducts = computed(() =>
  filteredProducts.value.filter((product) => product.isFeatured),
);
const promoProducts = computed(() =>
  filteredProducts.value.filter((product) => product.promoPrice != null),
);

const categories = computed(() => {
  const groups = new Map<string, PublicMenuProductDto[]>();

  for (const product of filteredProducts.value) {
    const key = product.category?.name ?? "Cardápio";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(product);
  }

  return Array.from(groups.entries());
});

const allCategoryNames = computed(() => {
  const names = new Set<string>();
  for (const product of menu.value?.products ?? []) {
    names.add(product.category?.name ?? "Cardápio");
  }
  return Array.from(names);
});

// Sections default to expanded; collapsing one hides its products but
// keeps it in the category nav so the user can reopen it.
const collapsedCategories = reactive<Record<string, boolean>>({});

function toggleCategory(category: string) {
  collapsedCategories[category] = !collapsedCategories[category];
}

const activeCategory = ref("");
let observer: IntersectionObserver | null = null;

function observeSections() {
  observer?.disconnect();
  if (typeof IntersectionObserver === "undefined") return;

  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting);
      if (visible.length === 0) return;
      const topMost = visible.reduce((a, b) =>
        a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
      );
      const name = topMost.target.getAttribute("data-category");
      if (name) activeCategory.value = name;
    },
    { rootMargin: "-140px 0px -70% 0px", threshold: 0 },
  );

  for (const [category] of categories.value) {
    const el = document.getElementById(categorySlug(category));
    if (el) observer.observe(el);
  }
}

onMounted(() => {
  activeCategory.value = allCategoryNames.value[0] ?? "";
  nextTick(observeSections);
});

watch(categories, () => nextTick(observeSections));
onBeforeUnmount(() => observer?.disconnect());

function scrollToCategory(category: string) {
  if (collapsedCategories[category]) collapsedCategories[category] = false;
  const el = document.getElementById(categorySlug(category));
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const selectedProduct = ref<PublicMenuProductDto | null>(null);
const detailOpen = ref(false);

function openDetail(product: PublicMenuProductDto) {
  selectedProduct.value = product;
  detailOpen.value = true;
}

useHead({
  title: menu.value
    ? `${menu.value.establishment.name} · Cardápio`
    : "Cardápio",
});
</script>

<template>
  <main
    v-if="menu"
    class="mx-auto min-h-svh max-w-lg bg-background pb-20 lg:max-w-5xl"
  >
    <header
      class="relative flex h-52 flex-col items-center justify-end gap-1.5 overflow-hidden bg-gradient-to-br from-primary via-primary to-accent bg-cover bg-center px-5 pb-5 text-center sm:h-64 lg:h-72"
      :style="
        menu.establishment.coverImageUrl
          ? { backgroundImage: `url(${menu.establishment.coverImageUrl})` }
          : undefined
      "
    >
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10"
      />
      <div class="relative flex flex-col items-center gap-1.5">
        <div
          class="flex size-16 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/90 bg-primary text-lg font-bold text-primary-foreground shadow-lg sm:size-20 sm:text-2xl"
        >
          <img
            v-if="menu.establishment.logoUrl"
            :src="menu.establishment.logoUrl"
            :alt="menu.establishment.name"
            class="size-full object-cover"
          >
          <span v-else>{{ menu.establishment.name.charAt(0).toUpperCase() }}</span>
        </div>
        <h1
          class="text-2xl font-bold tracking-tight text-white drop-shadow-sm sm:text-3xl"
        >
          {{ menu.establishment.name }}
        </h1>
        <div
          class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-white/85"
        >
          <span v-if="menu.establishment.segment">{{
            menu.establishment.segment
          }}</span>
          <span v-if="menu.establishment.segment" aria-hidden="true">·</span>
          <span>{{ itemCountLabel }}</span>
        </div>
      </div>
    </header>

    <div
      class="sticky top-0 z-10 space-y-3 border-b bg-background/95 px-5 py-3 backdrop-blur lg:px-8"
    >
      <div class="relative">
        <Search
          class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Buscar no cardápio"
          class="h-11 w-full rounded-full border border-input bg-muted/40 pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:max-w-sm"
        />
        <button
          v-if="searchQuery"
          type="button"
          aria-label="Limpar busca"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          @click="searchQuery = ''"
        >
          <X class="size-4" />
        </button>
      </div>

      <div
        v-if="allCategoryNames.length > 1"
        class="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <button
          v-for="category in allCategoryNames"
          :key="category"
          type="button"
          class="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors"
          :class="
            activeCategory === category
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
          "
          @click="scrollToCategory(category)"
        >
          {{ category }}
        </button>
      </div>
    </div>

    <div
      v-if="menu.products.length === 0"
      class="flex flex-col items-center gap-3 px-5 py-20 text-center"
    >
      <ImageOff class="size-8 text-muted-foreground/50" />
      <p class="text-sm text-muted-foreground">
        Nenhum item disponível no momento.
      </p>
    </div>

    <div
      v-else-if="filteredProducts.length === 0"
      class="flex flex-col items-center gap-3 px-5 py-20 text-center"
    >
      <SearchX class="size-8 text-muted-foreground/50" />
      <p class="text-sm text-muted-foreground">
        Nenhum item encontrado para "{{ searchQuery }}".
      </p>
    </div>

    <template v-else>
      <section v-if="promoProducts.length > 0" class="pt-6">
        <h2
          class="mb-3 px-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground lg:px-8"
        >
          Promoções
        </h2>
        <ul
          class="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-8 [&::-webkit-scrollbar]:hidden"
        >
          <li
            v-for="product in promoProducts"
            :key="product.id"
            class="relative w-60 shrink-0 cursor-pointer overflow-hidden rounded-2xl shadow-sm transition-transform active:scale-[0.98]"
            @click="openDetail(product)"
          >
            <div
              class="relative flex aspect-[16/10] items-center justify-center bg-muted"
            >
              <img
                v-if="product.imageUrl"
                :src="product.imageUrl"
                :alt="product.name"
                class="size-full object-cover"
                loading="lazy"
              />
              <span
                v-else
                class="flex size-full items-center justify-center bg-gradient-to-br from-accent to-secondary text-2xl font-semibold text-accent-foreground"
              >
                {{ product.name.charAt(0) }}
              </span>
              <div
                class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"
              />
              <span
                v-if="discountPercent(product)"
                class="absolute left-2.5 top-2.5 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground shadow-sm"
              >
                -{{ discountPercent(product) }}%
              </span>
              <div class="absolute inset-x-0 bottom-0 p-3">
                <p class="line-clamp-1 text-sm font-semibold text-white">
                  {{ product.name }}
                </p>
                <div class="mt-0.5 flex items-baseline gap-1.5">
                  <span class="text-xs text-white/60 line-through">{{
                    formatCurrency(product.price)
                  }}</span>
                  <span class="text-sm font-bold text-white">{{
                    formatCurrency(product.promoPrice!)
                  }}</span>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="featuredProducts.length > 0" class="pt-7">
        <h2
          class="mb-3 flex items-center gap-1.5 px-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground lg:px-8"
        >
          <Star class="size-3.5 fill-primary text-primary" />
          Destaques
        </h2>
        <ul
          class="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-8 [&::-webkit-scrollbar]:hidden"
        >
          <li
            v-for="product in featuredProducts"
            :key="product.id"
            class="w-40 shrink-0 cursor-pointer overflow-hidden rounded-2xl border bg-card shadow-sm transition-transform active:scale-[0.98] hover:shadow-md"
            @click="openDetail(product)"
          >
            <div
              class="relative flex aspect-square items-center justify-center bg-muted"
            >
              <img
                v-if="product.imageUrl"
                :src="product.imageUrl"
                :alt="product.name"
                class="size-full object-cover"
                loading="lazy"
              />
              <span
                v-else
                class="flex size-full items-center justify-center bg-gradient-to-br from-accent to-secondary text-2xl font-semibold text-accent-foreground"
              >
                {{ product.name.charAt(0) }}
              </span>
            </div>
            <div class="p-2.5">
              <p class="line-clamp-1 text-sm font-medium leading-snug">
                {{ product.name }}
              </p>
              <p class="mt-1 text-sm font-semibold text-primary">
                {{ formatCurrency(product.promoPrice ?? product.price) }}
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section
        v-for="[category, products] in categories"
        :id="categorySlug(category)"
        :key="category"
        :data-category="category"
        class="scroll-mt-32 px-5 pt-7 lg:px-8"
      >
        <button
          type="button"
          class="mb-3 flex w-full items-center justify-between text-left"
          @click="toggleCategory(category)"
        >
          <h2
            class="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {{ category }}
            <span class="ml-1 font-normal text-muted-foreground/60"
              >({{ products.length }})</span
            >
          </h2>
          <ChevronDown
            class="size-4 text-muted-foreground transition-transform"
            :class="collapsedCategories[category] ? '-rotate-90' : ''"
          />
        </button>
        <ul
          v-show="!collapsedCategories[category]"
          class="grid grid-cols-1 gap-2.5 lg:grid-cols-2"
        >
          <li
            v-for="product in products"
            :key="product.id"
            class="flex cursor-pointer gap-3 rounded-2xl border border-border/60 bg-card p-2.5 transition-all active:scale-[0.98] hover:border-border hover:shadow-md"
            @click="openDetail(product)"
          >
            <div
              class="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted"
            >
              <img
                v-if="product.imageUrl"
                :src="product.imageUrl"
                :alt="product.name"
                class="size-full object-cover"
                loading="lazy"
              />
              <span
                v-else
                class="flex size-full items-center justify-center bg-gradient-to-br from-accent to-secondary text-xl font-semibold text-accent-foreground"
              >
                {{ product.name.charAt(0) }}
              </span>
              <span
                v-if="discountPercent(product)"
                class="absolute left-1 top-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground shadow-sm"
              >
                -{{ discountPercent(product) }}%
              </span>
            </div>
            <div class="flex min-w-0 flex-1 flex-col justify-between py-0.5">
              <div class="min-w-0">
                <p class="font-semibold leading-snug text-foreground">
                  {{ product.name }}
                </p>
                <p
                  v-if="product.description"
                  class="mt-0.5 line-clamp-2 text-sm text-muted-foreground"
                >
                  {{ product.description }}
                </p>
              </div>
              <div class="flex items-baseline gap-1.5 pt-1">
                <p
                  v-if="product.promoPrice"
                  class="text-xs text-muted-foreground line-through"
                >
                  {{ formatCurrency(product.price) }}
                </p>
                <p class="text-base font-bold text-foreground">
                  {{ formatCurrency(product.promoPrice ?? product.price) }}
                </p>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <Dialog v-model:open="detailOpen">
      <DialogContent
        v-if="selectedProduct"
        hide-close
        :class="
          cn(
            'fixed inset-x-0 bottom-0 top-auto left-0 z-50 flex max-h-[88vh] w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-3xl border-0 bg-background p-0 shadow-2xl duration-300',
            'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
            'sm:inset-0 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border',
            'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0',
          )
        "
      >
        <div class="relative h-60 shrink-0 overflow-hidden bg-muted sm:h-56">
          <img
            v-if="selectedProduct.imageUrl"
            :src="selectedProduct.imageUrl"
            :alt="selectedProduct.name"
            class="size-full object-cover"
          />
          <div
            v-else
            class="flex size-full items-center justify-center bg-gradient-to-br from-accent to-secondary"
          >
            <span class="text-4xl font-semibold text-accent-foreground">{{
              selectedProduct.name.charAt(0)
            }}</span>
          </div>
          <DialogClose
            class="absolute left-3 top-3 flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur hover:bg-background"
            aria-label="Voltar"
          >
            <ArrowLeft class="size-4" />
          </DialogClose>
          <span
            v-if="discountPercent(selectedProduct)"
            class="absolute right-3 top-3 rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground shadow-sm"
          >
            -{{ discountPercent(selectedProduct) }}%
          </span>
        </div>

        <div
          class="-mt-5 flex-1 space-y-4 overflow-y-auto rounded-t-3xl bg-background p-5 sm:mt-0 sm:rounded-none sm:p-6"
        >
          <div class="mx-auto h-1.5 w-10 rounded-full bg-muted sm:hidden" />

          <DialogHeader class="space-y-1.5 text-left">
            <p
              v-if="selectedProduct.category"
              class="text-xs font-semibold uppercase tracking-wider text-primary"
            >
              {{ selectedProduct.category.name }}
            </p>
            <DialogTitle class="text-xl font-bold leading-snug">{{
              selectedProduct.name
            }}</DialogTitle>
          </DialogHeader>

          <p
            v-if="selectedProduct.description"
            class="text-sm leading-relaxed text-muted-foreground"
          >
            {{ selectedProduct.description }}
          </p>

          <div class="flex items-center gap-2 border-t pt-4">
            <p
              v-if="selectedProduct.promoPrice"
              class="text-sm text-muted-foreground line-through"
            >
              {{ formatCurrency(selectedProduct.price) }}
            </p>
            <p class="text-2xl font-bold text-primary">
              {{
                formatCurrency(
                  selectedProduct.promoPrice ?? selectedProduct.price,
                )
              }}
            </p>
          </div>
          <div
            v-if="selectedProduct.complementGroups.length > 0"
            class="space-y-2 border-t pt-3"
          >
            <div
              v-for="group in selectedProduct.complementGroups"
              :key="group.id"
              class="text-sm"
            >
              <p class="font-medium text-foreground">
                {{ group.name
                }}<span v-if="group.isRequired" class="text-muted-foreground">
                  (obrigatório)</span
                >
              </p>
              <p class="text-muted-foreground">
                <span v-for="(option, index) in group.options" :key="option.id">
                  {{ option.name
                  }}<template v-if="option.priceDelta > 0">
                    (+{{ formatCurrency(option.priceDelta) }})</template
                  >{{ index < group.options.length - 1 ? " · " : "" }}
                </span>
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </main>
</template>
