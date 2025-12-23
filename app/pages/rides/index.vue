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
  const activeFilters = ref<{ label: string; value: string }[]>([])
  const excludedFilters = ref<{ label: string; value: string }[]>([])
  const startDate = ref('')
  const endDate = ref('')
  const isCreateModalOpen = ref(false)

  const filterOptions = computed(() => {
    const options = [
      { label: 'Created', value: 'status:CREATED' },
      { label: 'Assigned', value: 'status:ASSIGNED' },
      { label: 'Completed', value: 'status:COMPLETED' }
    ]
    if (!isAdmin.value) {
      options.push({ label: 'Assigned to Me', value: 'assign:ME' })
    }
    return options
  })

  // ... (Schema and state definitions remain the same) ...

  const filteredRides = computed(() => {
    if (!rides.value) return []

    let result = rides.value

    // Consolidated Filter Logic (OR Condition for Inclusion)
    if (activeFilters.value.length > 0) {
      result = result.filter((ride: any) => {
        return activeFilters.value.some(filter => {
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
        return !excludedFilters.value.some(filter => {
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
      result = result.filter((ride: any) => new Date(ride.scheduledTime) >= new Date(startDate.value))
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
        return row.original.volunteer?.user?.name || h('span', { class: 'text-gray-400 italic' }, 'Unassigned')
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
        placeholder="Include Status / Volunteer"
        class="w-full sm:w-64"
      />
      <USelectMenu
        v-model="excludedFilters"
        :items="filterOptions"
        multiple
        :searchable="false"
        :ui="{ input: 'hidden' }"
        placeholder="Exclude Status / Volunteer"
        class="w-full sm:w-64"
      />
      <div class="flex items-center gap-2">
        <UInput 
          v-model="startDate" 
          type="date" 
          placeholder="Start" 
          class="w-full sm:w-auto" 
        />
        <span class="text-gray-400">-</span>
        <UInput 
          v-model="endDate" 
          type="date" 
          placeholder="End" 
          class="w-full sm:w-auto" 
        />
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
