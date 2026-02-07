<script setup lang="ts">
  import { h, resolveComponent } from 'vue'
  import type { TableColumn, TableRow } from '@nuxt/ui'
  import * as z from 'zod'
  import { authClient } from '../../utils/auth-client'

  const UBadge = resolveComponent('UBadge')

  const { data: session } = await authClient.useSession(useFetch)
  const isAdmin = computed(() => session.value?.user?.role === 'ADMIN')

  const { data: rides, status, refresh: refreshRides } = await useFetch('/api/get/rides')
  const { data: clients } = await useFetch('/api/get/clients')
  const { data: volunteers } = await useFetch('/api/get/volunteers')

  const search = ref('')

  // Persisted State
  const savedActiveFilters = useCookie<{ label: string; value: string }[]>('ride-active-filters', {
    default: () => [],
  })
  const savedExcludedFilters = useCookie<{ label: string; value: string }[]>(
    'ride-excluded-filters',
    { default: () => [] }
  )

  const activeFilters = ref<{ label: string; value: string }[]>(savedActiveFilters.value)
  const excludedFilters = ref<{ label: string; value: string }[]>(savedExcludedFilters.value)

  // Sync state back to cookies
  watch(
    activeFilters,
    (newVal) => {
      savedActiveFilters.value = newVal
    },
    { deep: true }
  )
  watch(
    excludedFilters,
    (newVal) => {
      savedExcludedFilters.value = newVal
    },
    { deep: true }
  )

  const startDate = ref('')
  const endDate = ref('')
  const isCreateModalOpen = ref(false)

  const filterOptions = computed(() => {
    const options = [
      { label: 'Created', value: 'status:CREATED' },
      { label: 'Assigned', value: 'status:ASSIGNED' },
      { label: 'Completed', value: 'status:COMPLETED' },
    ]
    if (!isAdmin.value) {
      options.push({ label: 'Assigned to Me', value: 'assign:ME' })
    }
    return options
  })

  // --- Schema ---
  const addressSchema = z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zip: z.string().min(1, 'Zip is required'),
  })

  const schema = z.object({
    clientId: z.string().min(1, 'Client is required'),
    pickup: addressSchema,
    dropoff: addressSchema,
    scheduledTime: z.string().min(1, 'Date is required'),
    notes: z.string().optional(),
    volunteerId: z.any().optional(),
  })

  // --- State ---
  const state = reactive({
    clientId: '',
    pickup: {
      street: '',
      city: '',
      state: '',
      zip: '',
    },
    dropoff: {
      street: '',
      city: '',
      state: '',
      zip: '',
    },
    scheduledTime: '',
    notes: '',
    volunteerId: undefined as any,
  })

  // --- Autocomplete Logic ---
  const pickupSearch = ref('')
  const dropoffSearch = ref('')
  
  const { data: addresses } = await useFetch('/api/get/addresses')

  const pickupOptions = computed(() => {
    if (!pickupSearch.value || !addresses.value) return []
    const q = pickupSearch.value.toLowerCase()
    return addresses.value
      .filter((a: any) => a.label.toLowerCase().includes(q))
      .slice(0, 5)
  })

  const dropoffOptions = computed(() => {
    if (!dropoffSearch.value || !addresses.value) return []
    const q = dropoffSearch.value.toLowerCase()
    return addresses.value
      .filter((a: any) => a.label.toLowerCase().includes(q))
      .slice(0, 5)
  })
  
  const volunteerOptions = computed(() => {
    if (!volunteers.value) return []
    const list = volunteers.value.map((v: any) => ({
      label: v.user?.name || 'Unknown Volunteer',
      value: v.id,
    }))
    return [{ label: 'Unassigned', value: '' }, ...list]
  })

  watch(
    () => state.clientId,
    (newId) => {
      if (!newId || !clients.value) return
      const client = clients.value.find((c: any) => c.id === newId)
      if (client?.homeAddress) {
        Object.assign(state.pickup, {
          street: client.homeAddress.street,
          city: client.homeAddress.city,
          state: client.homeAddress.state,
          zip: client.homeAddress.zip
        })
      }
    }
  )

  function onPickupSelect(opt: any) {
    Object.assign(state.pickup, {
      street: opt.address.street,
      city: opt.address.city,
      state: opt.address.state,
      zip: opt.address.zip
    })
    pickupSearch.value = ''
  }

  function onDropoffSelect(opt: any) {
    Object.assign(state.dropoff, {
      street: opt.address.street,
      city: opt.address.city,
      state: opt.address.state,
      zip: opt.address.zip
    })
    dropoffSearch.value = ''
  }

  const filteredRides = computed(() => {
    if (!rides.value) return []

    let result = rides.value

    // Consolidated Filter Logic (OR Condition for Inclusion)
    if (activeFilters.value.length > 0) {
      result = result.filter((ride: any) => {
        return activeFilters.value.some((filter) => {
          const val = filter.value

          if (val.startsWith('status:')) {
            const status = val.replace('status:', '')
            return ride.status === status
          }

          if (val === 'assign:ME') {
            const myId = session.value?.user?.id
            return !!(myId && ride.volunteer?.userId === myId)
          }

          return false
        })
      })
    }

    // Exclusion Filter Logic (AND NOT Condition)
    if (excludedFilters.value.length > 0) {
      result = result.filter((ride: any) => {
        // Must NOT match ANY of the excluded filters
        return !excludedFilters.value.some((filter) => {
          const val = filter.value

          if (val.startsWith('status:')) {
            const status = val.replace('status:', '')
            return ride.status === status
          }

          if (val === 'assign:ME') {
            const myId = session.value?.user?.id
            return !!(myId && ride.volunteer?.userId === myId)
          }

          return false
        })
      })
    }

    // Date Range Filter
    if (startDate.value) {
      result = result.filter(
        (ride: any) => new Date(ride.scheduledTime) >= new Date(startDate.value)
      )
    }
    if (endDate.value) {
      const end = new Date(endDate.value)
      end.setDate(end.getDate() + 1)
      result = result.filter((ride: any) => new Date(ride.scheduledTime) < end)
    }

    // Search Filter
    if (search.value) {
      const q = search.value.toLowerCase()
      result = result.filter((ride: any) => {
        return (
          ride.id.toLowerCase().includes(q) ||
          ride.client?.user?.name?.toLowerCase().includes(q) ||
          ride.volunteer?.user?.name?.toLowerCase().includes(q) ||
          ride.pickupDisplay?.toLowerCase().includes(q) ||
          ride.dropoffDisplay?.toLowerCase().includes(q)
        )
      })
    }

    return result
  })

  const columns: TableColumn<any>[] = [
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const color =
          {
            CREATED: 'info' as const,
            ASSIGNED: 'warning' as const,
            COMPLETED: 'success' as const,
          }[row.getValue('status') as string] || 'neutral'

        return h(UBadge, { class: 'capitalize', variant: 'subtle', color }, () =>
          row.getValue('status')
        )
      },
    },
    {
      id: 'volunteer',
      header: 'Volunteer',
      cell: ({ row }) => {
        return (
          row.original.volunteer?.user?.name ||
          h('span', { class: 'text-gray-400 italic' }, 'Unassigned')
        )
      },
    },
    {
      accessorKey: 'scheduledTime',
      header: 'Date',
      cell: ({ row }) => {
        return new Date(row.getValue('scheduledTime')).toLocaleString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      },
    },
    {
      accessorKey: 'client.user.name',
      header: 'Client',
    },
    {
      accessorKey: 'pickupDisplay',
      header: 'Pickup',
    },
    {
      accessorKey: 'dropoffDisplay',
      header: 'Dropoff',
    },
  ]

  async function onSelect(e: Event, row: TableRow<any>) {
    await navigateTo(`/rides/${row.original.id}`)
  }

  async function onSubmit(event: any) {
    try {
      // Convert local datetime-local string to ISO string (UTC)
      const scheduledTimeISO = new Date(event.data.scheduledTime).toISOString()
      
      // Handle volunteerId being an object or string
      const vId = typeof event.data.volunteerId === 'object' 
        ? event.data.volunteerId.value 
        : event.data.volunteerId

      await $fetch('/api/post/rides', {
        method: 'POST',
        body: {
          ...event.data,
          volunteerId: vId,
          scheduledTime: scheduledTimeISO,
        },
      })
      isCreateModalOpen.value = false
      await refreshRides()
      // Reset state
      Object.assign(state, {
        clientId: '',
        pickupDisplay: '',
        dropoffDisplay: '',
        scheduledTime: '',
        notes: '',
        volunteerId: undefined,
      })
    } catch (err) {
      console.error('Failed to create ride', err)
    }
  }
