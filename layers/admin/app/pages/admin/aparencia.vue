<script setup lang="ts">
import { toast } from '#layers/base/app/components/ui/sonner'
import { updateEstablishmentAppearanceSchema } from '#shared/schemas/establishment.schema'
import type { EstablishmentDto } from '#shared/types/domain'

definePageMeta({
  middleware: ['auth', 'has-establishment'],
  layout: 'admin',
})

const auth = useAuthStore()

const coverImageUrl = ref(auth.user?.establishment?.coverImageUrl ?? '')
const submitting = ref(false)
const errorMessage = ref('')

async function onSubmit() {
  errorMessage.value = ''
  const parsed = updateEstablishmentAppearanceSchema.safeParse({ coverImageUrl: coverImageUrl.value })
  if (!parsed.success) {
    errorMessage.value = 'Informe uma URL de imagem válida.'
    return
  }

  submitting.value = true
  try {
    const establishment = await $fetch<EstablishmentDto>('/api/admin/establishment', {
      method: 'PATCH',
      body: parsed.data,
    })
    auth.setEstablishment(establishment)
    toast.success('Aparência atualizada.')
  }
  catch (error) {
    errorMessage.value = getErrorMessage(error) ?? 'Não foi possível salvar.'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-xl space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Aparência do cardápio</h1>
      <p class="text-sm text-muted-foreground">Personalize o banner que aparece no topo do seu cardápio digital.</p>
    </div>

    <Card>
      <CardContent class="pt-6">
        <form class="space-y-4" @submit.prevent="onSubmit">
          <div class="space-y-1.5">
            <Label for="cover-image">URL da imagem de capa</Label>
            <Input id="cover-image" v-model="coverImageUrl" type="url" placeholder="https://..." />
            <p class="text-xs text-muted-foreground">
              Recomendado: imagem larga (16:9), pelo menos 1200px de largura.
            </p>
          </div>

          <img
            v-if="coverImageUrl"
            :src="coverImageUrl"
            alt="Pré-visualização da capa"
            class="aspect-video w-full rounded-md border object-cover"
          >

          <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

          <Button type="submit" :disabled="submitting">
            {{ submitting ? 'Salvando...' : 'Salvar' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
