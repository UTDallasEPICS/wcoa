import { describe, expect, it } from 'vitest'
import { bootShared } from '../utils/harness'
import { blankRideForm } from '../../app/utils/rideForm'

// Frontend-only regression test for issue #11.
//
// The Create Ride modal (app/pages/rides/index.vue) used to reset its form
// after a successful submit with non-existent `pickupDisplay`/`dropoffDisplay`
// keys, so the nested `pickup`/`dropoff` address objects were never cleared and
// the next ride could silently inherit the previous ride's addresses.
//
// The reset now derives from a single pure factory, `blankRideForm()`, and
// re-uses it (assigning into the nested reactive objects). This test pins the
// factory's contract: a blank form has fully-empty nested address objects and
// none of the bogus `*Display` keys. If someone reintroduces the old shape
// (top-level `pickupDisplay`/`dropoffDisplay` and no nested reset), the
// nested-object assertions below fail.
//
// bootShared() is called to satisfy the e2e harness (the vitest config builds
// and boots one shared Nuxt server for the whole suite); this test itself only
// exercises the pure form-state factory.
await bootShared()

describe('Create Ride form reset (issue #11)', () => {
  it('blankRideForm() produces fully-cleared nested pickup/dropoff objects', () => {
    const form = blankRideForm()

    // The real defect: nested address objects must exist and be empty.
    expect(form.pickup).toEqual({ street: '', city: '', state: '', zip: '' })
    expect(form.dropoff).toEqual({ street: '', city: '', state: '', zip: '' })

    // The bogus keys the old reset used must not exist on the form shape.
    expect(form).not.toHaveProperty('pickupDisplay')
    expect(form).not.toHaveProperty('dropoffDisplay')

    // Other real fields are blank too.
    expect(form.clientId).toBe('')
    expect(form.scheduledTime).toBe('')
    expect(form.pickupTime).toBe('')
    expect(form.notes).toBe('')
    expect(form.volunteerId).toBeUndefined()
  })

  it('simulates the post-submit reset clearing stale addresses on nested state', () => {
    // Mirror how the modal resets: an existing reactive-like state object whose
    // nested pickup/dropoff carry the previous ride's addresses.
    const state: Record<string, any> = {
      clientId: 'client-123',
      pickup: { street: '123 Old St', city: 'Dallas', state: 'TX', zip: '75001' },
      dropoff: { street: '999 Prev Ave', city: 'Plano', state: 'TX', zip: '75023' },
      scheduledTime: '2026-07-09T10:00',
      pickupTime: '2026-07-09T09:30',
      notes: 'stale note',
      volunteerId: 'vol-1',
    }

    // The exact reset the component performs.
    const blank = blankRideForm()
    Object.assign(state.pickup, blank.pickup)
    Object.assign(state.dropoff, blank.dropoff)
    state.clientId = blank.clientId
    state.scheduledTime = blank.scheduledTime
    state.pickupTime = blank.pickupTime
    state.notes = blank.notes
    state.volunteerId = blank.volunteerId

    expect(state.pickup).toEqual({ street: '', city: '', state: '', zip: '' })
    expect(state.dropoff).toEqual({ street: '', city: '', state: '', zip: '' })
    expect(state.clientId).toBe('')
    expect(state.notes).toBe('')
  })
})
