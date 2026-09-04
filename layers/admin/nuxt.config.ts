import { fileURLToPath } from 'node:url'

const resolveInLayer = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineNuxtConfig({
 // The base layer registers `components` as an explicit array, which disables
 // Nuxt's default `~/components` auto-scan for every extending layer. Register
 // this layer's own components dir the same way so its dialogs stay auto-imported.
 components: [
  {
   path: resolveInLayer('./app/components/admin'),
   pathPrefix: false,
  },
 ],
})
