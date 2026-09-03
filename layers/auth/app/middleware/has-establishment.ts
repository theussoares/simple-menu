export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore()

  if (!auth.loaded) {
    await auth.fetchSession(useRequestFetch() as typeof $fetch)
  }

  if (!auth.isAuthenticated) {
    return navigateTo('/entrar')
  }

  if (!auth.hasEstablishment) {
    return navigateTo('/admin/configuracao')
  }
})
