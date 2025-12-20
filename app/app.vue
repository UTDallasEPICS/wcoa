<script setup lang="ts">
  import type { NavigationMenuItem } from '@nuxt/ui'
  import { authClient } from './utils/auth-client'

  const route = useRoute()
  const { data: session } = await authClient.useSession(useFetch)

  const items = computed<NavigationMenuItem[]>(() => {
    const baseItems: NavigationMenuItem[] = [
      {
        label: 'Dashboard',
        to: '/',
        icon: 'i-lucide-layout-dashboard',
      },
      {
        label: 'Rides',
        to: '/rides',
        icon: 'i-lucide-car',
      },
      {
        label: 'People',
        to: '/people',
        icon: 'i-lucide-users',
      },
    ]

    if (session.value?.user?.role === 'ADMIN') {
      baseItems.push({
        label: 'Admins',
        to: '/admin',
        icon: 'i-lucide-shield-check',
      })
    }

    return baseItems
  })

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigateTo('/auth')
        },
      },
    })
  }

  const userMenuItems = [
    [
      {
        label: 'Logout',
        icon: 'i-lucide-log-out',
        onSelect: handleLogout,
      },
    ],
  ]
</script>

<template>
  <UApp>
    <UHeader v-if="route.path !== '/auth'">
      <UNavigationMenu :items="items" variant="pill" />

      <template #title>
        <div class="flex space-x-2">
          <img src="./assets/images/wcoa-leaf.png" class="w-8" />
          <p class="">WCOA</p>
        </div>
      </template>

      <template #right>
        <UColorModeButton />
        <UDropdownMenu :items="userMenuItems" :content="{ align: 'end' }">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-user"
            :label="session?.user?.name.split(' ')[0] || 'User'"
          />
        </UDropdownMenu>
      </template>

      <template #body>
        <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
