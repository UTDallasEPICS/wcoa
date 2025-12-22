<script setup lang="ts">
  const props = defineProps<{
    title: string
    icon: string
    iconClass?: string
    startDate?: string
    endDate?: string
    loading?: boolean
  }>()

  const emit = defineEmits<{
    (e: 'update:startDate', value: string): void
    (e: 'update:endDate', value: string): void
  }>()

  const isFilterOpen = ref(false)

  const localStart = computed({
    get: () => props.startDate || '',
    set: (val) => emit('update:startDate', val),
  })

  const localEnd = computed({
    get: () => props.endDate || '',
    set: (val) => emit('update:endDate', val),
  })

  const hasActiveFilter = computed(() => !!props.startDate || !!props.endDate)

  function toggleFilter() {
    isFilterOpen.value = !isFilterOpen.value
  }

  function clearFilter() {
    emit('update:startDate', '')
    emit('update:endDate', '')
  }
</script>

<template>
  <UCard class="flex h-full flex-col">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon :name="icon" :class="['size-5', iconClass]" />
          <h2 class="font-bold text-gray-900 dark:text-white">{{ title }}</h2>
        </div>
        <UButton
          :color="hasActiveFilter ? 'primary' : 'neutral'"
          variant="ghost"
          icon="i-lucide-calendar"
          size="sm"
          @click="toggleFilter"
        />
      </div>
    </template>

    <!-- Collapsible Filter Section -->
    <div
      v-if="isFilterOpen"
      class="mb-4 space-y-3 border-b border-gray-100 pb-4 dark:border-gray-800"
    >
      <div class="flex items-center gap-2">
        <div class="flex-1">
          <label class="mb-1 block text-xs font-medium text-gray-500">Start</label>
          <UInput v-model="localStart" type="date" size="xs" class="w-full" />
        </div>
        <div class="flex-1">
          <label class="mb-1 block text-xs font-medium text-gray-500">End</label>
          <UInput v-model="localEnd" type="date" size="xs" class="w-full" />
        </div>
      </div>
      <div class="flex justify-end">
        <UButton
          v-if="hasActiveFilter"
          label="Clear Filter"
          size="xs"
          color="error"
          variant="link"
          class="p-0"
          @click="clearFilter"
        />
        <span v-else class="text-xs text-gray-400 italic">Showing all time</span>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1">
      <slot v-if="!loading" />
      <div v-else class="space-y-4">
        <USkeleton class="h-8 w-full" />
        <USkeleton class="h-4 w-2/3" />
      </div>
    </div>
  </UCard>
</template>
