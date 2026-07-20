<script setup lang="ts">
  import { blankRideForm } from '../utils/rideForm'

  // The Create Ride flow as a 3-step wizard (Client & route -> Schedule ->
  // Review). Rendered as a side pane on desktop and full-screen on mobile by the
  // parent; this component only owns the wizard itself. Create is admin-only, so
  // the parent gates it behind isAdmin (the volunteer picker is always shown).
  const props = defineProps<{
    clients: { id: string; name: string; homeAddress?: any }[] | null
    volunteers: { id: string; name?: string }[] | null
  }>()

  const emit = defineEmits<{ created: []; close: [] }>()
  const toast = useToast()

  const STEPS = [
    { n: 1, label: 'Client & route' },
    { n: 2, label: 'Schedule' },
    { n: 3, label: 'Review' },
  ]
  const step = ref(1)
  const submitting = ref(false)
  const state = reactive(blankRideForm())

  const clientItems = computed(
    () => props.clients?.map((c) => ({ label: c.name, value: c.id })) ?? []
  )
  const volunteerOptions = computed(() => {
    const list = (props.volunteers ?? []).map((v) => ({
      label: v.name || 'Unknown Volunteer',
      value: v.id,
    }))
    return [{ label: 'Unassigned', value: '' }, ...list]
  })

  // USelectMenu (value-key="value") binds the id string; normalize defensively
  // in case it ever hands back the whole option object.
  const clientId = computed(() =>
    typeof state.clientId === 'object' && state.clientId
      ? (state.clientId as { value?: string }).value
      : state.clientId
  )
  const selectedClient = computed(() => props.clients?.find((c) => c.id === clientId.value))

  // Pre-fill pickup from the client's home address when a client is chosen.
  watch(clientId, (id) => {
    const client = props.clients?.find((c) => c.id === id)
    if (client?.homeAddress) {
      Object.assign(state.pickup, {
        street: client.homeAddress.street,
        city: client.homeAddress.city,
        state: client.homeAddress.state,
        zip: client.homeAddress.zip,
      })
    }
  })

  // Shown under the pickup summary only while pickup still matches the client's
  // home address — clears itself if the admin edits pickup to something else.
  const pickupHint = computed(() => {
    const h = selectedClient.value?.homeAddress
    if (!h) return undefined
    const p = state.pickup
    const same =
      p.street === h.street && p.city === h.city && p.state === h.state && p.zip === h.zip
    return same ? `From ${selectedClient.value?.name}'s home address` : undefined
  })

  const addressComplete = (a: { street: string; city: string; state: string; zip: string }) =>
    !!(a.street?.trim() && a.city?.trim() && a.state?.trim() && a.zip?.trim())

  // Whether the current step is complete enough to advance.
  const canContinue = computed(() => {
    if (step.value === 1)
      return !!clientId.value && addressComplete(state.pickup) && addressComplete(state.dropoff)
    if (step.value === 2) return !!state.scheduledTime
    return true
  })

  function next() {
    if (step.value < 3 && canContinue.value) step.value++
  }
  function back() {
    if (step.value > 1) step.value--
  }

  const volunteerLabel = computed(() => {
    const v = state.volunteerId
    if (!v || (typeof v === 'object' && !v.value)) return 'Unassigned'
    if (typeof v === 'object') return v.label
    return volunteerOptions.value.find((o) => o.value === v)?.label ?? 'Unassigned'
  })

  function fmtDateTime(value: string) {
    if (!value) return '—'
    return formatDateTime(value, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  async function submit() {
    if (submitting.value) return
    submitting.value = true
    try {
      const scheduledTimeISO = new Date(state.scheduledTime).toISOString()
      const pickupTimeISO = state.pickupTime ? new Date(state.pickupTime).toISOString() : undefined
      const vId =
        typeof state.volunteerId === 'object' ? state.volunteerId?.value : state.volunteerId
      await $fetch('/api/post/rides', {
        method: 'POST',
        body: {
          clientId: clientId.value,
          pickup: state.pickup,
          dropoff: state.dropoff,
          notes: state.notes,
          volunteerId: vId,
          scheduledTime: scheduledTimeISO,
          pickupTime: pickupTimeISO,
        },
      })
      toast.add({ title: 'Ride created', color: 'success' })
      emit('created')
    } catch (err) {
      console.error('Failed to create ride', err)
      toast.add({ title: 'Error', description: 'Failed to create ride', color: 'error' })
    } finally {
      submitting.value = false
    }
  }
</script>

<template>
  <div
    class="flex h-full flex-col bg-white lg:rounded-xl lg:border lg:border-gray-200 dark:bg-gray-900 lg:dark:border-gray-800"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800"
    >
      <h2 class="text-base font-bold">New ride</h2>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Close"
        @click="emit('close')"
      />
    </div>

    <!-- Step rail -->
    <div class="flex items-center gap-1 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
      <template v-for="(s, i) in STEPS" :key="s.n">
        <div
          class="flex items-center gap-1.5 text-xs font-medium"
          :class="
            step === s.n
              ? 'text-gray-900 dark:text-white'
              : step > s.n
                ? 'text-gray-500'
                : 'text-gray-400'
          "
        >
          <span
            class="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            :class="
              step === s.n
                ? 'bg-primary text-white'
                : step > s.n
                  ? 'bg-primary/15 text-primary'
                  : 'border border-gray-300 text-gray-400 dark:border-gray-600'
            "
          >
            <UIcon v-if="step > s.n" name="i-lucide-check" class="size-3" />
            <template v-else>{{ s.n }}</template>
          </span>
          <span class="hidden sm:inline">{{ s.label }}</span>
        </div>
        <div
          v-if="i < STEPS.length - 1"
          class="h-px flex-1"
          :class="step > s.n ? 'bg-primary/40' : 'bg-gray-200 dark:bg-gray-700'"
        />
      </template>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-4">
      <!-- Step 1: Client & route -->
      <div v-show="step === 1" class="space-y-5">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Client
          </label>
          <USelectMenu
            v-model="state.clientId"
            :items="clientItems"
            value-key="value"
            placeholder="Search clients…"
            searchable
            class="w-full"
          />
        </div>
        <AddressField v-model="state.pickup" label="Pickup" :hint="pickupHint" />
        <AddressField v-model="state.dropoff" label="Dropoff" />
      </div>

      <!-- Step 2: Schedule & details -->
      <div v-show="step === 2" class="space-y-4">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Appointment time
          </label>
          <UInput v-model="state.scheduledTime" type="datetime-local" class="w-full" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Pickup time <span class="font-normal text-gray-400">(optional)</span>
          </label>
          <UInput v-model="state.pickupTime" type="datetime-local" class="w-full" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Volunteer <span class="font-normal text-gray-400">(optional)</span>
          </label>
          <USelectMenu
            v-model="state.volunteerId"
            :items="volunteerOptions"
            placeholder="Leave open for signup"
            searchable
            class="w-full"
          />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Notes <span class="font-normal text-gray-400">(optional)</span>
          </label>
          <UTextarea v-model="state.notes" placeholder="Additional instructions…" class="w-full" />
        </div>
      </div>

      <!-- Step 3: Review -->
      <div v-show="step === 3" class="space-y-3">
        <p class="text-sm text-gray-500">Check the details, then create the ride.</p>
        <dl
          class="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700"
        >
          <div class="flex justify-between gap-4 p-3">
            <dt class="text-sm text-gray-500">Client</dt>
            <dd class="text-right text-sm font-medium">{{ selectedClient?.name || '—' }}</dd>
          </div>
          <div class="p-3">
            <dt class="mb-1 text-sm text-gray-500">Route</dt>
            <dd class="space-y-1 text-sm font-medium">
              <p class="flex items-start gap-2">
                <UIcon name="i-lucide-map-pin" class="text-primary mt-0.5 size-4 shrink-0" />
                {{
                  [state.pickup.street, state.pickup.city, state.pickup.state, state.pickup.zip]
                    .filter(Boolean)
                    .join(', ')
                }}
              </p>
              <p class="flex items-start gap-2">
                <UIcon name="i-lucide-flag" class="text-error mt-0.5 size-4 shrink-0" />
                {{
                  [state.dropoff.street, state.dropoff.city, state.dropoff.state, state.dropoff.zip]
                    .filter(Boolean)
                    .join(', ')
                }}
              </p>
            </dd>
          </div>
          <div class="flex justify-between gap-4 p-3">
            <dt class="text-sm text-gray-500">Appointment</dt>
            <dd class="text-right text-sm font-medium">{{ fmtDateTime(state.scheduledTime) }}</dd>
          </div>
          <div v-if="state.pickupTime" class="flex justify-between gap-4 p-3">
            <dt class="text-sm text-gray-500">Pickup time</dt>
            <dd class="text-right text-sm font-medium">{{ fmtDateTime(state.pickupTime) }}</dd>
          </div>
          <div class="flex justify-between gap-4 p-3">
            <dt class="text-sm text-gray-500">Volunteer</dt>
            <dd class="text-right text-sm font-medium">{{ volunteerLabel }}</dd>
          </div>
          <div v-if="state.notes" class="p-3">
            <dt class="mb-1 text-sm text-gray-500">Notes</dt>
            <dd class="text-sm">{{ state.notes }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Footer -->
    <div
      class="flex items-center justify-between gap-2 border-t border-gray-100 p-4 dark:border-gray-800"
    >
      <UButton
        v-if="step > 1"
        label="Back"
        color="neutral"
        variant="ghost"
        icon="i-lucide-chevron-left"
        :disabled="submitting"
        @click="back"
      />
      <span v-else class="text-xs text-gray-400">Step {{ step }} of 3</span>

      <UButton
        v-if="step < 3"
        label="Continue"
        color="primary"
        trailing-icon="i-lucide-chevron-right"
        :disabled="!canContinue"
        @click="next"
      />
      <UButton
        v-else
        label="Create ride"
        color="primary"
        icon="i-lucide-check"
        :loading="submitting"
        @click="submit"
      />
    </div>
  </div>
</template>
