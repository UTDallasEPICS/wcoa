import { authClient } from '../utils/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await authClient.useSession(useFetch)

  if (!session.value) {
    if (to.path !== '/auth') {
      return navigateTo('/auth')
    }
  } else {
    // User is logged in
    const role = session.value.user.role
    if (role === 'VOLUNTEER') {
      // Volunteers can only access /rides and its sub-paths
      if (!to.path.startsWith('/rides')) {
        return navigateTo('/rides')
      }
    }
  }
})