</script>

<template>
  <UContainer class="py-10">
    <div class="mb-6 flex items-center justify-end">
      <UButton
        v-if="isAdmin"
        label="Create Ride"
        icon="i-lucide-plus"
        color="primary"
        @click="isCreateModalOpen = true"
      />
    </div>

    <div class="mb-6 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search..."
        class="w-full min-w-[200px] flex-1 sm:w-auto"
      />
      <USelectMenu
        v-model="activeFilters"
        :items="filterOptions"
        multiple
        :searchable="false"
        :ui="{ input: 'hidden' }"
        placeholder="Include Status"
        class="w-full sm:w-64"
      />
      <USelectMenu
        v-model="excludedFilters"
        :items="filterOptions"
        multiple
        :searchable="false"
        :ui="{ input: 'hidden' }"
        placeholder="Exclude Status"
        class="w-full sm:w-64"
      />
      <div class="flex items-center gap-2">
        <UInput v-model="startDate" type="date" placeholder="Start" class="w-full sm:w-auto" />
        <span class="text-gray-400">-</span>
        <UInput v-model="endDate" type="date" placeholder="End" class="w-full sm:w-auto" />
      </div>
    </div>

    <UTable
      :data="filteredRides"
      :columns="columns"
      :loading="status === 'pending'"
      class="w-full cursor-pointer"
      @select="onSelect"
    />

    <!-- Create Ride Modal -->
    <UModal v-model:open="isCreateModalOpen" title="Create New Ride">
      <template #content>
        <div class="max-h-[70vh] overflow-y-auto p-4">
          <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
            <UFormField label="Client" name="clientId">
              <USelect
                v-model="state.clientId"
                :items="clients?.map((c) => ({ label: c.user.name, value: c.id })) || []"
                placeholder="Select a client"
                class="w-full"
              />
            </UFormField>

            <div class="space-y-2 rounded-lg border p-4 dark:border-gray-700">
              <h3 class="text-sm font-bold text-gray-700 dark:text-gray-300">Pickup Address</h3>

              <!-- Custom Autocomplete -->
              <div class="relative mb-2">
                <UInput
                  v-model="pickupSearch"
                  placeholder="Type to find existing address (e.g. Street)..."
                  icon="i-lucide-search"
                  autocomplete="off"
                  class="w-full"
                />
                <div
                  v-if="pickupOptions?.length > 0 && pickupSearch"
                  class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                >
                  <button
                    v-for="opt in pickupOptions"
                    :key="opt.id"
                    type="button"
                    class="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    @click="onPickupSelect(opt)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <UFormField label="Street" name="pickup.street">
                <UInput v-model="state.pickup.street" placeholder="Street Address" class="w-full" />
              </UFormField>
              <div class="grid grid-cols-3 gap-2">
                <UFormField label="City" name="pickup.city"
                  ><UInput v-model="state.pickup.city" placeholder="City"
                /></UFormField>
                <UFormField label="State" name="pickup.state"
                  ><UInput v-model="state.pickup.state" placeholder="State"
                /></UFormField>
                <UFormField label="Zip" name="pickup.zip"
                  ><UInput v-model="state.pickup.zip" placeholder="Zip"
                /></UFormField>
              </div>
            </div>

            <div class="space-y-2 rounded-lg border p-4 dark:border-gray-700">
              <h3 class="text-sm font-bold text-gray-700 dark:text-gray-300">Dropoff Address</h3>

              <!-- Custom Autocomplete -->
              <div class="relative mb-2">
                <UInput
                  v-model="dropoffSearch"
                  placeholder="Type to find existing address (e.g. Street)..."
                  icon="i-lucide-search"
                  autocomplete="off"
                  class="w-full"
                />
                <div
                  v-if="dropoffOptions?.length > 0 && dropoffSearch"
                  class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                >
                  <button
                    v-for="opt in dropoffOptions"
                    :key="opt.id"
                    type="button"
                    class="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    @click="onDropoffSelect(opt)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <UFormField label="Street" name="dropoff.street">
                <UInput v-model="state.dropoff.street" placeholder="Street Address" class="w-full" />
              </UFormField>
              <div class="grid grid-cols-3 gap-2">
                <UFormField label="City" name="dropoff.city"
                  ><UInput v-model="state.dropoff.city" placeholder="City"
                /></UFormField>
                <UFormField label="State" name="dropoff.state"
                  ><UInput v-model="state.dropoff.state" placeholder="State"
                /></UFormField>
                <UFormField label="Zip" name="dropoff.zip"
                  ><UInput v-model="state.dropoff.zip" placeholder="Zip"
                /></UFormField>
              </div>
            </div>

            <UFormField label="Volunteer" name="volunteerId" v-if="isAdmin">
              <USelectMenu
                v-model="state.volunteerId"
                :items="volunteerOptions"
                placeholder="Select a volunteer"
                class="w-full"
                searchable
                option-attribute="label"
              />
            </UFormField>

            <UFormField label="Scheduled Time" name="scheduledTime">
              <UInput v-model="state.scheduledTime" type="datetime-local" class="w-full" />
            </UFormField>

            <UFormField label="Notes" name="notes">
              <UTextarea
                v-model="state.notes"
                placeholder="Additional instructions..."
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-2 pt-4">
              <UButton
                label="Cancel"
                color="neutral"
                variant="ghost"
                @click="isCreateModalOpen = false"
              />
              <UButton type="submit" label="Create" color="primary" />
            </div>
          </UForm>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>