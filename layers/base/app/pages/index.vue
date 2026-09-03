<script setup lang="ts">
definePageMeta({ layout: false })
</script>

<template>
  <main class="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
    <div class="space-y-2">
      <p class="text-sm font-medium text-primary">simple-menu</p>
      <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">
        O painel do seu estabelecimento
      </h1>
      <p class="mx-auto max-w-md text-muted-foreground">
        Cardápio digital, estoque e vendas em um só lugar. Simples de configurar,
        pronto para crescer com o seu negócio.
      </p>
    </div>
    <div class="flex flex-wrap items-center justify-center gap-3">
      <NuxtLink
        to="/entrar"
        class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
      >
        Entrar no painel
      </NuxtLink>
      <NuxtLink
        to="/cadastrar"
        class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Criar conta
      </NuxtLink>
    </div>
  </main>
</template>
