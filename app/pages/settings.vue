<script setup lang="ts">
  import { authClient } from '../utils/auth-client'

  const toast = useToast()
  const { data: session } = await authClient.useSession(useFetch)

  // Redirect if not logged in or not a volunteer
  console.log({ sessionRole: session.value.user.role })
  if (session?.value?.user?.role !== 'VOLUNTEER') {
    // Only VOLUNTEER and ADMIN can see this
    await navigateTo('/')
  }

  const { data: volunteer, refresh, error } = await useFetch('/api/get/volunteers/bySession')

  const reminders = ref<{ minutesBefore: number; type: string }[]>([])
  const status = ref('')
  const statusOptions = ['AVAILABLE', 'UNAVAILABLE']
  const isSyncing = ref(false)

  watch(
    volunteer,
    (val) => {
      if (val) {
        isSyncing.value = true
        if (val.reminders) {
          const mapped = val.reminders
            .map((r: any) => ({
              minutesBefore: r.minutesBefore,
              type: r.type,
            }))
            .sort((a: any, b: any) => b.minutesBefore - a.minutesBefore)

          reminders.value = JSON.parse(JSON.stringify(mapped))
        }
        status.value = val.status || 'AVAILABLE'
        
        // Use setTimeout to ensure the watch on status doesn't fire for this change if it's eager
        // or nextTick
        setTimeout(() => { isSyncing.value = false }, 0)
      }
    },
    { immediate: true }
  )

  watch(status, async (newVal, oldVal) => {
    if (isSyncing.value) return
    if (!oldVal && !newVal) return // Initial empty state

    try {
      await $fetch('/api/put/volunteers/bySession/status', {
        method: 'PUT',
        body: { status: newVal },
      })
      toast.add({ title: 'Saved', description: 'Status updated', color: 'success' })
      refresh() // Refresh to keep sync
    } catch (err) {
      toast.add({ title: 'Error', description: 'Failed to update status', color: 'error' })
    }
  })

  async function updateReminders() {
    try {
      await $fetch('/api/put/volunteers/bySession/reminders', {
        method: 'PUT',
        body: reminders.value,
      })
      toast.add({ title: 'Saved', description: 'Reminders updated', color: 'success' })
      refresh()
    } catch (err) {
      toast.add({ title: 'Error', description: 'Failed to save reminders', color: 'error' })
    }
  }

  const newReminder = ref({
    value: 1,
    unit: 60, // minutes in unit
  })

  const units = [
    { label: 'Minutes', value: 1 },
    { label: 'Hours', value: 60 },
    { label: 'Days', value: 1440 },
  ]

  function addReminder() {
    const totalMinutes = newReminder.value.value * newReminder.value.unit
    if (reminders.value.some((r) => r.minutesBefore === totalMinutes)) {
      toast.add({ title: 'Error', description: 'This reminder already exists', color: 'error' })
      return
    }
    reminders.value.push({
      minutesBefore: totalMinutes,
      type: 'email',
    })
    // Sort reminders by time descending (furthest first)
    reminders.value.sort((a, b) => b.minutesBefore - a.minutesBefore)
    updateReminders()
  }

  function removeReminder(index: number) {
    reminders.value.splice(index, 1)
    updateReminders()
  }

  function formatMinutes(minutes: number) {
    if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440} day(s)`
    if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hour(s)`
    return `${minutes} minute(s)`
  }
</script>

<template>
  <UContainer class="py-10">
    <div class="mb-8">
      <h1 class="text-3xl font-bold">Account Settings</h1>
      <p class="text-gray-500">Manage your profile and notification preferences.</p>
    </div>

    <div v-if="error" class="rounded-md bg-red-50 p-4 text-red-500">
      <p class="font-bold">Profile not found.</p>
      <p>You may be logged in as an Admin without a linked volunteer profile.</p>
    </div>

    <div v-else class="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <!-- Profile Info -->
      <div class="lg:col-span-1">
        <UCard>
          <template #header>
            <h2 class="font-bold">Volunteer Profile</h2>
          </template>
          <div class="space-y-4" v-if="volunteer">
            <div>
              <p class="text-sm text-gray-500">Name</p>
              <p class="font-medium">{{ volunteer.user?.name }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Email</p>
              <p class="font-medium">{{ volunteer.user?.email }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Phone</p>
              <p class="font-medium">{{ formatPhoneNumber(volunteer.user?.phone) }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500 mb-1">Status</p>
              <USelect v-model="status" :items="statusOptions" />
            </div>
          </div>
        </UCard>
      </div>

      <!-- Reminders -->
      <div class="lg:col-span-2">
        <UCard>
          <template #header>
            <h2 class="font-bold">Ride Reminders</h2>
          </template>
          <p class="mb-6 text-sm text-gray-500">
            Set up automatic email reminders for your scheduled rides. You can add multiple
            reminders at different intervals.
          </p>

          <div class="space-y-6">
            <!-- Add New Reminder -->
            <div
              class="flex items-end gap-2 rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-700"
            >
              <UFormField label="Timeframe" class="flex-1">
                <div class="flex gap-2">
                  <UInput v-model.number="newReminder.value" type="number" min="1" class="w-24" />
                  <USelect v-model.number="newReminder.unit" :items="units" class="flex-1" />
                </div>
              </UFormField>
              <UButton
                label="Add Reminder"
                icon="i-lucide-plus"
                variant="subtle"
                @click="addReminder"
              />
            </div>

            <!-- List of Reminders -->
            <div class="space-y-2">
              <div v-if="reminders.length === 0" class="py-10 text-center text-gray-400 italic">
                No reminders set.
              </div>
              <div
                v-for="(reminder, index) in reminders"
                :key="reminder.minutesBefore"
                class="flex items-center justify-between rounded-lg border p-3 dark:border-gray-800"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full"
                  >
                    <UIcon name="i-lucide-bell" />
                  </div>
                  <div>
                    <p class="font-medium">
                      {{ formatMinutes(reminder.minutesBefore) }} before ride
                    </p>
                    <p class="text-xs text-gray-500">Email notification</p>
                  </div>
                </div>
                <UButton
                  icon="i-lucide-x"
                  color="error"
                  variant="ghost"
                  size="sm"
                  @click="removeReminder(index)"
                />
              </div>
            </div>
          </div>


        </UCard>
      </div>
    </div>
  </UContainer>
</template>
