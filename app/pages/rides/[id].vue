<script setup lang="ts">
  import * as z from 'zod'
  import { authClient } from '../../utils/auth-client'

  const route = useRoute()
  const id = route.params.id
  const toast = useToast()

  const { data: session } = await authClient.useSession(useFetch)
  const { data: ride, status, refresh: refreshRide } = await useFetch(`/api/get/rides/byId/${id}`)
  const { data: estimate } = await useFetch(`/api/get/rides/estimate/${id}`)
  // The assignment picker needs the full assignable roster, not a page — the
  // roster endpoint is paginated now (issue #13), so use the bounded options
  // endpoint (AVAILABLE volunteers, minimal { id, name } shape).
  const { data: volunteers } = await useFetch('/api/get/volunteers/options')

  const isEditModalOpen = ref(false)
  const isCompleteModalOpen = ref(false)
  const isDeleteModalOpen = ref(false)
  const isCancelModalOpen = ref(false)

  const isAdmin = computed(() => session.value?.user?.role === 'ADMIN')
  const isVolunteer = computed(() => session.value?.user?.role === 'VOLUNTEER')

  // Volunteer specific checks
  const isAssignedToMe = computed(() => ride.value?.volunteer?.userId === session.value?.user?.id)

  const schema = z.object({
    pickupDisplay: z.string().min(1, 'Pickup address is required'),
    dropoffDisplay: z.string().min(1, 'Dropoff address is required'),
    scheduledTime: z.string().min(1, 'Scheduled time is required'),
    pickupTime: z.string().optional(),
    notes: z.string().optional(),
    totalRideTime: z.number().optional(),
    volunteerId: z.any().optional(),
  })

  const editState = reactive({
    pickupDisplay: '',
    dropoffDisplay: '',
    scheduledTime: '',
    pickupTime: '',
    notes: '',
    totalRideTime: 0,
    volunteerId: undefined as any,
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

      if (ride.value.pickupTime) {
        const pDate = new Date(ride.value.pickupTime)
        editState.pickupTime = new Date(pDate.getTime() - pDate.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      } else {
        editState.pickupTime = ''
      }

      editState.notes = ride.value.notes || ''
      editState.totalRideTime = ride.value.totalRideTime || 0

      // Handle volunteer object binding for USelectMenu. The options endpoint
      // only lists AVAILABLE volunteers (issue #13), so a currently-assigned
      // volunteer who is now UNAVAILABLE won't be in it — fall back to the
      // ride's own volunteer record so the assignee still shows (and isn't
      // silently dropped on save).
      if (ride.value.volunteerId) {
        const found = volunteers.value?.find((v: any) => v.id === ride.value.volunteerId)
        const label = found?.name || ride.value.volunteer?.user?.name || 'Assigned volunteer'
        editState.volunteerId = { label, value: ride.value.volunteerId }
      } else {
        editState.volunteerId = undefined // or { label: 'Unassigned', value: '' } if preferred
      }
    }
  })

  async function handleUpdate(event: any) {
    try {
      // Convert local datetime-local string to ISO string (UTC)
      const scheduledTimeISO = new Date(event.data.scheduledTime).toISOString()
      const pickupTimeISO = event.data.pickupTime
        ? new Date(event.data.pickupTime).toISOString()
        : null

      // Normalize volunteerId
      const vId =
        typeof event.data.volunteerId === 'object'
          ? event.data.volunteerId.value
          : event.data.volunteerId

      await $fetch(`/api/put/rides/${id}`, {
        method: 'PUT',
        body: {
          ...event.data,
          volunteerId: vId,
          scheduledTime: scheduledTimeISO,
          pickupTime: pickupTimeISO,
        },
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
      // Self-service completion endpoint (issue #87): PUT /api/put/rides/[id] is
      // blocked for volunteers by the global auth middleware, so the assigned
      // volunteer (and admins) complete a ride through this dedicated POST.
      await $fetch(`/api/post/rides/${id}/complete`, {
        method: 'POST',
        body: {
          totalRideTime: event.data.totalRideTime,
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

  async function handleCancel() {
    try {
      await $fetch(`/api/put/rides/${id}`, {
        method: 'PUT',
        body: { status: 'CANCELLED' },
      })
      toast.add({ title: 'Success', description: 'Ride cancelled', color: 'success' })
      isCancelModalOpen.value = false
      await refreshRide()
    } catch (err) {
      toast.add({ title: 'Error', description: 'Failed to cancel ride', color: 'error' })
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

  // Status → badge color, matching the rides list so the two pages agree.
  type StatusColor = 'info' | 'warning' | 'success' | 'error' | 'neutral'
  function statusColor(status: string): StatusColor {
    const map: Record<string, StatusColor> = {
      CREATED: 'info',
      ASSIGNED: 'warning',
      COMPLETED: 'success',
      CANCELLED: 'error',
    }
    return map[status] || 'neutral'
  }

  // Role/status-gated actions defined once and rendered in two places: an inline
  // cluster on desktop and a sticky bar on mobile. The conditions mirror the
  // original per-button v-ifs exactly. `primary` marks the main CTA (filled and
  // full-width on the mobile bar); by construction at most one is ever present.
  type RideAction = {
    key: string
    label: string
    icon: string
    color: 'primary' | 'success' | 'warning' | 'error' | 'neutral'
    variant?: 'subtle'
    primary?: boolean
    onClick: () => void
  }

  const actions = computed<RideAction[]>(() => {
    const r = ride.value
    if (!r) return []
    const s = r.status
    const list: RideAction[] = []

    if (isVolunteer.value && !isAssignedToMe.value && s === 'CREATED') {
      list.push({
        key: 'signup',
        label: 'Sign Up',
        icon: 'i-lucide-user-plus',
        color: 'primary',
        primary: true,
        onClick: () => handleVolunteerAction('signup'),
      })
    }
    if (isVolunteer.value && isAssignedToMe.value && s === 'ASSIGNED') {
      list.push({
        key: 'complete',
        label: 'Mark as Completed',
        icon: 'i-lucide-check',
        color: 'success',
        primary: true,
        onClick: () => handleVolunteerAction('complete'),
      })
      list.push({
        key: 'unsignup',
        label: 'Unsign Up',
        icon: 'i-lucide-user-minus',
        color: 'warning',
        variant: 'subtle',
        onClick: () => handleVolunteerAction('unsignup'),
      })
    }
    if (isAdmin.value || (isVolunteer.value && isAssignedToMe.value && s === 'COMPLETED')) {
      list.push({
        key: 'edit',
        label: 'Edit',
        icon: 'i-lucide-edit',
        color: 'neutral',
        variant: 'subtle',
        primary: true,
        onClick: () => {
          isEditModalOpen.value = true
        },
      })
    }
    if (isAdmin.value && s !== 'CANCELLED' && s !== 'COMPLETED') {
      list.push({
        key: 'cancel',
        label: 'Cancel Ride',
        icon: 'i-lucide-ban',
        color: 'warning',
        variant: 'subtle',
        onClick: () => {
          isCancelModalOpen.value = true
        },
      })
    }
    if (isAdmin.value) {
      list.push({
        key: 'delete',
        label: 'Delete',
        icon: 'i-lucide-trash',
        color: 'error',
        variant: 'subtle',
        onClick: () => {
          isDeleteModalOpen.value = true
        },
      })
    }
    return list
  })

  // Mobile bar: one filled primary + the rest as icon-only buttons.
  const primaryAction = computed<RideAction | null>(
    () => actions.value.find((a) => a.primary) ?? actions.value[0] ?? null
  )
  const secondaryActions = computed(() => actions.value.filter((a) => a !== primaryAction.value))

  // Pickup/dropoff coordinates for the route map, taken from the (cached)
  // estimate response (geocoded server-side via Nominatim). null until available.
  const mapPickup = computed(() =>
    estimate.value?.pickupLat != null && estimate.value?.pickupLng != null
      ? { lat: estimate.value.pickupLat, lng: estimate.value.pickupLng }
      : null
  )
  const mapDropoff = computed(() =>
    estimate.value?.dropoffLat != null && estimate.value?.dropoffLng != null
      ? { lat: estimate.value.dropoffLat, lng: estimate.value.dropoffLng }
      : null
  )
  // Driving path (OSRM geometry) for the route line; null → straight fallback.
  const mapRoute = computed(() => estimate.value?.routeGeometry ?? null)

  // Universal maps directions deep-link: origin = pickup, destination = dropoff.
  // On a phone the OS hands this off to the native maps app; on desktop it
  // opens Google Maps directions in the browser.
  const navigateUrl = computed(() => {
    if (!ride.value) return ''
    return buildMapsDeepLink(ride.value.pickupDisplay, ride.value.dropoffDisplay)
  })

  const volunteerOptions = computed(() => {
    if (!volunteers.value) return []
    const list = volunteers.value.map((v: any) => ({
      label: v.name || 'Unknown Volunteer',
      value: v.id,
    }))
    return [{ label: 'Unassigned', value: '' }, ...list]
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

    <template v-else>
      <!-- Identity header: who / when / status, with the desktop action cluster.
           On mobile these actions move to a sticky bar pinned at the bottom. -->
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ ride.client?.user?.name }}
          </h1>
          <p class="mt-1 text-sm text-gray-500">
            {{
              formatDateTime(ride.scheduledTime, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <UBadge :color="statusColor(ride.status)" variant="subtle" class="capitalize">
            {{ ride.status }}
          </UBadge>
          <div class="hidden gap-2 lg:flex">
            <UButton
              v-for="a in actions"
              :key="a.key"
              :label="a.label"
              :icon="a.icon"
              :color="a.color"
              :variant="a.variant"
              @click="a.onClick"
            />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <!-- Left Column: Details -->
        <div class="space-y-6 lg:col-span-1">
          <UCard>
            <template #header>
              <h2 class="text-xl font-bold">Ride Information</h2>
            </template>

            <div class="space-y-4">
              <div>
                <p class="text-sm text-gray-500">Appointment Time</p>
                <p class="font-medium">
                  {{ formatDateTime(ride.scheduledTime) }}
                </p>
              </div>

              <div v-if="ride.pickupTime">
                <p class="text-error text-sm text-gray-500">Pick Up Time</p>
                <p class="text-error font-bold">
                  {{ formatDateTime(ride.pickupTime) }}
                </p>
              </div>

              <div>
                <p class="text-sm text-gray-500">Client</p>
                <p class="font-medium">{{ ride.client?.user?.name }}</p>
                <!-- Hide client email from volunteers if strictly needed, but let's keep it for contact -->
                <p class="text-sm text-gray-500">
                  {{ formatPhoneNumber(ride.client?.user?.phone) }}
                </p>
              </div>

              <div>
                <p class="text-sm text-gray-500">Volunteer</p>
                <p class="font-medium" v-if="ride.volunteer">
                  {{ ride.volunteer?.user?.name }}
                </p>
                <p class="text-gray-400 italic" v-else>No volunteer assigned</p>
                <p class="text-sm text-gray-500">
                  {{ formatPhoneNumber(ride.volunteer?.user?.phone) }}
                </p>
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

              <div
                v-if="estimate && !estimate.error"
                class="flex gap-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50"
              >
                <div>
                  <p class="text-sm text-gray-500">Est. Duration</p>
                  <p class="font-medium">{{ estimate.duration }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-500">Distance</p>
                  <p class="font-medium">{{ estimate.distance }}</p>
                </div>
              </div>
              <p
                v-else-if="estimate?.error"
                class="flex items-center gap-1.5 text-sm text-gray-500"
              >
                <UIcon name="i-lucide-info" class="size-4 shrink-0" />
                {{ estimate.error }}
              </p>

              <UButton
                :to="navigateUrl"
                target="_blank"
                rel="noopener"
                label="Navigate"
                icon="i-lucide-navigation"
                color="primary"
                size="lg"
                block
                external
                data-testid="navigate-link"
              />

              <ClientOnly>
                <RideRouteMap :pickup="mapPickup" :dropoff="mapDropoff" :route="mapRoute" />
                <template #fallback>
                  <div
                    class="aspect-video w-full animate-pulse rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
                  ></div>
                </template>
              </ClientOnly>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Spacer so page content isn't hidden behind the fixed mobile bar. -->
      <div v-if="primaryAction" aria-hidden="true" class="h-24 lg:hidden"></div>

      <!-- Mobile action bar: docked flush to the bottom edge — full width, only
           the top corners rounded. One filled primary action (thumb-reachable)
           plus any secondary actions as icon buttons. Hidden on lg+, where the
           actions live inline in the header instead. -->
      <div
        v-if="primaryAction"
        class="fixed inset-x-0 bottom-0 z-20 flex items-center gap-2 rounded-t-xl border-t border-gray-200 bg-white/95 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden dark:border-gray-700 dark:bg-gray-900/95"
      >
        <UButton
          v-for="a in secondaryActions"
          :key="a.key"
          :icon="a.icon"
          :color="a.color"
          :variant="a.variant || 'subtle'"
          size="lg"
          square
          :aria-label="a.label"
          @click="a.onClick"
        />
        <UButton
          :label="primaryAction.label"
          :icon="primaryAction.icon"
          :color="primaryAction.color"
          size="lg"
          class="flex-1 justify-center"
          @click="primaryAction.onClick"
        />
      </div>
    </template>

    <!-- Edit Modal -->
    <UModal v-model:open="isEditModalOpen" title="Edit Ride">
      <template #content>
        <div class="">
          <UForm :schema="schema" :state="editState" class="space-y-4 p-4" @submit="handleUpdate">
            <UFormField label="Pickup Address" name="pickupDisplay">
              <UInput v-model="editState.pickupDisplay" class="w-full" :disabled="!isAdmin" />
            </UFormField>

            <UFormField label="Dropoff Address" name="dropoffDisplay">
              <UInput v-model="editState.dropoffDisplay" class="w-full" :disabled="!isAdmin" />
            </UFormField>

            <UFormField label="Volunteer" name="volunteerId" v-if="isAdmin">
              <USelectMenu
                v-model="editState.volunteerId"
                :items="volunteerOptions"
                placeholder="Select a volunteer"
                class="w-full"
                searchable
                option-attribute="label"
              />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Appointment Time" name="scheduledTime">
                <UInput
                  v-model="editState.scheduledTime"
                  type="datetime-local"
                  class="w-full"
                  :disabled="!isAdmin"
                />
              </UFormField>

              <UFormField label="Pick Up Time (Optional)" name="pickupTime">
                <UInput
                  v-model="editState.pickupTime"
                  type="datetime-local"
                  class="w-full"
                  :disabled="!isAdmin"
                />
              </UFormField>
            </div>

            <UFormField label="Notes" name="notes">
              <UTextarea v-model="editState.notes" class="w-full" :disabled="!isAdmin" />
            </UFormField>

            <UFormField
              label="Total Ride Time (Hours)"
              name="totalRideTime"
              v-if="ride?.status === 'COMPLETED' || isAdmin"
            >
              <UInput
                v-model.number="editState.totalRideTime"
                type="number"
                step="0.1"
                class="w-full"
              />
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
        <div class="space-y-4 p-4">
          <UForm
            :schema="
              z.object({
                totalRideTime: z.number().min(0.1, 'Duration must be at least 0.1 hours'),
              })
            "
            :state="completeState"
            @submit="handleComplete"
          >
            <p class="text-sm text-gray-500">
              Please enter the total time spent on this ride (including pickup and dropoff).
            </p>
            <UFormField label="Total Duration (Hours)" name="totalRideTime">
              <UInput
                v-model.number="completeState.totalRideTime"
                type="number"
                step="0.1"
                class="w-full"
              />
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
        <div class="space-y-4 p-4">
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

    <!-- Cancel Ride Confirmation Modal -->
    <UModal v-model:open="isCancelModalOpen" title="Cancel Ride">
      <template #content>
        <div class="space-y-4 p-4">
          <p>
            Are you sure you want to cancel this ride? The assigned volunteer (if any) will be
            notified.
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              label="Keep Ride"
              color="neutral"
              variant="ghost"
              @click="isCancelModalOpen = false"
            />
            <UButton label="Cancel Ride" color="warning" @click="handleCancel" />
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
