import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

type Client = { id: string; user: { email: string } }
type Ride = { id: string; status: string; totalRideTime: number | null }
type HoursMetric = { totalHours: number }
type CompletionMetric = { total: number; completed: number; percentage: number }
type TopRider = { name: string; completedRides: number }

// A distinct address so we never collide with seeded rides.
const testAddress = {
  street: '742 Evergreen Terrace',
  city: 'Springfield',
  state: 'TX',
  zip: '75001',
}

// Create a COMPLETED ride for `clientId` scheduled at a known afternoon time on
// `day` (a plain YYYY-MM-DD string) with the given totalRideTime.
async function createCompletedRide(
  cookie: string,
  clientId: string,
  day: string,
  totalRideTime: number,
): Promise<Ride> {
  // Afternoon local time on the given day. The frontend sends endDate as a
  // plain day string; a 14:00 ride on that day must be inside the range.
  const scheduledTime = `${day}T14:00:00`
  const created = await $fetch<Ride>('/api/post/rides', {
    method: 'POST',
    headers: { cookie },
    body: {
      clientId,
      pickup: testAddress,
      dropoff: testAddress,
      scheduledTime,
    },
  })
  const completed = await $fetch<Ride>(`/api/put/rides/${created.id}`, {
    method: 'PUT',
    headers: { cookie },
    body: { status: 'COMPLETED', totalRideTime },
  })
  expect(completed.status).toBe('COMPLETED')
  return completed
}

describe('metrics date range — end day is inclusive (issue #18)', () => {
  it('counts an afternoon ride scheduled on the endDate day', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const clients = await $fetch<Client[]>('/api/get/clients', { headers: { cookie } })
    const clientId = clients[0]!.id

    // A fixed day well away from seeded times so nothing else lands here.
    const day = '2099-06-15'
    const start = '2099-06-01'
    const hoursValue = 3.25

    // Baseline before creating our ride.
    const hoursBefore = await $fetch<HoursMetric>(
      `/api/get/metrics/hours?startDate=${start}&endDate=${day}`,
      { headers: { cookie } },
    )
    const rateBefore = await $fetch<CompletionMetric>(
      `/api/get/metrics/completionRate?startDate=${start}&endDate=${day}`,
      { headers: { cookie } },
    )

    await createCompletedRide(cookie, clientId, day, hoursValue)

    const hoursAfter = await $fetch<HoursMetric>(
      `/api/get/metrics/hours?startDate=${start}&endDate=${day}`,
      { headers: { cookie } },
    )
    const rateAfter = await $fetch<CompletionMetric>(
      `/api/get/metrics/completionRate?startDate=${start}&endDate=${day}`,
      { headers: { cookie } },
    )

    // Pre-fix, a 14:00 ride on the endDate day is excluded (lte UTC-midnight),
    // so these deltas would be 0. Post-fix the ride is included.
    expect(hoursAfter.totalHours - hoursBefore.totalHours).toBeCloseTo(hoursValue, 5)
    expect(rateAfter.completed - rateBefore.completed).toBe(1)
    expect(rateAfter.total - rateBefore.total).toBe(1)
  })

  it('includes the endDate day for topRiders (explicit-endDate path, lt bug)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const clients = await $fetch<Client[]>('/api/get/clients', { headers: { cookie } })
    // Use a distinct client so its completed-ride count is unambiguous.
    const client = clients[1] ?? clients[0]!

    const day = '2099-07-20'
    const start = '2099-07-01'

    const before = await $fetch<TopRider[]>(
      `/api/get/metrics/topRiders?startDate=${start}&endDate=${day}`,
      { headers: { cookie } },
    )
    const beforeCount = before.length

    await createCompletedRide(cookie, client.id, day, 1)

    const after = await $fetch<TopRider[]>(
      `/api/get/metrics/topRiders?startDate=${start}&endDate=${day}`,
      { headers: { cookie } },
    )

    // Pre-fix, lt: endFilter (UTC-midnight of the endDate day) drops the whole
    // end day, so the new completed ride would not appear at all in this narrow
    // window -> the list stays empty. Post-fix at least one rider is returned.
    expect(after.length).toBeGreaterThanOrEqual(1)
    expect(after.length).toBeGreaterThanOrEqual(beforeCount)
  })
})
