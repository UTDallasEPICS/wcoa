<script setup lang="ts">
  import { h, resolveComponent } from 'vue'
  import type { TableColumn, TableRow } from '@nuxt/ui'
  import * as z from 'zod'

  const UBadge = resolveComponent('UBadge')

  const { data: rides, status, refresh: refreshRides } = await useFetch('/api/get/rides')
  const { data: clients } = await useFetch('/api/get/clients')

  const search = ref('')
  const statusFilter = ref('All')
  const dateFilter = ref('')
  const isCreateModalOpen = ref(false)

  const statusOptions = ['All', 'CREATED', 'ASSIGNED', 'COMPLETED', 'CANCELLED']

  const schema = z.object({
    clientId: z.string().min(1, 'Client is required'),
    pickupDisplay: z.string().min(1, 'Pickup address is required'),
    dropoffDisplay: z.string().min(1, 'Dropoff address is required'),
    scheduledTime: z.string().min(1, 'Scheduled time is required'),
    notes: z.string().optional(),
  })

  const state = reactive({
    clientId: '',
    pickupDisplay: '',
    dropoffDisplay: '',
    scheduledTime: '',
    notes: '',
  })

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
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Rides</h1>
      <UButton
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
      <USelect v-model="statusFilter" :items="statusOptions" placeholder="Status" class="w-full sm:w-40" />
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
        <UForm :schema="schema" :state="state" class="space-y-4 p-4" @submit="onSubmit">
          <UFormField label="Client" name="clientId">
            <USelect
              v-model="state.clientId"
              :items="clients?.map((c) => ({ label: c.user.name, value: c.id })) || []"
              placeholder="Select a client"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Pickup Address" name="pickupDisplay">
            <UInput
              v-model="state.pickupDisplay"
              placeholder="123 Start St, City, ST"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Dropoff Address" name="dropoffDisplay">
            <UInput
              v-model="state.dropoffDisplay"
              placeholder="456 End Ave, City, ST"
              class="w-full"
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
      </template>
    </UModal>
  </UContainer>
</template>
