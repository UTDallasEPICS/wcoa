<script setup lang="ts">
  import { h, resolveComponent } from 'vue'
  import type { TableColumn, TableRow } from '@nuxt/ui'
  import { authClient } from '../../utils/auth-client'
  import {
    RIDE_STATUS_OPTIONS,
    DEFAULT_RIDE_STATUSES,
    sanitizeStatuses,
    buildRidesInclude,
    legacyCookieToStatuses,
    type RideStatus,
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

  // --- Cross-device preferences (DB-backed filter preference) ---
  // The list filter/sort used to live in browser cookies. It now lives per-user
  // in the DB (GET/PUT /api/*/preferences) so the same view follows the user
  // across devices. Seed the controls from the saved preference, falling back to
  // sensible defaults when the user has never saved one.
  const { data: prefs } = await useFetch('/api/get/preferences')

  const selectedStatuses = ref<string[]>(
    prefs.value?.rideStatusFilter != null
      ? sanitizeStatuses(prefs.value.rideStatusFilter)
      : [...DEFAULT_RIDE_STATUSES]
  )
  const sort = ref<string>(prefs.value?.rideSort ?? 'desc')
  const assignedToMe = ref<boolean>(prefs.value?.rideAssignedToMeOnly ?? false)

  // --- Server-side pagination (issue #13) ---
  // Filtering, sorting and pagination all happen on the server so the table
  // binds directly to the returned page. Debounce search so typing doesn't fire
  // a request per keystroke.
  const PAGE_SIZE_OPTIONS = [5, 10, 20, 50]
  const pageSize = ref<number>(prefs.value?.ridesPerPage ?? 10)

  // Rides list view per breakpoint (table vs cards), seeded from the saved
  // preference. Because prefs is fetched server-side, the CSS-driven visibility
  // below is deterministic at SSR — no hydration flash. Defaults: desktop rows,
  // mobile cards.
  const desktopView = ref<string>(prefs.value?.ridesViewDesktop ?? 'table')
  const mobileView = ref<string>(prefs.value?.ridesViewMobile ?? 'cards')

  // Visibility is pure CSS (max-lg = below 1024px, lg = 1024px+), driven by the
  // per-breakpoint preference, so both the table and cards stay in the DOM and
  // the right one shows at each width without any JS viewport detection.
  const tableVisibility = computed(() => [
    mobileView.value === 'table' ? 'max-lg:block' : 'max-lg:hidden',
    desktopView.value === 'table' ? 'lg:block' : 'lg:hidden',
  ])
  const cardsVisibility = computed(() => [
    mobileView.value === 'cards' ? 'max-lg:block' : 'max-lg:hidden',
    desktopView.value === 'cards' ? 'lg:block' : 'lg:hidden',
  ])

  // Client-only breakpoint flag — used ONLY by the view toggle to know which
  // breakpoint's preference to read/write. Rendering never depends on it, so it
  // can't cause an SSR/hydration mismatch.
  const isDesktop = ref(true)
  const onViewportChange = (e: MediaQueryListEvent) => {
    isDesktop.value = e.matches
  }
  let viewportMql: MediaQueryList | undefined
  onMounted(() => {
    viewportMql = window.matchMedia('(min-width: 1024px)')
    isDesktop.value = viewportMql.matches
    viewportMql.addEventListener('change', onViewportChange)
  })
  onUnmounted(() => viewportMql?.removeEventListener('change', onViewportChange))

  const currentView = computed(() => (isDesktop.value ? desktopView.value : mobileView.value))
  function setView(view: 'table' | 'cards') {
    if (isDesktop.value) desktopView.value = view
    else mobileView.value = view
  }

  const page = ref(1)
  const debouncedSearch = ref('')
  const applyDebouncedSearch = debounce((value: string) => {
    debouncedSearch.value = value
  }, 300)
  watch(search, (value) => applyDebouncedSearch(value))
  const startDate = ref('')
  const endDate = ref('')

  // Selected statuses (+ the volunteer-only "assigned to me" toggle) become the
  // server `include` param so filtering composes with pagination (#13). There is
  // no exclude param now — an empty selection means "all statuses".
  const includeParam = computed(() =>
    buildRidesInclude(selectedStatuses.value as RideStatus[], !isAdmin.value && assignedToMe.value)
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
      pageSize,
      search: computed(() => debouncedSearch.value || undefined),
      startDate: computed(() => startDate.value || undefined),
      endDate: computed(() => endDate.value || undefined),
      include: includeParam,
    },
  })

  const rides = computed(() => ridesData.value?.items ?? [])
  const total = computed(() => ridesData.value?.total ?? 0)

  // Any filter/search/sort change should return to the first page so results
  // aren't hidden on a page that no longer exists.
  watch([debouncedSearch, startDate, endDate, includeParam, sort, pageSize], () => {
    page.value = 1
  })

  // Persist filter/sort changes to the DB, debounced so a burst of toggles
  // collapses into one write. The watch never fires on the initial seed — only
  // on a real user change.
  const savePreferences = debounce(() => {
    $fetch('/api/put/preferences', {
      method: 'PUT',
      body: {
        rideStatusFilter: sanitizeStatuses(selectedStatuses.value),
        rideSort: sort.value,
        rideAssignedToMeOnly: !isAdmin.value && assignedToMe.value,
        ridesPerPage: Number(pageSize.value),
        ridesViewDesktop: desktopView.value,
        ridesViewMobile: mobileView.value,
      },
    }).catch((err) => console.error('Failed to save preferences', err))
  }, 400)
  watch(
    [selectedStatuses, sort, assignedToMe, pageSize, desktopView, mobileView],
    () => savePreferences(),
    { deep: true }
  )

  // One-time migration off the old cookie model: if the user has no saved DB
  // preference yet but a legacy cookie exists, convert it, persist once, and
  // clear the cookies so the DB becomes the single source of truth.
  const legacyActive = useCookie<unknown>('ride-active-filters')
  const legacyExcluded = useCookie<unknown>('ride-excluded-filters')
  const legacySort = useCookie<string | null>('ride-sort')
  onMounted(() => {
    const prefUnset =
      !prefs.value ||
      (prefs.value.rideStatusFilter == null &&
        prefs.value.rideSort == null &&
        !prefs.value.rideAssignedToMeOnly)
    const hasLegacy = !!(legacyActive.value || legacyExcluded.value || legacySort.value)
    if (!prefUnset || !hasLegacy) return
    selectedStatuses.value = legacyCookieToStatuses(legacyActive.value, legacyExcluded.value)
    if (legacySort.value === 'asc' || legacySort.value === 'desc') sort.value = legacySort.value
    savePreferences()
    legacyActive.value = null
    legacyExcluded.value = null
    legacySort.value = null
  })

  const isCreateOpen = ref(false)

  function toggleStatus(value: string) {
    selectedStatuses.value = selectedStatuses.value.includes(value)
      ? selectedStatuses.value.filter((s) => s !== value)
      : [...selectedStatuses.value, value]
  }

  // Live "today" key (YYYY-MM-DD in the app timezone) used to mark a date-range
  // endpoint that falls on today. Kept reactive so the "(today)" marker appears
  // and — crucially — disappears when the day rolls over while the page is left
  // open. It's a client clock concern, so no server round-trip is needed; empty
  // on the server so nothing stale renders during SSR.
  const todayKey = ref('')
  function currentDayKey() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  }
  let dayTimer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    todayKey.value = currentDayKey()
    // Re-check each minute; that's imperceptibly close to the midnight edge and
    // far cheaper than any push mechanism for a once-a-day change.
    dayTimer = setInterval(() => {
      const key = currentDayKey()
      if (key !== todayKey.value) todayKey.value = key
    }, 60_000)
  })
  onUnmounted(() => {
    if (dayTimer) clearInterval(dayTimer)
  })

  // Human-readable summary of the (transient, unsaved) date-range filter, shown
  // on the popover trigger — "All dates" when unset. Formats the YYYY-MM-DD as a
  // local date so the app timezone can't shift it a day, and marks an endpoint
  // that is today with "(today)". Only renders after a client-side pick, so
  // there's no SSR/hydration concern.
  const dateRangeLabel = computed(() => {
    const fmt = (s: string) => {
      const [y, m, d] = s.split('-').map(Number)
      return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }
    const withToday = (s: string) => `${fmt(s)}${s === todayKey.value ? ' (today)' : ''}`
    if (startDate.value && endDate.value)
      return `${withToday(startDate.value)} – ${withToday(endDate.value)}`
    if (startDate.value) return `From ${withToday(startDate.value)}`
    if (endDate.value) return `Until ${withToday(endDate.value)}`
    return 'All dates'
  })

  function clearDateRange() {
    startDate.value = ''
    endDate.value = ''
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

  // The create wizard (RideCreatePanel) owns the form + POST; here we just close
  // the pane and refresh the list so the new ride shows up.
  async function onCreated() {
    isCreateOpen.value = false
    await refreshRides()
  }
</script>

<template>
  <UContainer class="flex h-[calc(100dvh-var(--ui-header-height))] flex-col overflow-hidden py-6">
    <!-- Page header: title + live result count, with Create Ride inline. -->
    <div class="mb-4 flex shrink-0 items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Rides</h1>
        <p class="mt-1 text-sm text-gray-500">{{ total }} {{ total === 1 ? 'ride' : 'rides' }}</p>
      </div>
      <UButton
        v-if="isAdmin"
        label="Create Ride"
        icon="i-lucide-plus"
        color="primary"
        @click="isCreateOpen = true"
      />
    </div>

    <!-- Rides list + create pane. Bounded to the viewport: the list region scrolls
         internally under a pinned pagination footer, so the page itself never
         scrolls. Pane is a side column on desktop / full-screen overlay on mobile. -->
    <div class="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <!-- Toolbar: search keeps the row width; filter controls group and wrap
             beside it on wide screens instead of stacking into a tall column. -->
        <div class="mb-3 flex shrink-0 flex-col gap-3">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search rides..."
            class="w-full"
          />
          <div class="flex flex-wrap items-center gap-2">
            <!-- Status filter: toggle which statuses to show. Selecting none shows
             all. The active chip takes its status' badge colour. -->
            <div
              class="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Filter by status"
            >
              <UButton
                v-for="opt in RIDE_STATUS_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                size="sm"
                :color="selectedStatuses.includes(opt.value) ? statusColor(opt.value) : 'neutral'"
                :variant="selectedStatuses.includes(opt.value) ? 'subtle' : 'ghost'"
                :aria-pressed="selectedStatuses.includes(opt.value)"
                @click="toggleStatus(opt.value)"
              />
              <UButton
                v-if="!isAdmin"
                label="Assigned to me"
                icon="i-lucide-user-check"
                size="sm"
                :color="assignedToMe ? 'primary' : 'neutral'"
                :variant="assignedToMe ? 'subtle' : 'ghost'"
                :aria-pressed="assignedToMe"
                @click="assignedToMe = !assignedToMe"
              />
            </div>

            <USelect
              v-model="sort"
              size="sm"
              :items="[
                { label: 'Oldest First', value: 'asc' },
                { label: 'Newest First', value: 'desc' },
              ]"
              class="w-full sm:w-40"
            />

            <!-- Date range: one control reading "All dates" when unset; opens the
             From/To pickers in a popover. This filter is transient (per-visit),
             not persisted like status/sort. -->
            <UPopover>
              <UButton
                icon="i-lucide-calendar"
                :label="dateRangeLabel"
                size="sm"
                color="neutral"
                variant="outline"
                :class="{ 'text-primary font-medium': startDate || endDate }"
              />
              <template #content>
                <div class="w-72 max-w-[calc(100vw-2rem)] space-y-3 p-3">
                  <UFormField label="From">
                    <UInput v-model="startDate" type="date" class="w-full" />
                  </UFormField>
                  <UFormField label="To">
                    <UInput v-model="endDate" type="date" class="w-full" />
                  </UFormField>
                  <div class="flex justify-end">
                    <UButton
                      label="Clear"
                      size="sm"
                      color="neutral"
                      variant="ghost"
                      :disabled="!startDate && !endDate"
                      @click="clearDateRange"
                    />
                  </div>
                </div>
              </template>
            </UPopover>

            <!-- View toggle: rows (table) vs cards. Flips the CURRENT breakpoint's
                 saved view. Client-only, so SSR/hydration stay clean — the actual
                 rendering is CSS-driven off the saved prefs. -->
            <ClientOnly>
              <div
                class="inline-flex items-center rounded-lg border border-gray-200 p-0.5 dark:border-gray-700"
              >
                <UButton
                  icon="i-lucide-table"
                  size="sm"
                  square
                  :color="currentView === 'table' ? 'primary' : 'neutral'"
                  :variant="currentView === 'table' ? 'subtle' : 'ghost'"
                  aria-label="Table view"
                  @click="setView('table')"
                />
                <UButton
                  icon="i-lucide-layout-grid"
                  size="sm"
                  square
                  :color="currentView === 'cards' ? 'primary' : 'neutral'"
                  :variant="currentView === 'cards' ? 'subtle' : 'ghost'"
                  aria-label="Card view"
                  @click="setView('cards')"
                />
              </div>
            </ClientOnly>
          </div>
        </div>

        <!-- Scroll region: the chosen view (table or cards) scrolls here beneath
             the pinned pagination footer. overflow-auto so a table can scroll
             sideways when shown on a narrow (mobile) width. -->
        <div class="min-h-0 flex-1 overflow-auto">
          <!-- Table view (sticky header). Shown per the saved per-breakpoint
               preference; on a narrow width it scrolls horizontally. -->
          <UTable
            :data="rides"
            :columns="columns"
            :loading="status === 'pending'"
            sticky
            :class="['w-full cursor-pointer', tableVisibility]"
            @select="onSelect"
          >
            <template #empty-state>
              <div
                class="flex flex-col items-center justify-center py-12 text-center text-gray-500"
              >
                <UIcon name="i-lucide-calendar-x" class="mb-2 size-8 text-gray-400" />
                <p class="font-medium">No rides found</p>
                <p class="text-sm">Try adjusting your search or filters</p>
              </div>
            </template>
          </UTable>

          <!-- Card view: each ride as a tap-friendly card. Same data + navigation
               as the table; shown per the saved per-breakpoint preference. -->
          <div :class="cardsVisibility">
            <div
              v-if="status === 'pending'"
              class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
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

            <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                    <span class="text-sm text-gray-600 dark:text-gray-300">{{
                      ride.pickupDisplay
                    }}</span>
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
                    class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
                  >
                    <span
                      class="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    >
                      {{ initials(ride.volunteer.user.name) }}
                    </span>
                    {{ ride.volunteer.user.name }}
                  </span>
                  <span v-else class="text-sm text-gray-400 italic">Unassigned</span>
                  <UIcon name="i-lucide-chevron-right" class="size-4 text-gray-400" />
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Pinned pagination footer: rows-per-page selector + page nav; stays put
             while the rows scroll under it. -->
        <div
          class="mt-3 flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 pt-3 dark:border-gray-800"
        >
          <USelect
            v-model="pageSize"
            :items="PAGE_SIZE_OPTIONS.map((n) => ({ label: `${n} / page`, value: n }))"
            size="sm"
            class="w-28"
          />
          <UPagination
            v-model:page="page"
            :total="total"
            :items-per-page="Number(pageSize)"
            size="sm"
          />
        </div>
      </div>

      <!-- Create pane: a side pane beside the list on desktop, a full-screen
           overlay below lg. The RideCreatePanel wizard is the same either way. -->
      <div
        v-if="isCreateOpen"
        class="max-lg:fixed max-lg:inset-0 max-lg:z-50 lg:h-full lg:w-[400px] lg:flex-none"
      >
        <RideCreatePanel
          :clients="clients"
          :volunteers="volunteers"
          @created="onCreated"
          @close="isCreateOpen = false"
        />
      </div>
    </div>
  </UContainer>
</template>
