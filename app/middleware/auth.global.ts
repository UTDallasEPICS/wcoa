import { authClient } from '../utils/auth-client'

// Frontend route guard (issue #4) — defense in depth alongside the server-side
// API middleware (server/middleware/auth.ts). We explicitly map which routes
// each role may reach instead of only special-casing VOLUNTEER, so a CLIENT or
// any unmapped role can't render internal pages (/people, /admin/*, dashboard).
//
// Role model (kept consistent with the server):
//   - ADMIN     — full access to every internal page
//   - VOLUNTEER — only /rides* and /settings
//   - CLIENT / unmapped — no internal pages; sent to the /auth landing

// Returns true when the given role is allowed to view the path.
function canAccess(role: string | undefined, path: string): boolean {
  if (role === 'ADMIN') return true

  if (role === 'VOLUNTEER') {
    return path.startsWith('/rides') || path === '/settings'
  }

  // CLIENT or any unmapped/unknown role: no internal pages.
  return false
}

export default defineNuxtRouteMiddleware(async (to) => {
  // The login page is always reachable.
  if (to.path === '/auth') return

  const { data: session } = await authClient.useSession(useFetch)

  if (!session.value) {
    return navigateTo('/auth')
  }

  const role = session.value.user.role
  if (!canAccess(role, to.path)) {
    // Volunteers have a real landing page; everyone else goes back to /auth.
    return navigateTo(role === 'VOLUNTEER' ? '/rides' : '/auth')
  }
})
