<script setup lang="ts">
  import * as z from 'zod'
  import { authClient } from '../../utils/auth-client'

  const route = useRoute()
  const id = route.params.id
  const toast = useToast()

  const { data: session } = await authClient.useSession(useFetch)
  const { data: ride, status, refresh: refreshRide } = await useFetch(`/api/get/rides/byId/${id}`)
  const { data: estimate } = await useFetch(`/api/get/rides/estimate/${id}`)

  const isEditModalOpen = ref(false)
  const isCompleteModalOpen = ref(false)
  const isDeleteModalOpen = ref(false)

  const isAdmin = computed(() => session.value?.user?.role === 'ADMIN')
  const isVolunteer = computed(() => session.value?.user?.role === 'VOLUNTEER')

  // Volunteer specific checks
  const isAssignedToMe = computed(() => ride.value?.volunteer?.userId === session.value?.user?.id)

  const schema = z.object({
    pickupDisplay: z.string().min(1, 'Pickup address is required'),
    dropoffDisplay: z.string().min(1, 'Dropoff address is required'),
    scheduledTime: z.string().min(1, 'Scheduled time is required'),
    notes: z.string().optional(),
    totalRideTime: z.number().optional(),
  })

  const editState = reactive({
    pickupDisplay: '',
    dropoffDisplay: '',
    scheduledTime: '',
    notes: '',
    totalRideTime: 0,
  })

  const completeState = reactive({
    totalRideTime: 1.0,
  })

  // Initialize edit state when ride is loaded or modal opens
  watch(isEditModalOpen, (val) => {
    if (val && ride.value) {
      editState.pickupDisplay = ride.value.pickupDisplay
      editState.dropoffDisplay = ride.value.dropoffDisplay
      // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
      const date = new Date(ride.value.scheduledTime)
      editState.scheduledTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
      editState.notes = ride.value.notes || ''
      editState.totalRideTime = ride.value.totalRideTime || 0
    }
  })

  async function handleUpdate(event: any) {
    try {
      await $fetch(`/api/put/rides/${id}`, {
        method: 'PUT',
        body: event.data,
      })
      toast.add({ title: 'Success', description: 'Ride updated successfully', color: 'success' })
      isEditModalOpen.value = false
      await refreshRide()
    } catch (err) {
      toast.add({ title: 'Error', description: 'Failed to update ride', color: 'error' })
    }
  }

  async function handleComplete(event: any) {
    try {
      await $fetch(`/api/put/rides/${id}`, {
        method: 'PUT',
        body: { 
          status: 'COMPLETED',
          totalRideTime: event.data.totalRideTime
        },
      })
      toast.add({ title: 'Success', description: 'Ride marked as completed', color: 'success' })
      isCompleteModalOpen.value = false
      await refreshRide()
    } catch (err) {
      toast.add({ title: 'Error', description: 'Failed to complete ride', color: 'error' })
    }
  }

  async function handleDelete() {
    try {
      await $fetch(`/api/delete/rides/${id}`, {
        method: 'DELETE',
      })
      toast.add({ title: 'Success', description: 'Ride deleted successfully', color: 'success' })
      await navigateTo('/rides')
    } catch (err) {
      toast.add({ title: 'Error', description: 'Failed to delete ride', color: 'error' })
    }
  }

  async function handleVolunteerAction(action: 'signup' | 'unsignup' | 'complete') {
    if (action === 'signup') {
      try {
        await $fetch(`/api/post/rides/${id}/signup`, { method: 'POST' })
        toast.add({
          title: 'Success',
          description: 'You have signed up for this ride',
          color: 'success',
        })
        await refreshRide()
      } catch (e) {
        toast.add({ title: 'Error', description: 'Failed to sign up', color: 'error' })
      }
      return
    }

    if (action === 'unsignup') {
      try {
        await $fetch(`/api/post/rides/${id}/unsignup`, { method: 'POST' })
        toast.add({
          title: 'Success',
          description: 'You have unsigned from this ride',
          color: 'success',
        })
        await refreshRide()
      } catch (e) {
        toast.add({ title: 'Error', description: 'Failed to unsign up', color: 'error' })
      }
      return
    }

    if (action === 'complete') {
      isCompleteModalOpen.value = true
    }
  }

  const mapUrl = computed(() => {
    if (!ride.value) return ''
    const origin = encodeURIComponent(ride.value.pickupDisplay)
    const destination = encodeURIComponent(ride.value.dropoffDisplay)
    const apiKey = useRuntimeConfig().public.googleMapsApiKey
    return `https://www.google.com/maps/embed/v1/directions?key=${apiKey || ''}&origin=${origin}&destination=${destination}`
  })

  const breadcrumbs = [{ label: 'Rides', to: '/rides' }, { label: 'Ride Details' }]
