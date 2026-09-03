<script setup lang="ts">
import { toast } from '#layers/base/app/components/ui/sonner'
import { registerSchema } from '#shared/schemas/auth.schema'

definePageMeta({ layout: false })

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const awaitingConfirmation = ref(false)

async function onSubmit() {
  errorMessage.value = ''

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'As senhas não coincidem.'
    return
  }

  const parsed = registerSchema.safeParse({ email: email.value, password: password.value })
  if (!parsed.success) {
    errorMessage.value = 'Informe um e-mail válido e uma senha com pelo menos 8 caracteres.'
    return
  }

  submitting.value = true
  try {
    const result = await auth.register(parsed.data)
    if (result.hasSession) {
      await auth.fetchSession()
      toast.success('Conta criada com sucesso.')
      await router.push('/admin/configuracao')
    }
    else {
      awaitingConfirmation.value = true
    }
  }
  catch (error) {
    errorMessage.value = getErrorMessage(error) ?? 'Não foi possível criar sua conta. Tente novamente.'
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
        <CardTitle class="text-xl">Criar conta</CardTitle>
        <CardDescription>Comece a montar o painel do seu estabelecimento.</CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="awaitingConfirmation" class="space-y-3 text-sm">
          <p>
            Enviamos um link de confirmação para <strong>{{ email }}</strong>.
            Verifique sua caixa de entrada para ativar a conta.
          </p>
          <NuxtLink to="/entrar" class="font-medium text-primary hover:underline">
            Voltar para o login
          </NuxtLink>
        </div>
        <form v-else class="space-y-4" @submit.prevent="onSubmit">
          <div class="space-y-1.5">
            <Label for="email">E-mail</Label>
            <Input id="email" v-model="email" type="email" autocomplete="email" required placeholder="voce@exemplo.com" />
          </div>
          <div class="space-y-1.5">
            <Label for="password">Senha</Label>
            <Input id="password" v-model="password" type="password" autocomplete="new-password" required placeholder="Mínimo de 8 caracteres" />
          </div>
          <div class="space-y-1.5">
            <Label for="confirmPassword">Confirmar senha</Label>
            <Input id="confirmPassword" v-model="confirmPassword" type="password" autocomplete="new-password" required />
          </div>
          <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
          <Button type="submit" class="w-full" :disabled="submitting">
            {{ submitting ? 'Criando...' : 'Criar conta' }}
          </Button>
        </form>
      </CardContent>
      <CardFooter class="justify-center text-sm text-muted-foreground">
        Já tem conta?
        <NuxtLink to="/entrar" class="ml-1 font-medium text-primary hover:underline">
          Entrar
        </NuxtLink>
      </CardFooter>
    </Card>
  </main>
</template>
