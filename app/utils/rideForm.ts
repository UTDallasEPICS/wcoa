// Shape of the Create Ride modal's form state, with nested pickup/dropoff
// address objects. Kept as a pure factory so the modal can initialise its
// reactive state and reset it back to blank from a single source of truth —
// resetting the actual nested keys instead of the non-existent `*Display` keys
// that previously left stale address data behind (issue #11).
export interface RideAddressForm {
  street: string
  city: string
  state: string
  zip: string
}

export interface RideForm {
  clientId: string
  pickup: RideAddressForm
  dropoff: RideAddressForm
  scheduledTime: string
  pickupTime: string
  notes: string
  volunteerId: any
}

export function blankRideForm(): RideForm {
  return {
    clientId: '',
    pickup: { street: '', city: '', state: '', zip: '' },
    dropoff: { street: '', city: '', state: '', zip: '' },
    scheduledTime: '',
    pickupTime: '',
    notes: '',
    volunteerId: undefined,
  }
}
