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

  const search = ref('')
  const statusFilter = ref('All')
  const dateFilter = ref('')
  const isCreateModalOpen = ref(false)

  const statusOptions = ['All', 'CREATED', 'ASSIGNED', 'COMPLETED', 'CANCELLED']

  const schema = z.object({
    clientId: z.string().min(1, 'Client is required'),
    pickup: z.object({
      street: z.string().min(1, 'Street is required'),
      city: z.string().min(1, 'City is required'),
      state: z.string().min(1, 'State is required'),
      zip: z.string().min(1, 'Zip is required'),
    }),
    dropoff: z.object({
      street: z.string().min(1, 'Street is required'),
      city: z.string().min(1, 'City is required'),
      state: z.string().min(1, 'State is required'),
      zip: z.string().min(1, 'Zip is required'),
    }),
    scheduledTime: z.string().min(1, 'Scheduled time is required'),
    notes: z.string().optional(),
  })

  const state = reactive({
    clientId: '',
    pickup: { street: '', city: '', state: '', zip: '' },
    dropoff: { street: '', city: '', state: '', zip: '' },
    scheduledTime: '',
    notes: '',
  })

  // Dummy refs for SelectMenu v-model (we only care about @change)
  const pickupSelectModel = ref(null)
  const dropoffSelectModel = ref(null)
  
  // Search State
  const pickupSearch = ref('')
  const dropoffSearch = ref('')

  // Fetch Options with Debounce
  const { data: pickupOptions } = await useFetch('/api/get/addresses', {
    params: { search: pickupSearch },
    watch: [pickupSearch],
    debounce: 300
  })

  const { data: dropoffOptions } = await useFetch('/api/get/addresses', {
    params: { search: dropoffSearch },
    watch: [dropoffSearch],
    debounce: 300
  })

  function onPickupSelect(val: any) {
    if (val && val.address) {
      state.pickup.street = val.address.street
      state.pickup.city = val.address.city
      state.pickup.state = val.address.state
      state.pickup.zip = val.address.zip
      pickupSearch.value = '' // Clear search to hide dropdown
    }
  }

  function onDropoffSelect(val: any) {
    if (val && val.address) {
      state.dropoff.street = val.address.street
      state.dropoff.city = val.address.city
      state.dropoff.state = val.address.state
      state.dropoff.zip = val.address.zip
      dropoffSearch.value = '' // Clear search
    }
  }

  watch(
    () => state.clientId,
    (newId) => {
      const client = clients.value?.find((c: any) => c.id === newId)
      if (client?.homeAddress) {
        state.pickup.street = client.homeAddress.street
        state.pickup.city = client.homeAddress.city
        state.pickup.state = client.homeAddress.state
        state.pickup.zip = client.homeAddress.zip
      }
    }
  )

  const filteredRides = computed(() => {
    if (!rides.value) return []

    let result = rides.value

    // Status Filter
    if (statusFilter.value !== 'All') {
      result = result.filter((ride: any) => ride.status === statusFilter.value)
    }

    // Date Filter
    if (dateFilter.value) {
      result = result.filter((ride: any) => {
        const rideDate = new Date(ride.scheduledTime).toISOString().split('T')[0]
        return rideDate === dateFilter.value
      })
    }

    // Search Filter
    if (search.value) {
      const q = search.value.toLowerCase()
      result = result.filter((ride: any) => {
        return (
          ride.id.toLowerCase().includes(q) ||
          ride.client?.user?.name?.toLowerCase().includes(q) ||
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
            CANCELLED: 'error' as const,
          }[row.getValue('status') as string] || 'neutral'

        return h(UBadge, { class: 'capitalize', variant: 'subtle', color }, () =>
          row.getValue('status')
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
      await $fetch('/api/post/rides', {
        method: 'POST',
        body: event.data,
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

    <div class="mb-6 flex flex-col gap-4 sm:flex-row">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search rides..."
        class="flex-1"
      />
      <USelect
        v-model="statusFilter"
        :items="statusOptions"
        placeholder="Status"
        class="w-full sm:w-40"
      />
      <UInput v-model="dateFilter" type="date" class="w-full sm:w-auto" />
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
    
                <div class="rounded-lg border p-4 space-y-2 dark:border-gray-700">
                  <h3 class="font-bold text-sm text-gray-700 dark:text-gray-300">Pickup Address</h3>
                  
                  <!-- Custom Autocomplete -->
                  <div class="relative mb-2">
                    <UInput 
                      v-model="pickupSearch" 
                      placeholder="Type to find existing address (e.g. Street)..." 
                      icon="i-lucide-search"
                      autocomplete="off"
                    />
                    <div 
                      v-if="pickupOptions?.length > 0 && pickupSearch"
                      class="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
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
                    <UInput v-model="state.pickup.street" placeholder="Street Address" />
                  </UFormField>            <div class="grid grid-cols-3 gap-2">
              <UFormField label="City" name="pickup.city"><UInput v-model="state.pickup.city" placeholder="City" /></UFormField>
              <UFormField label="State" name="pickup.state"><UInput v-model="state.pickup.state" placeholder="State" /></UFormField>
              <UFormField label="Zip" name="pickup.zip"><UInput v-model="state.pickup.zip" placeholder="Zip" /></UFormField>
            </div>
          </div>

          <div class="rounded-lg border p-4 space-y-2 dark:border-gray-700">
            <h3 class="font-bold text-sm text-gray-700 dark:text-gray-300">Dropoff Address</h3>
            
            <!-- Custom Autocomplete -->
            <div class="relative mb-2">
              <UInput 
                v-model="dropoffSearch" 
                placeholder="Type to find existing address (e.g. Street)..." 
                icon="i-lucide-search"
                autocomplete="off"
              />
              <div 
                v-if="dropoffOptions?.length > 0 && dropoffSearch"
                class="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
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
              <UInput v-model="state.dropoff.street" placeholder="Street Address" />
            </UFormField>
            <div class="grid grid-cols-3 gap-2">
              <UFormField label="City" name="dropoff.city"><UInput v-model="state.dropoff.city" placeholder="City" /></UFormField>
              <UFormField label="State" name="dropoff.state"><UInput v-model="state.dropoff.state" placeholder="State" /></UFormField>
              <UFormField label="Zip" name="dropoff.zip"><UInput v-model="state.dropoff.zip" placeholder="Zip" /></UFormField>
            </div>
          </div>

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
