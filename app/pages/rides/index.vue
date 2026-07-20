<script setup lang="ts">
  import { h, resolveComponent } from 'vue'
  import type { TableColumn, TableRow } from '@nuxt/ui'
  import * as z from 'zod'
  import { authClient } from '../../utils/auth-client'
  import {
    BASE_FILTER_OPTIONS,
    DEFAULT_EXCLUDED_FILTERS,
    sanitizeSavedFilters,
  } from '../../utils/rideFilters'

  const UBadge = resolveComponent('UBadge')
  const UIcon = resolveComponent('UIcon')

  const { data: session } = await authClient.useSession(useFetch)
  const isAdmin = computed(() => session.value?.user?.role === 'ADMIN')

  // Dropdowns need the full (bounded) roster, not a page — the list endpoints
  // are now paginated (issue #13), so the pickers use dedicated options
  // endpoints that return a minimal { id, name(, homeAddress) } shape.
  const { data: clients } = await useFetch('/api/get/clients/options')
  const { data: volunteers } = await useFetch('/api/get/volunteers/options')

  const search = ref('')
  const savedSort = useCookie<string>('ride-sort', { default: () => 'desc' })
  const sort = ref(savedSort.value)

  watch(sort, (newVal) => {
    savedSort.value = newVal
  })

  // --- Server-side pagination (issue #13) ---
  // The rides list used to load the entire table and filter it client-side.
  // Filtering, sorting and pagination now all happen on the server, so the
  // table binds directly to the returned page. Debounce search so typing
  // doesn't fire a request per keystroke.
  const PAGE_SIZE = 20
  const page = ref(1)
  const debouncedSearch = ref('')
  const applyDebouncedSearch = debounce((value: string) => {
    debouncedSearch.value = value
  }, 300)
  watch(search, (value) => applyDebouncedSearch(value))
  const startDate = ref('')
  const endDate = ref('')

  // Persisted State
  const savedActiveFilters = useCookie<{ label: string; value: string }[]>('ride-active-filters', {
    default: () => [],
  })
  const savedExcludedFilters = useCookie<{ label: string; value: string }[]>(
    'ride-excluded-filters',
    {
      default: () => [...DEFAULT_EXCLUDED_FILTERS], // Default exclude (see issue #22)
    }
  )

  // All values the UI can actually toggle. Includes `assign:ME` because it is a
  // valid (volunteer-only) filter; base status options are always valid. Any
  // saved value outside this set (e.g. the stale `status:CANCELLED`) is stripped
  // on load so existing users aren't stuck with an un-toggleable filter (#22).
  const knownFilterValues = [...BASE_FILTER_OPTIONS.map((o) => o.value), 'assign:ME']

  const activeFilters = ref<{ label: string; value: string }[]>(
    sanitizeSavedFilters(savedActiveFilters.value, knownFilterValues)
  )
  const excludedFilters = ref<{ label: string; value: string }[]>(
    sanitizeSavedFilters(savedExcludedFilters.value, knownFilterValues)
  )

  // Include/exclude filter chips are sent to the backend as comma-separated
  // values (e.g. "status:CREATED,assign:ME"); the server applies them so they
  // compose with pagination instead of only filtering the current page (#13).
  const includeParam = computed(() =>
    activeFilters.value.map((f) => f.value).join(',')
  )
  const excludeParam = computed(() =>
    excludedFilters.value.map((f) => f.value).join(',')
  )

  // useFetch watches these reactive query refs and refetches automatically, so
  // changing page / sort / search / filters re-queries the server for that page.
  const {
    data: ridesData,
    status,
    refresh: refreshRides,
  } = await useFetch('/api/get/rides', {
    query: {
      sort,
      page,
      pageSize: PAGE_SIZE,
      search: computed(() => debouncedSearch.value || undefined),
      startDate: computed(() => startDate.value || undefined),
      endDate: computed(() => endDate.value || undefined),
      include: computed(() => includeParam.value || undefined),
      exclude: computed(() => excludeParam.value || undefined),
    },
  })

  const rides = computed(() => ridesData.value?.items ?? [])
  const total = computed(() => ridesData.value?.total ?? 0)

  // Any filter/search/sort change should return to the first page so results
  // aren't hidden on a page that no longer exists.
  watch([debouncedSearch, startDate, endDate, includeParam, excludeParam, sort], () => {
    page.value = 1
  })

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

  const isCreateModalOpen = ref(false)

  const filterOptions = computed(() => {
    const options = [...BASE_FILTER_OPTIONS]
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
    pickupTime: z.string().optional(),
    notes: z.string().optional(),
    volunteerId: z.any().optional(),
  })

  // --- State ---
  const state = reactive(blankRideForm())

  // --- Autocomplete Logic ---
  // Query the backend with `?search=` (debounced) instead of fetching a fixed
  // list of 20 once on mount and filtering it client-side. This lets any address
  // in the table surface, not just the first 20 alphabetically (issue #19). The
  // query-building and debounce logic live in a pure, unit-tested helper.
  const pickupSearch = ref('')
  const dropoffSearch = ref('')

  const pickupOptions = ref<any[]>([])
  const dropoffOptions = ref<any[]>([])

  async function fetchAddressOptions(search: string, target: Ref<any[]>) {
    const query = buildAddressQuery(search)
    if (!query) {
      target.value = []
      return
    }
    try {
      const results = await $fetch<any[]>('/api/get/addresses', { query })
      // Ignore stale responses: only apply if the input still matches the term
      // we searched for (avoids out-of-order results overwriting newer ones).
      if ((search ?? '').trim() === query.search) {
        target.value = (results ?? []).slice(0, 5)
      }
    } catch (err) {
      console.error('Failed to fetch address suggestions', err)
      target.value = []
    }
  }

  const debouncedPickupFetch = debounce(
    (search: string) => fetchAddressOptions(search, pickupOptions),
    250
  )
  const debouncedDropoffFetch = debounce(
    (search: string) => fetchAddressOptions(search, dropoffOptions),
    250
  )

  watch(pickupSearch, (term) => {
    if (!buildAddressQuery(term)) {
      // Clear immediately (and cancel any pending fetch) when the box empties.
      debouncedPickupFetch.cancel()
      pickupOptions.value = []
      return
    }
    debouncedPickupFetch(term)
  })

  watch(dropoffSearch, (term) => {
    if (!buildAddressQuery(term)) {
      debouncedDropoffFetch.cancel()
      dropoffOptions.value = []
      return
    }
    debouncedDropoffFetch(term)
  })

  const volunteerOptions = computed(() => {
    if (!volunteers.value) return []
    const list = volunteers.value.map((v: any) => ({
      label: v.name || 'Unknown Volunteer',
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
          zip: client.homeAddress.zip,
        })
      }
    }
  )

  function onPickupSelect(opt: any) {
    Object.assign(state.pickup, {
      street: opt.address.street,
      city: opt.address.city,
      state: opt.address.state,
      zip: opt.address.zip,
    })
    pickupSearch.value = ''
  }

  function onDropoffSelect(opt: any) {
    Object.assign(state.dropoff, {
      street: opt.address.street,
      city: opt.address.city,
      state: opt.address.state,
      zip: opt.address.zip,
    })
    dropoffSearch.value = ''
  }

  // Filtering, searching, date-range and sorting are all applied server-side
  // (issue #13) so they compose with pagination. The table binds directly to
  // the returned page (`rides`) — no client-side filtering pass.

  // Status → badge color, shared by the desktop table and the mobile cards so
  // the two breakpoints can never drift apart.
  type StatusColor = 'info' | 'warning' | 'success' | 'error' | 'neutral'
  function statusColor(status: string): StatusColor {
    const map: Record<string, StatusColor> = {
      CREATED: 'info',
      ASSIGNED: 'warning',
      COMPLETED: 'success',
      CANCELLED: 'error',
    }
    return map[status] || 'neutral'
  }

  // Initials for the volunteer avatar chip (first + last word), shared shape
  // with the mobile cards' status treatment.
  function initials(name?: string | null): string {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return '?'
    const first = parts[0][0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase() || '?'
  }

  const columns: TableColumn<any>[] = [
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) =>
        h(
          UBadge,
          {
            class: 'capitalize',
            variant: 'subtle',
            color: statusColor(row.getValue('status') as string),
          },
          () => row.getValue('status')
        ),
    },
    {
      id: 'client',
      header: 'Client',
      cell: ({ row }) => {
        const phone = formatPhoneNumber(row.original.client?.user?.phone)
        return h('div', { class: 'leading-tight' }, [
          h(
            'div',
            { class: 'font-medium text-gray-900 dark:text-white' },
            row.original.client?.user?.name
          ),
          phone ? h('div', { class: 'text-xs text-gray-500' }, phone) : null,
        ])
      },
    },
    {
      id: 'route',
      header: 'Route',
      // Pickup and dropoff collapse into one cell so origin -> destination reads
      // at a glance instead of two separate, truncated address columns.
      cell: ({ row }) => {
        const leg = (icon: string, iconClass: string, text: string) =>
          h('div', { class: 'flex items-center gap-2' }, [
            h(UIcon, { name: icon, class: `${iconClass} size-3.5 shrink-0` }),
            h(
              'span',
              { class: 'max-w-[240px] truncate text-gray-600 dark:text-gray-300', title: text },
              text
            ),
          ])
        return h('div', { class: 'flex flex-col gap-1 text-sm' }, [
          leg('i-lucide-map-pin', 'text-primary', row.original.pickupDisplay),
          leg('i-lucide-flag', 'text-error', row.original.dropoffDisplay),
        ])
      },
    },
    {
      accessorKey: 'scheduledTime',
      header: 'When',
      cell: ({ row }) => {
        // Pinned locale + timezone so SSR and client agree (issue #98).
        const t = row.getValue('scheduledTime') as string
        return h('div', { class: 'leading-tight' }, [
          h(
            'div',
            { class: 'font-medium text-gray-900 dark:text-white' },
            formatDateTime(t, { weekday: 'short', month: 'short', day: 'numeric' })
          ),
          h(
            'div',
            { class: 'text-xs text-gray-500' },
            formatDateTime(t, { hour: '2-digit', minute: '2-digit' })
          ),
        ])
      },
    },
    {
      id: 'volunteer',
      header: 'Volunteer',
      cell: ({ row }) => {
        const name = row.original.volunteer?.user?.name
        if (!name) return h('span', { class: 'text-sm text-gray-400 italic' }, 'Unassigned')
        return h('div', { class: 'flex items-center gap-2' }, [
          h(
            'span',
            {
              class:
                'flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300',
            },
            initials(name)
          ),
          h('span', { class: 'text-sm' }, name),
        ])
      },
    },
    {
      id: 'chevron',
      header: '',
      cell: () =>
        h('div', { class: 'flex justify-end' }, [
          h(UIcon, { name: 'i-lucide-chevron-right', class: 'size-4 text-gray-400' }),
        ]),
    },
  ]

  async function onSelect(e: Event, row: TableRow<any>) {
    await navigateTo(`/rides/${row.original.id}`)
  }

  async function onSubmit(event: any) {
    try {
      // Convert local datetime-local string to ISO string (UTC)
      const scheduledTimeISO = new Date(event.data.scheduledTime).toISOString()
      const pickupTimeISO = event.data.pickupTime
        ? new Date(event.data.pickupTime).toISOString()
        : undefined

      // Handle volunteerId being an object or string
      const vId =
        typeof event.data.volunteerId === 'object'
          ? event.data.volunteerId.value
          : event.data.volunteerId

      await $fetch('/api/post/rides', {
        method: 'POST',
        body: {
          ...event.data,
          volunteerId: vId,
          scheduledTime: scheduledTimeISO,
          pickupTime: pickupTimeISO,
        },
      })
      isCreateModalOpen.value = false
      await refreshRides()
      // Reset state back to a blank form. Assign into the nested pickup/dropoff
      // objects so the reactive references are preserved and the address fields
      // actually clear (issue #11 — the old reset used non-existent
      // `pickupDisplay`/`dropoffDisplay` keys and never cleared the addresses).
      const blank = blankRideForm()
      Object.assign(state.pickup, blank.pickup)
      Object.assign(state.dropoff, blank.dropoff)
      state.clientId = blank.clientId
      state.scheduledTime = blank.scheduledTime
      state.pickupTime = blank.pickupTime
      state.notes = blank.notes
      state.volunteerId = blank.volunteerId
      pickupSearch.value = ''
      dropoffSearch.value = ''
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
      <USelect
        v-model="sort"
        :items="[
          { label: 'Oldest First', value: 'asc' },
          { label: 'Newest First', value: 'desc' },
        ]"
        class="w-36"
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

    <!-- Desktop (lg+): the full table. Below lg it would overflow sideways, so
         it's hidden in favour of the ride cards below. -->
    <UTable
      :data="rides"
      :columns="columns"
      :loading="status === 'pending'"
      class="hidden w-full cursor-pointer lg:block"
      @select="onSelect"
    />

    <!-- Mobile / tablet (below lg): each ride as a tap-friendly card. Same data,
         same navigation target — only the presentation differs. -->
    <div class="lg:hidden">
      <div v-if="status === 'pending'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <USkeleton v-for="n in 4" :key="n" class="h-44 w-full rounded-xl" />
      </div>

      <div
        v-else-if="rides.length === 0"
        class="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-500 dark:border-gray-700"
      >
        <UIcon name="i-lucide-calendar-x" class="mb-2 size-8 text-gray-400" />
        <p class="font-medium">No rides found</p>
        <p class="text-sm">Try adjusting your search or filters</p>
      </div>

      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NuxtLink
          v-for="ride in rides"
          :key="ride.id"
          :to="`/rides/${ride.id}`"
          class="focus-visible:ring-primary block rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 focus:outline-none focus-visible:ring-2 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
        >
          <div class="mb-2 flex items-center justify-between gap-2">
            <UBadge :color="statusColor(ride.status)" variant="subtle" class="capitalize">
              {{ ride.status }}
            </UBadge>
            <span class="text-xs font-medium text-gray-500">
              {{
                formatDateTime(ride.scheduledTime, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              }}
            </span>
          </div>

          <p class="font-semibold text-gray-900 dark:text-white">
            {{ ride.client?.user?.name }}
          </p>

          <div class="mt-3 space-y-1.5">
            <div class="flex items-start gap-2">
              <UIcon name="i-lucide-map-pin" class="text-primary mt-0.5 size-4 shrink-0" />
              <span class="text-sm text-gray-600 dark:text-gray-300">{{ ride.pickupDisplay }}</span>
            </div>
            <div class="flex items-start gap-2">
              <UIcon name="i-lucide-flag" class="text-error mt-0.5 size-4 shrink-0" />
              <span class="text-sm text-gray-600 dark:text-gray-300">{{
                ride.dropoffDisplay
              }}</span>
            </div>
          </div>

          <div
            class="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800"
          >
            <span
              v-if="ride.volunteer?.user?.name"
              class="text-sm text-gray-600 dark:text-gray-300"
            >
              {{ ride.volunteer.user.name }}
            </span>
            <span v-else class="text-sm text-gray-400 italic">Unassigned</span>
            <UIcon name="i-lucide-chevron-right" class="size-4 text-gray-400" />
          </div>
        </NuxtLink>
      </div>
    </div>

    <div v-if="total > PAGE_SIZE" class="mt-4 flex justify-end">
      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="PAGE_SIZE"
      />
    </div>

    <!-- Create Ride Modal -->
    <UModal v-model:open="isCreateModalOpen" title="Create New Ride">
      <template #content>
        <div class="max-h-[70vh] overflow-y-auto p-4">
          <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
            <UFormField label="Client" name="clientId">
              <USelect
                v-model="state.clientId"
                :items="clients?.map((c) => ({ label: c.name, value: c.id })) || []"
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
                <UInput
                  v-model="state.dropoff.street"
                  placeholder="Street Address"
                  class="w-full"
                />
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

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Appointment Time" name="scheduledTime">
                <UInput v-model="state.scheduledTime" type="datetime-local" class="w-full" />
              </UFormField>

              <UFormField label="Pick Up Time (Optional)" name="pickupTime">
                <UInput v-model="state.pickupTime" type="datetime-local" class="w-full" />
              </UFormField>
            </div>

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
