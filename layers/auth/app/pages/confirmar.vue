<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const status = ref<'loading' | 'error'>('loading')
const errorMessage = ref('')

onMounted(async () => {
  const code = route.query.code
  if (typeof code !== 'string' || !code) {
    status.value = 'error'
    errorMessage.value = 'Link de confirmação inválido ou incompleto.'
    return
  }

  try {
    await $fetch('/api/auth/confirm', { method: 'POST', body: { code } })
    await auth.fetchSession()
    await router.push(auth.hasEstablishment ? '/admin/produtos' : '/admin/configuracao')
  }
  catch (error) {
    status.value = 'error'
    errorMessage.value = getErrorMessage(error) ?? 'Não foi possível confirmar seu e-mail.'
  }
})
</script>

<template>
  <main class="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
    <p v-if="status === 'loading'" class="text-sm text-muted-foreground">
      Confirmando seu e-mail...
    </p>
    <template v-else>
      <p class="text-sm text-destructive">{{ errorMessage }}</p>
      <NuxtLink to="/entrar" class="text-sm font-medium text-primary hover:underline">
        Ir para o login
      </NuxtLink>
    </template>
  </main>
</template>
