<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();

function goHome() {
  clearError({ redirect: "/" });
}
</script>

<template>
  <main
    class="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center"
  >
    <p class="text-sm font-medium text-primary">{{ props.error.statusCode }}</p>
    <h1 class="text-2xl font-semibold">
      {{
        props.error.statusCode === 404
          ? "Página não encontrada"
          : "Algo deu errado"
      }}
    </h1>
    <p class="max-w-sm text-sm text-muted-foreground">
      {{ props.error.statusMessage || "Tente novamente em instantes." }}
    </p>
    {{ props.error?.stack }}
    <Button @click="goHome">Voltar ao início</Button>
  </main>
</template>
