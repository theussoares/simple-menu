import { fileURLToPath } from 'node:url'

const resolveInLayer = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineNuxtConfig({
  modules: ['@pinia/nuxt', '@nuxtjs/supabase'],

  // Keep this relative so @pinia/nuxt resolves it against each layer's own
  // app dir (layers/*/app/stores), not just the root app/stores.
  pinia: {
    storesDirs: ['./stores/**'],
  },

  css: [resolveInLayer('./app/assets/css/main.css')],

  components: [
    {
      path: resolveInLayer('./app/components/ui'),
      extensions: ['.vue'],
      pathPrefix: false,
    },
  ],

  supabase: {
    // Route protection is handled by our own `auth` / `has-establishment`
    // page middleware (backed by /api/auth/me), not the module's redirect.
    redirect: false,
    // We type every Supabase client call explicitly with our shared
    // Database type (from #shared/types/database.types), so the module
    // doesn't need to generate/locate its own copy.
    types: false,
  },
})
