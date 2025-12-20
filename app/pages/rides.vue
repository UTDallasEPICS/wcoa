<script setup lang="ts">
  import { h, resolveComponent } from 'vue'
  import type { TableColumn } from '@nuxt/ui'

  const UBadge = resolveComponent('UBadge')
  const { data: rides, status } = await useFetch('/api/get/rides')

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
</script>

<template>
  <UContainer class="py-10">
    <UPageBody>
      <UTable
        :data="rides || []"
        :columns="columns"
        :loading="status === 'pending'"
        class="w-full"
      />
    </UPageBody>
  </UContainer>
</template>
