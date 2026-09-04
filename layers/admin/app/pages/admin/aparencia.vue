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
const logoUrl = ref(auth.user?.establishment?.logoUrl ?? '')
const submitting = ref(false)
const errorMessage = ref('')

async function onSubmit() {
  errorMessage.value = ''
  const parsed = updateEstablishmentAppearanceSchema.safeParse({
    coverImageUrl: coverImageUrl.value,
    logoUrl: logoUrl.value,
  })
  if (!parsed.success) {
    errorMessage.value = 'Não foi possível salvar as imagens.'
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
      <p class="text-sm text-muted-foreground">Personalize a logo e o banner que aparecem no seu cardápio digital.</p>
    </div>

    <Card>
      <CardContent class="space-y-6 pt-6">
        <form class="space-y-6" @submit.prevent="onSubmit">
          <EstablishmentMediaUpload
            v-model="logoUrl"
            endpoint="/api/admin/establishment/logo"
            label="Logo"
            hint="Imagem quadrada, aparece no cabeçalho do cardápio e no painel."
            shape="square"
            :max-dimension="600"
          />

          <EstablishmentMediaUpload
            v-model="coverImageUrl"
            endpoint="/api/admin/establishment/cover-image"
            label="Banner de capa"
            hint="Imagem larga (recomendado 16:9), aparece no topo do cardápio."
            shape="banner"
            :max-dimension="1600"
          />

          <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

          <Button type="submit" :disabled="submitting">
            {{ submitting ? 'Salvando...' : 'Salvar' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
