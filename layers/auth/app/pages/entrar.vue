<script setup lang="ts">
import { toast } from '#layers/base/app/components/ui/sonner'
import { loginSchema } from '#shared/schemas/auth.schema'

definePageMeta({ layout: false })

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')

async function onSubmit() {
  errorMessage.value = ''
  const parsed = loginSchema.safeParse({ email: email.value, password: password.value })
  if (!parsed.success) {
    errorMessage.value = 'Informe um e-mail válido e uma senha com pelo menos 8 caracteres.'
    return
  }

  submitting.value = true
  try {
    await auth.login(parsed.data)
    toast.success('Login realizado com sucesso.')
    await router.push('/admin')
  }
  catch (error) {
    errorMessage.value = getErrorMessage(error) ?? 'Não foi possível entrar. Tente novamente.'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-svh items-center justify-center bg-background px-6">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle class="text-xl">Entrar</CardTitle>
        <CardDescription>Acesse o painel do seu estabelecimento.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="onSubmit">
          <div class="space-y-1.5">
            <Label for="email">E-mail</Label>
            <Input id="email" v-model="email" type="email" autocomplete="email" required placeholder="voce@exemplo.com" />
          </div>
          <div class="space-y-1.5">
            <Label for="password">Senha</Label>
            <Input id="password" v-model="password" type="password" autocomplete="current-password" required placeholder="••••••••" />
          </div>
          <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
          <Button type="submit" class="w-full" :disabled="submitting">
            {{ submitting ? 'Entrando...' : 'Entrar' }}
          </Button>
        </form>
      </CardContent>
      <CardFooter class="justify-center text-sm text-muted-foreground">
        Ainda não tem conta?
        <NuxtLink to="/cadastrar" class="ml-1 font-medium text-primary hover:underline">
          Criar conta
        </NuxtLink>
      </CardFooter>
    </Card>
  </main>
</template>
