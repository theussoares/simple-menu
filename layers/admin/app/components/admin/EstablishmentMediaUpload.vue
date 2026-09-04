<script setup lang="ts">
import { ImagePlus, Loader2, X } from '@lucide/vue'
import { toast } from '#layers/base/app/components/ui/sonner'

const props = defineProps<{
  endpoint: string
  label: string
  hint: string
  shape: 'banner' | 'square'
  maxDimension?: number
}>()

const modelValue = defineModel<string>({ default: '' })

const fileInput = ref<HTMLInputElement | null>(null)
const localPreviewUrl = ref('')
const uploading = ref(false)
const sizeSummary = ref('')

const previewUrl = computed(() => localPreviewUrl.value || modelValue.value)

function openFilePicker() {
  fileInput.value?.click()
}

function clearImage() {
  modelValue.value = ''
  sizeSummary.value = ''
  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value)
    localPreviewUrl.value = ''
  }
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!file.type.startsWith('image/')) {
    toast.error('Selecione um arquivo de imagem.')
    return
  }

  uploading.value = true
  let previewSwapped = false
  try {
    const { blob, originalBytes, optimizedBytes } = await optimizeImageToWebp(file, props.maxDimension)

    if (localPreviewUrl.value) URL.revokeObjectURL(localPreviewUrl.value)
    localPreviewUrl.value = URL.createObjectURL(blob)
    sizeSummary.value = `${formatBytes(originalBytes)} → ${formatBytes(optimizedBytes)}`
    previewSwapped = true

    const formData = new FormData()
    formData.append('file', blob, 'image.webp')

    const { url } = await $fetch<{ url: string }>(props.endpoint, {
      method: 'POST',
      body: formData,
    })

    modelValue.value = url
  }
  catch (error) {
    if (previewSwapped) {
      URL.revokeObjectURL(localPreviewUrl.value)
      localPreviewUrl.value = ''
      sizeSummary.value = ''
    }
    toast.error(getErrorMessage(error) ?? 'Não foi possível enviar a imagem.')
  }
  finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="space-y-2">
    <Label>{{ label }}</Label>
    <div class="flex items-center gap-4">
      <button
        type="button"
        class="relative shrink-0 overflow-hidden border border-dashed border-input bg-muted/40 transition-colors hover:bg-muted disabled:pointer-events-none"
        :class="shape === 'banner' ? 'aspect-[21/9] w-full max-w-sm rounded-md' : 'flex size-24 items-center justify-center rounded-2xl'"
        :disabled="uploading"
        @click="openFilePicker"
      >
        <img v-if="previewUrl" :src="previewUrl" :alt="label" class="size-full object-cover">
        <ImagePlus v-else class="mx-auto size-6 text-muted-foreground" :class="shape === 'banner' ? 'absolute inset-0 m-auto' : ''" />
        <div v-if="uploading" class="absolute inset-0 flex items-center justify-center bg-background/70">
          <Loader2 class="size-5 animate-spin text-muted-foreground" />
        </div>
      </button>

      <div class="space-y-1 text-sm">
        <Button type="button" variant="outline" size="sm" :disabled="uploading" @click="openFilePicker">
          {{ previewUrl ? 'Trocar imagem' : 'Selecionar imagem' }}
        </Button>
        <Button
          v-if="previewUrl"
          type="button"
          variant="ghost"
          size="sm"
          class="gap-1 text-muted-foreground"
          :disabled="uploading"
          @click="clearImage"
        >
          <X class="size-3.5" />
          Remover
        </Button>
        <p class="text-xs text-muted-foreground">{{ hint }}</p>
        <p v-if="sizeSummary" class="text-xs text-muted-foreground">{{ sizeSummary }}</p>
      </div>
    </div>

    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileSelected">
  </div>
</template>
