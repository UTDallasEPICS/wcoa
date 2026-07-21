<script setup lang="ts">
  import type { RideAddressForm } from '../utils/rideForm'

  // One unified address field: search and pick a real, verified address via the
  // open-source Nominatim geocoder (/api/get/geocode). No stored-address search
  // and no parallel manual street/city/state/zip fields — you type, pick a
  // suggestion, done. The v-model is the structured address the ride form stores.
  const address = defineModel<RideAddressForm>({ required: true })

  const props = defineProps<{
    label: string
    // Optional note shown under the selected address, e.g. "From <client>'s home".
    hint?: string
  }>()

  const search = ref('')
  const options = ref<any[]>([])
  const loading = ref(false)
  const searched = ref(false) // a query has completed — lets us show "no results"
  const editing = ref(false) // replacing an already-set address

  const isSet = computed(() => !!address.value.street?.trim())
  const summary = computed(() =>
    [address.value.street, address.value.city, address.value.state, address.value.zip]
      .filter(Boolean)
      .join(', ')
  )

  async function fetchOptions(term: string) {
    const q = (term ?? '').trim()
    if (q.length < 3) {
      options.value = []
      searched.value = false
      return
    }
    loading.value = true
    try {
      const results = await $fetch<any[]>('/api/get/geocode', { query: { q } })
      // Ignore stale responses that no longer match the current input.
      if ((search.value ?? '').trim() === q) {
        options.value = results ?? []
        searched.value = true
      }
    } catch (err) {
      console.error('Address search failed', err)
      options.value = []
      searched.value = true
    } finally {
      loading.value = false
    }
  }
  const debouncedFetch = debounce((term: string) => fetchOptions(term), 300)

  watch(search, (term) => {
    searched.value = false
    if ((term ?? '').trim().length < 3) {
      debouncedFetch.cancel()
      options.value = []
      loading.value = false
      return
    }
    debouncedFetch(term)
  })

  function pick(opt: any) {
    Object.assign(address.value, {
      street: opt.address.street,
      city: opt.address.city,
      state: opt.address.state,
      zip: opt.address.zip,
    })
    search.value = ''
    options.value = []
    editing.value = false
    searched.value = false
  }

  function change() {
    editing.value = true
    search.value = ''
    options.value = []
    searched.value = false
  }

  function cancel() {
    editing.value = false
    search.value = ''
    options.value = []
  }
</script>

<template>
  <div>
    <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label }}
    </label>

    <!-- Selected address -->
    <div
      v-if="isSet && !editing"
      class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
    >
      <div class="flex items-start justify-between gap-3">
        <span class="flex items-start gap-2 text-sm font-medium text-gray-900 dark:text-white">
          <UIcon name="i-lucide-map-pin" class="text-primary mt-0.5 size-4 shrink-0" />
          {{ summary }}
        </span>
        <UButton
          label="Change"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-pencil"
          @click="change"
        />
      </div>
      <p v-if="hint" class="text-primary mt-2 flex items-center gap-1.5 text-xs">
        <UIcon name="i-lucide-check" class="size-3.5 shrink-0" />
        {{ hint }}
      </p>
    </div>

    <!-- Search + autocomplete -->
    <div v-else class="relative">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        :loading="loading"
        placeholder="Search for an address…"
        autocomplete="off"
        class="w-full"
      />

      <div
        v-if="search.trim().length >= 3"
        class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
      >
        <button
          v-for="opt in options"
          :key="`${opt.lat},${opt.lon},${opt.label}`"
          type="button"
          class="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          @click="pick(opt)"
        >
          <UIcon name="i-lucide-map-pin" class="mt-0.5 size-3.5 shrink-0 text-gray-400" />
          <span>{{ opt.label }}</span>
        </button>
        <p v-if="loading" class="px-3 py-2 text-sm text-gray-500">Searching…</p>
        <p v-else-if="searched && !options.length" class="px-3 py-2 text-sm text-gray-500">
          No matching address found — check the spelling.
        </p>
      </div>

      <div class="mt-1.5 flex items-center justify-between">
        <span class="text-xs text-gray-400">Addresses from OpenStreetMap</span>
        <UButton
          v-if="isSet"
          label="Cancel"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="cancel"
        />
      </div>
    </div>
  </div>
</template>