</script>

<template>
  <UContainer class="py-10">
    <UBreadcrumb :items="breadcrumbs" class="mb-6" />

    <div v-if="status === 'pending'" class="flex h-64 items-center justify-center">
      <USkeleton class="h-64 w-full" />
    </div>

    <div v-else-if="!ride" class="py-20 text-center">
      <h1 class="mb-4 text-2xl font-bold">Ride not found</h1>
      <UButton to="/rides" label="Back to Rides" color="neutral" variant="ghost" />
    </div>

    <div v-else class="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <!-- Left Column: Details -->
      <div class="space-y-6 lg:col-span-1">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold">Ride Information</h2>
              <UBadge
                :color="
                  ride.status === 'COMPLETED'
                    ? 'success'
                    : 'info'
                "
                variant="subtle"
              >
                {{ ride.status }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-4">
            <div>
              <p class="text-sm text-gray-500">Scheduled Time</p>
              <p class="font-medium">
                {{ new Date(ride.scheduledTime).toLocaleString() }}
              </p>
            </div>

            <div>
              <p class="text-sm text-gray-500">Client</p>
              <p class="font-medium">{{ ride.client?.user?.name }}</p>
              <!-- Hide client email from volunteers if strictly needed, but let's keep it for contact -->
              <p class="text-sm text-gray-500">{{ formatPhoneNumber(ride.client?.user?.phone) }}</p>
            </div>

            <div>
              <p class="text-sm text-gray-500">Volunteer</p>
              <p class="font-medium" v-if="ride.volunteer">
                {{ ride.volunteer?.user?.name }}
              </p>
              <p class="text-gray-400 italic" v-else>No volunteer assigned</p>
              <p class="text-sm text-gray-500">{{ formatPhoneNumber(ride.volunteer?.user?.phone) }}</p>
            </div>

            <div v-if="ride.status === 'COMPLETED' || ride.totalRideTime">
              <p class="text-sm text-gray-500">Total Ride Time</p>
              <p class="font-medium">{{ ride.totalRideTime || 0 }} hours</p>
            </div>

            <div v-if="ride.notes">
              <p class="text-sm text-gray-500">Notes</p>
              <p
                class="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200"
              >
                {{ ride.notes }}
              </p>
            </div>
          </div>

          <template #footer>
            <div class="flex gap-2">
              <UButton
                v-if="isAdmin || (isVolunteer && isAssignedToMe && ride.status === 'COMPLETED')"
                label="Edit"
                icon="i-lucide-edit"
                variant="subtle"
                class="flex-1 justify-center"
                @click="isEditModalOpen = true"
              />
              <UButton
                v-if="isAdmin"
                label="Delete"
                icon="i-lucide-trash"
                color="error"
                variant="subtle"
                @click="isDeleteModalOpen = true"
              />
              <UButton
                v-if="isVolunteer && !isAssignedToMe && ride.status === 'CREATED'"
                label="Sign Up"
                icon="i-lucide-user-plus"
                color="primary"
                class="flex-1 justify-center"
                @click="handleVolunteerAction('signup')"
              />
              <UButton
                v-if="isVolunteer && isAssignedToMe && ride.status === 'ASSIGNED'"
                label="Unsign Up"
                icon="i-lucide-user-minus"
                color="warning"
                variant="subtle"
                class="flex-1 justify-center"
                @click="handleVolunteerAction('unsignup')"
              />
              <UButton
                v-if="isVolunteer && isAssignedToMe && ride.status === 'ASSIGNED'"
                label="Mark as Completed"
                icon="i-lucide-check"
                color="success"
                class="flex-1 justify-center"
                @click="handleVolunteerAction('complete')"
              />
            </div>
          </template>
        </UCard>
      </div>

      <!-- Right Column: Map and Route -->
      <div class="space-y-6 lg:col-span-2">
        <UCard>
          <template #header>
            <h2 class="text-xl font-bold">Route</h2>
          </template>

          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <UIcon name="i-lucide-map-pin" class="text-primary mt-1 size-5" />
              <div>
                <p class="text-sm text-gray-500">Pickup</p>
                <p class="font-medium">{{ ride.pickupDisplay }}</p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <UIcon name="i-lucide-flag" class="text-error mt-1 size-5" />
              <div>
                <p class="text-sm text-gray-500">Dropoff</p>
                <p class="font-medium">{{ ride.dropoffDisplay }}</p>
              </div>
            </div>

            <div v-if="estimate && !estimate.error" class="flex gap-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
              <div>
                <p class="text-sm text-gray-500">Est. Duration</p>
                <p class="font-medium">{{ estimate.duration }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500">Distance</p>
                <p class="font-medium">{{ estimate.distance }}</p>
              </div>
            </div>

            <div class="aspect-video w-full overflow-hidden rounded-lg border">
              <iframe
                v-if="mapUrl && useRuntimeConfig().public.googleMapsApiKey"
                width="100%"
                height="100%"
                frameborder="0"
                style="border: 0"
                :src="mapUrl"
                allowfullscreen
              ></iframe>
              <div
                v-else
                class="flex h-full items-center justify-center bg-gray-100 text-gray-400 italic"
              >
                Map API Key missing or invalid address
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Edit Modal -->
    <UModal v-model:open="isEditModalOpen" title="Edit Ride">
      <template #content>
        <div @click.stop>
          <UForm :schema="schema" :state="editState" class="space-y-4 p-4" @submit="handleUpdate">
            <UFormField label="Pickup Address" name="pickupDisplay">
              <UInput v-model="editState.pickupDisplay" class="w-full" :disabled="!isAdmin" />
            </UFormField>

            <UFormField label="Dropoff Address" name="dropoffDisplay">
              <UInput v-model="editState.dropoffDisplay" class="w-full" :disabled="!isAdmin" />
            </UFormField>

            <UFormField label="Scheduled Time" name="scheduledTime">
              <UInput v-model="editState.scheduledTime" type="datetime-local" class="w-full" :disabled="!isAdmin" />
            </UFormField>

            <UFormField label="Notes" name="notes">
              <UTextarea v-model="editState.notes" class="w-full" :disabled="!isAdmin" />
            </UFormField>

            <UFormField label="Total Ride Time (Hours)" name="totalRideTime" v-if="ride?.status === 'COMPLETED' || isAdmin">
              <UInput v-model.number="editState.totalRideTime" type="number" step="0.1" class="w-full" />
            </UFormField>

            <div class="flex justify-end gap-2 pt-4">
              <UButton
                label="Cancel"
                color="neutral"
                variant="ghost"
                @click="isEditModalOpen = false"
              />
              <UButton type="submit" label="Save Changes" color="primary" />
            </div>
          </UForm>
        </div>
      </template>
    </UModal>

    <!-- Complete Ride Modal -->
    <UModal v-model:open="isCompleteModalOpen" title="Complete Ride">
      <template #content>
        <div @click.stop>
          <UForm
            :schema="z.object({ totalRideTime: z.number().min(0.1, 'Duration must be at least 0.1 hours') })"
            :state="completeState"
            class="space-y-4 p-4"
            @submit="handleComplete"
          >
            <p class="text-sm text-gray-500">
              Please enter the total time spent on this ride (including pickup and dropoff).
            </p>
            <UFormField label="Total Duration (Hours)" name="totalRideTime">
              <UInput v-model.number="completeState.totalRideTime" type="number" step="0.1" class="w-full" />
            </UFormField>

            <div class="flex justify-end gap-2 pt-4">
              <UButton
                label="Cancel"
                color="neutral"
                variant="ghost"
                @click="isCompleteModalOpen = false"
              />
              <UButton type="submit" label="Mark as Completed" color="success" />
            </div>
          </UForm>
        </div>
      </template>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="isDeleteModalOpen" title="Delete Ride">
      <template #content>
        <div class="space-y-4 p-4" @click.stop>
          <p>Are you sure you want to delete this ride? This action cannot be undone.</p>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="isDeleteModalOpen = false"
            />
            <UButton label="Delete" color="error" @click="handleDelete" />
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
