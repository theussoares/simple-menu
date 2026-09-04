import { fileURLToPath } from 'node:url'

const resolveInLayer = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineNuxtConfig({
  components: [
    {
      path: resolveInLayer('./app/components/admin'),
      extensions: ['.vue'],
      pathPrefix: false,
    },
  ],
})
