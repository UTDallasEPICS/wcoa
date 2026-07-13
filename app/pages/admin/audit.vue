<script setup lang="ts">
import { authClient } from '../../utils/auth-client'

// Admin-only page (issue #28), matching the guard used by admin/notifications.vue.
const { data: session } = await authClient.useSession(useFetch)
if (session.value?.user?.role !== 'ADMIN') {
  navigateTo('/')
}

type AuditLog = {
  id: string
  userId: string
  action: string
  targetType: string
  targetId: string | null
  details: unknown
  createdAt: string
}

// Filters (by action and/or acting user id). Sent as query params to the
// admin-only, bounded GET /api/get/audit endpoint.
const actionFilter = ref('')
const userFilter = ref('')

const query = computed(() => {
  const q: Record<string, string> = {}
  if (actionFilter.value.trim()) q.action = actionFilter.value.trim()
  if (userFilter.value.trim()) q.userId = userFilter.value.trim()
  return q
})

const { data: logs } = await useFetch<AuditLog[]>('/api/get/audit', { query })

function formatDetails(details: unknown): string {
  if (details == null) return ''
  try {
    return typeof details === 'string' ? details : JSON.stringify(details)
  } catch {
    return ''
  }
}
</script>

<template>
  <UContainer class="py-10">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Audit Log</h1>
      <p class="text-sm text-gray-500">
        Who did what — the most recent {{ logs?.length ?? 0 }} accountability events (newest first).
      </p>
    </div>

    <div class="flex flex-wrap gap-3 mb-4">
      <UFormField label="Filter by action">
        <UInput v-model="actionFilter" placeholder="e.g. RIDE_CANCELLED" />
      </UFormField>
      <UFormField label="Filter by user id">
        <UInput v-model="userFilter" placeholder="acting user id" />
      </UFormField>
    </div>

    <div class="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th class="text-left font-semibold px-3 py-2">When</th>
            <th class="text-left font-semibold px-3 py-2">Action</th>
            <th class="text-left font-semibold px-3 py-2">Target</th>
            <th class="text-left font-semibold px-3 py-2">User</th>
            <th class="text-left font-semibold px-3 py-2">Details</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="log in logs"
            :key="log.id"
            class="border-t border-gray-100 dark:border-gray-800"
          >
            <td class="px-3 py-2 whitespace-nowrap">{{ new Date(log.createdAt).toLocaleString() }}</td>
            <td class="px-3 py-2">
              <UBadge variant="subtle">{{ log.action }}</UBadge>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">{{ log.targetType }}<span v-if="log.targetId" class="text-gray-400"> · {{ log.targetId }}</span></td>
            <td class="px-3 py-2 whitespace-nowrap font-mono text-xs">{{ log.userId }}</td>
            <td class="px-3 py-2 font-mono text-xs text-gray-500">{{ formatDetails(log.details) }}</td>
          </tr>
          <tr v-if="!logs || logs.length === 0">
            <td colspan="5" class="px-3 py-6 text-center text-gray-500">No audit events found.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </UContainer>
</template>
