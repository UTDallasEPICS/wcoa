<script setup lang="ts">
  import DashboardMetricCard from '~/components/DashboardMetricCard.vue'

  const route = useRoute()
  const router = useRouter()

  // --- Defaults ---
  const currentYear = new Date().getFullYear()
  const startOfYear = `${currentYear}-01-01`
  const endOfYear = `${currentYear}-12-31`

  // --- State ---
  // Completion Rate: Default All Time
  const completionStart = ref((route.query.completionStart as string) || '')
  const completionEnd = ref((route.query.completionEnd as string) || '')

  // Top Riders: Default Year to Date
  const ridersStart = ref((route.query.ridersStart as string) || startOfYear)
  const ridersEnd = ref((route.query.ridersEnd as string) || endOfYear)

  // Total Hours: Default Year to Date
  const hoursStart = ref((route.query.hoursStart as string) || startOfYear)
  const hoursEnd = ref((route.query.hoursEnd as string) || endOfYear)

  // --- URL Sync ---
  watch(
    [completionStart, completionEnd, ridersStart, ridersEnd, hoursStart, hoursEnd],
    () => {
      router.push({
        query: {
          ...route.query,
          completionStart: completionStart.value || undefined,
          completionEnd: completionEnd.value || undefined,
          ridersStart: ridersStart.value || undefined,
          ridersEnd: ridersEnd.value || undefined,
          hoursStart: hoursStart.value || undefined,
          hoursEnd: hoursEnd.value || undefined,
        },
      })
    },
    { deep: true }
  )

  // --- Data Fetching ---
  const { data: completionData, status: completionStatus } = await useFetch(
    '/api/get/metrics/completionRate',
    {
      params: {
        startDate: completionStart,
        endDate: completionEnd,
      },
    }
  )

  const { data: hoursData, status: hoursStatus } = await useFetch('/api/get/metrics/hours', {
    params: {
      startDate: hoursStart,
      endDate: hoursEnd,
    },
  })

  const { data: topRiders, status: ridersStatus } = await useFetch('/api/get/metrics/topRiders', {
    params: {
      startDate: ridersStart,
      endDate: ridersEnd,
    },
  })

  const ridersColumns = [
    { accessorKey: 'name', header: 'Client Name' },
    { accessorKey: 'completedRides', header: 'Completed Rides' },
  ]
</script>

<template>
  <UContainer class="py-10">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
    </div>

    <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
      <!-- Ride Completion Metric -->
      <DashboardMetricCard
        title="Ride Completion Rate"
        icon="i-lucide-check-circle"
        icon-class="text-success"
        v-model:start-date="completionStart"
        v-model:end-date="completionEnd"
        :loading="completionStatus === 'pending'"
      >
        <div class="space-y-4 py-6 text-center">
          <div class="text-primary text-5xl font-extrabold">
            {{ completionData?.percentage || 0 }}%
          </div>
          <div class="px-8">
            <UProgress :model-value="completionData?.percentage || 0" size="lg" :animation="null" />
          </div>
          <div class="flex justify-center gap-8 text-sm text-gray-500">
            <div>
              <span class="font-bold text-gray-900 dark:text-white">{{
                completionData?.completed || 0
              }}</span>
              Completed
            </div>
            <div>
              <span class="font-bold text-gray-900 dark:text-white">{{
                completionData?.total || 0
              }}</span>
              Total
            </div>
          </div>
        </div>
      </DashboardMetricCard>

      <!-- Total Hours Ridden -->
      <DashboardMetricCard
        title="Total Hours Ridden"
        icon="i-lucide-clock"
        icon-class="text-info"
        v-model:start-date="hoursStart"
        v-model:end-date="hoursEnd"
        :loading="hoursStatus === 'pending'"
      >
        <div class="flex h-full flex-col items-center justify-center space-y-2 py-6 text-center">
          <div class="text-primary text-5xl font-extrabold">
            {{ hoursData?.totalHours || 0 }}
          </div>
          <div class="text-sm text-gray-500">Hours</div>
        </div>
      </DashboardMetricCard>

      <!-- Top Riders Leaderboard -->
      <DashboardMetricCard
        title="Top Riders"
        icon="i-lucide-trophy"
        icon-class="text-warning"
        v-model:start-date="ridersStart"
        v-model:end-date="ridersEnd"
        :loading="ridersStatus === 'pending'"
      >
        <UTable :data="topRiders || []" :columns="ridersColumns" class="flex-1">
          <template #empty-state>
            <div class="flex flex-col items-center justify-center py-12 text-center text-gray-500">
              <UIcon name="i-lucide-calendar-x" class="mb-2 size-8 text-gray-400" />
              <p>No completed rides found</p>
              <p class="text-xs">Try adjusting the date range</p>
            </div>
          </template>
        </UTable>
      </DashboardMetricCard>
    </div>
  </UContainer>
</template>
