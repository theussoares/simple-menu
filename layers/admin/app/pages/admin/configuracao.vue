<script setup lang="ts">
import { toast } from '#layers/base/app/components/ui/sonner'
import { createEstablishmentSchema } from '#shared/schemas/establishment.schema'
import type { EstablishmentDto } from '#shared/types/domain'

definePageMeta({
  layout: false,
  middleware: [
    'auth',
    async () => {
      const auth = useAuthStore()
      if (!auth.loaded) await auth.fetchSession()
      if (auth.hasEstablishment) return navigateTo('/admin/produtos')
    },
  ],
})

const auth = useAuthStore()
const router = useRouter()

const name = ref('')
const segment = ref('')
const submitting = ref(false)
const errorMessage = ref('')

const segmentSuggestions = ['Restaurante', 'Bar', 'Cafeteria', 'Lanchonete', 'Pizzaria', 'Food truck']

async function onSubmit() {
  errorMessage.value = ''
  const parsed = createEstablishmentSchema.safeParse({ name: name.value, segment: segment.value })
  if (!parsed.success) {
    errorMessage.value = 'Informe um nome com pelo menos 2 caracteres.'
    return
  }

  submitting.value = true
  try {
    const establishment = await $fetch<EstablishmentDto>('/api/admin/establishment', {
      method: 'POST',
      body: parsed.data,
    })
    auth.setEstablishment(establishment)
    toast.success('Estabelecimento criado com sucesso.')
    await router.push('/admin/produtos')
  }
  catch (error) {
    errorMessage.value = getErrorMessage(error) ?? 'Não foi possível criar o estabelecimento.'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-svh items-center justify-center bg-background px-6">
    <Card class="w-full max-w-md">
      <CardHeader>
        <CardTitle class="text-xl">Vamos configurar seu estabelecimento</CardTitle>
        <CardDescription>
          Esses dados aparecem no seu cardápio digital. Você pode alterar depois.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="onSubmit">
          <div class="space-y-1.5">
            <Label for="name">Nome do estabelecimento</Label>
            <Input id="name" v-model="name" required placeholder="Ex: Bar do Zé" />
          </div>
          <div class="space-y-1.5">
            <Label for="segment">Tipo de negócio (opcional)</Label>
            <Input id="segment" v-model="segment" list="segment-suggestions" placeholder="Ex: Bar" />
            <datalist id="segment-suggestions">
              <option v-for="item in segmentSuggestions" :key="item" :value="item" />
            </datalist>
          </div>
          <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
          <Button type="submit" class="w-full" :disabled="submitting">
            {{ submitting ? 'Criando...' : 'Continuar' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </main>
</template>
