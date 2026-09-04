<script setup lang="ts">
import { ImagePlus, Loader2, X } from "@lucide/vue";
import { toast } from "#layers/base/app/components/ui/sonner";

const modelValue = defineModel<string>({ default: "" });

const fileInput = ref<HTMLInputElement | null>(null);
const localPreviewUrl = ref("");
const uploading = ref(false);
const sizeSummary = ref("");

const previewUrl = computed(() => localPreviewUrl.value || modelValue.value);

function openFilePicker() {
  fileInput.value?.click();
}

function clearImage() {
  modelValue.value = "";
  sizeSummary.value = "";
  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value);
    localPreviewUrl.value = "";
  }
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    toast.error("Selecione um arquivo de imagem.");
    return;
  }

  uploading.value = true;
  try {
    const { blob, originalBytes, optimizedBytes } = await optimizeImageToWebp(file);

    if (localPreviewUrl.value) URL.revokeObjectURL(localPreviewUrl.value);
    localPreviewUrl.value = URL.createObjectURL(blob);
    sizeSummary.value = `${formatBytes(originalBytes)} → ${formatBytes(optimizedBytes)}`;

    const formData = new FormData();
    formData.append("file", blob, "image.webp");

    const { url } = await $fetch<{ url: string }>("/api/admin/products/upload-image", {
      method: "POST",
      body: formData,
    });

    modelValue.value = url;
  } catch (error) {
    toast.error(getErrorMessage(error) ?? "Não foi possível enviar a imagem.");
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <div class="space-y-2">
    <Label>Foto do produto</Label>
    <div class="flex items-center gap-4">
      <button
        type="button"
        class="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-input bg-muted/40 transition-colors hover:bg-muted disabled:pointer-events-none"
        :disabled="uploading"
        @click="openFilePicker"
      >
        <img v-if="previewUrl" :src="previewUrl" alt="Pré-visualização do produto" class="size-full object-cover">
        <ImagePlus v-else class="size-6 text-muted-foreground" />
        <div v-if="uploading" class="absolute inset-0 flex items-center justify-center bg-background/70">
          <Loader2 class="size-5 animate-spin text-muted-foreground" />
        </div>
      </button>

      <div class="space-y-1 text-sm">
        <Button type="button" variant="outline" size="sm" :disabled="uploading" @click="openFilePicker">
          {{ previewUrl ? "Trocar foto" : "Selecionar foto" }}
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
        <p class="text-xs text-muted-foreground">
          Fotos aumentam a conversão do cardápio em até 40%. A imagem é otimizada automaticamente.
        </p>
        <p v-if="sizeSummary" class="text-xs text-muted-foreground">{{ sizeSummary }}</p>
      </div>
    </div>

    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileSelected">
  </div>
</template>
