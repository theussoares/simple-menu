export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore()

  if (!auth.loaded) {
    await auth.fetchSession()
  }

  if (!auth.isAuthenticated) {
    return navigateTo('/entrar')
  }
})
