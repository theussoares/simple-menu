<script setup lang="ts">
import { Image, LayoutGrid, LogOut, Package, QrCode } from '@lucide/vue'
import { toast } from '#layers/base/app/components/ui/sonner'

const auth = useAuthStore()
const router = useRouter()

const navItems = [
  { label: 'Produtos', to: '/admin/produtos', icon: Package, disabled: false },
  { label: 'Aparência', to: '/admin/aparencia', icon: Image, disabled: false },
  { label: 'Estoque', to: '#', icon: LayoutGrid, disabled: true },
  { label: 'Comandas', to: '#', icon: QrCode, disabled: true },
]

async function onLogout() {
  await auth.logout()
  toast.success('Você saiu da sua conta.')
  await router.push('/entrar')
}
</script>

<template>
  <div class="flex min-h-svh flex-col bg-muted/30 md:flex-row">
    <aside class="flex shrink-0 flex-col border-b bg-background md:w-60 md:border-b-0 md:border-r">
      <div class="flex items-center gap-2 border-b px-4 py-4">
        <div class="flex size-8 items-center justify-center overflow-hidden rounded-md bg-primary text-sm font-semibold text-primary-foreground">
          <img
            v-if="auth.user?.establishment?.logoUrl"
            :src="auth.user.establishment.logoUrl"
            :alt="auth.user.establishment.name"
            class="size-full object-cover"
          >
          <span v-else>{{ auth.user?.establishment?.name?.charAt(0)?.toUpperCase() ?? 'S' }}</span>
        </div>
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">{{ auth.user?.establishment?.name ?? 'simple-menu' }}</p>
          <p class="truncate text-xs text-muted-foreground">{{ auth.user?.email }}</p>
        </div>
      </div>

      <nav class="flex flex-1 flex-col gap-1 p-2">
        <NuxtLink
          v-for="item in navItems"
          :key="item.label"
          :to="item.disabled ? undefined : item.to"
          :aria-disabled="item.disabled"
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="
            item.disabled
              ? 'cursor-not-allowed text-muted-foreground/50'
              : 'text-foreground hover:bg-accent hover:text-accent-foreground'
          "
          active-class="bg-secondary text-secondary-foreground"
        >
          <component :is="item.icon" class="size-4" />
          {{ item.label }}
          <span v-if="item.disabled" class="ml-auto text-xs text-muted-foreground/50">em breve</span>
        </NuxtLink>
      </nav>

      <div class="border-t p-2">
        <Button variant="ghost" class="w-full justify-start gap-2 text-muted-foreground" @click="onLogout">
          <LogOut class="size-4" />
          Sair
        </Button>
      </div>
    </aside>

    <main class="flex-1 p-4 md:p-8">
      <slot />
    </main>
  </div>
</template>
