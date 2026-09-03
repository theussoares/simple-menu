<script setup lang="ts">
import { Toaster } from '#layers/base/app/components/ui/sonner'
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Toaster position="top-center" rich-colors close-button />
  </div>
</template>
