<script setup lang="ts">
definePageMeta({
  middleware: [
    'auth',
    async () => {
      const auth = useAuthStore()
      if (!auth.loaded) await auth.fetchSession()
      return navigateTo(auth.hasEstablishment ? '/admin/produtos' : '/admin/configuracao')
    },
  ],
})
</script>

<template>
  <div />
</template>
