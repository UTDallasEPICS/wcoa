<script setup lang="ts">
  import type { RideAddressForm } from '../utils/rideForm'

  // Search-first address entry (issue #19 logic, extracted + streamlined). Shows
  // a compact summary once an address is set (e.g. pre-filled from the client's
  // home), a search box with server suggestions to pick an existing address, and
  // an "Enter a new address" disclosure that reveals the manual fields. The v-model
  // is the structured { street, city, state, zip } object the ride form stores.
  const address = defineModel<RideAddressForm>({ required: true })

  const props = defineProps<{
    label: string
    // Optional note shown under the summary, e.g. "From Martha's home address".
    hint?: string
  }>()

  const search = ref('')
  const options = ref<any[]>([])
  const editing = ref(false) // user tapped Change / no address yet
  const manual = ref(false) // manual field entry revealed

  const isSet = computed(() => !!address.value.street?.trim())
  const showSummary = computed(() => isSet.value && !editing.value)
  const summary = computed(() =>
    [address.value.street, address.value.city, address.value.state, address.value.zip]
      .filter(Boolean)
      .join(', ')
  )

  async function fetchOptions(term: string) {
    const query = buildAddressQuery(term)
    if (!query) {
      options.value = []
      return
    }
    try {
      const results = await $fetch<any[]>('/api/get/addresses', { query })
      // Ignore stale responses that no longer match the current term.
      if ((term ?? '').trim() === query.search) options.value = (results ?? []).slice(0, 5)
    } catch (err) {
      console.error('Failed to fetch address suggestions', err)
      options.value = []
    }
  }
  const debouncedFetch = debounce((term: string) => fetchOptions(term), 250)

  watch(search, (term) => {
    if (!buildAddressQuery(term)) {
      debouncedFetch.cancel()
      options.value = []
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
    manual.value = false
  }

  function change() {
    editing.value = true
    manual.value = false
    search.value = ''
    options.value = []
  }

  function enterManually() {
    manual.value = true
    options.value = []
  }
</script>

<template>
  <div>
    <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label }}
    </label>

    <!-- Summary: address is set and we're not editing it -->
    <div
      v-if="showSummary"
      class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-2">
          <UIcon name="i-lucide-map-pin" class="text-primary mt-0.5 size-4 shrink-0" />
          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ summary }}</span>
        </div>
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
        <UIcon name="i-lucide-check" class="size-3.5" />
        {{ hint }}
      </p>
    </div>

    <!-- Entry: search + suggestions, with a manual-entry disclosure -->
    <div v-else class="space-y-2">
      <div v-if="!manual" class="relative">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search for an address…"
          autocomplete="off"
          class="w-full"
        />
        <div
          v-if="options.length > 0 && search"
          class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <button
            v-for="opt in options"
            :key="opt.id"
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="pick(opt)"
          >
            <UIcon name="i-lucide-map-pin" class="size-3.5 shrink-0 text-gray-400" />
            <span class="truncate">{{ opt.label }}</span>
          </button>
        </div>
      </div>

      <!-- Manual fields -->
      <div v-if="manual" class="space-y-2">
        <UInput v-model="address.street" placeholder="Street address" class="w-full" />
        <UInput v-model="address.city" placeholder="City" class="w-full" />
        <div class="grid grid-cols-2 gap-2">
          <UInput v-model="address.state" placeholder="State" />
          <UInput v-model="address.zip" placeholder="Zip" />
        </div>
      </div>

      <div class="flex items-center justify-between">
        <UButton
          v-if="!manual"
          label="Enter a new address"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-plus"
          @click="enterManually"
        />
        <UButton
          v-else
          label="Search instead"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-search"
          @click="manual = false"
        />
        <UButton
          v-if="isSet"
          label="Cancel"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="editing = false"
        />
      </div>
    </div>
  </div>
</template>
