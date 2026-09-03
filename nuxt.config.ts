import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  extends: ['./layers/base', './layers/auth', './layers/admin', './layers/menu'],

  vite: {
    plugins: [tailwindcss()],
  },

  nitro: {
    // Server responses never leak internal error details to the client.
    experimental: {
      asyncContext: true,
    },
  },

  routeRules: {
    '/cardapio/**': { headers: { 'x-robots-tag': 'noindex' } },
  },

  typescript: {
    strict: true,
  },
})
