import { AlertDialogRoot, AlertDialogTrigger, DialogClose, DialogRoot, DialogTrigger } from 'reka-ui'

/**
 * Nuxt's component auto-import only scans .vue files, so re-exported
 * primitives (Dialog/AlertDialog root + trigger/close, aliased from
 * reka-ui in dialog/index.ts and alert-dialog/index.ts) never become
 * global components on their own - templates using <Dialog> etc. without
 * an explicit import silently render an inert custom element. Registering
 * them here makes them resolvable everywhere, matching how every other
 * ui/ component already behaves.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('Dialog', DialogRoot)
  nuxtApp.vueApp.component('DialogTrigger', DialogTrigger)
  nuxtApp.vueApp.component('DialogClose', DialogClose)
  nuxtApp.vueApp.component('AlertDialog', AlertDialogRoot)
  nuxtApp.vueApp.component('AlertDialogTrigger', AlertDialogTrigger)
})
