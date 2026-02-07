# Fixes Implemented

## 1. Timezone Discrepancy
- **Issue:** Rides created with a specific time (e.g., 9:00 AM) were displaying as 6 hours earlier (e.g., 3:00 AM) on the listing.
- **Cause:** The frontend was sending the local datetime string (e.g., "2026-02-12T09:00") directly to the backend. The backend (or database) treated this as UTC time (09:00 UTC), which corresponds to 3:00 AM CST (UTC-6).
- **Fix:** Updated the frontend to convert the selected local time to a proper ISO string (UTC) before sending it to the server.
    - Example: Selecting 9:00 AM CST now sends `2026-02-12T15:00:00.000Z` (15:00 UTC).
    - When displayed back in CST, 15:00 UTC correctly shows as 9:00 AM.

## 2. Volunteer Assignment
- **Issue:** Admins could not assign volunteers when creating a ride or re-assign/unassign volunteers on existing rides.
- **Fix:**
    - Added a "Volunteer" dropdown to the **Create Ride** modal (Admin only).
    - Added a "Volunteer" dropdown to the **Edit Ride** modal (Admin only).
    - Included an "Unassigned" option to allow removing a volunteer from a ride.
    - Updated the backend API to handle `volunteerId` during creation and updates.

## 3. Email Links
- **Issue:** Notification emails to volunteers did not include a link to the dashboard.
- **Fix:** Added a clickable link to the dashboard in the email body.
- **Improvement:** The email now also displays the ride time in the 'America/Chicago' timezone (CST/CDT) to ensure clarity for volunteers.

---

# How to Fix Existing Rides in Production

Since the previous rides were saved with the wrong UTC time (the local time was treated as UTC), we need to shift their `scheduledTime` forward by 6 hours.

**Recommended Approach:** Run a database migration or a direct SQL query.

### SQL Query (if using PostgreSQL/MySQL directly):

```sql
-- Shift all rides created before the fix date by +6 hours
UPDATE "ride"
SET "scheduledTime" = "scheduledTime" + INTERVAL '6 hours'
WHERE "createdAt" < '2026-02-07 00:00:00'; -- Replace with the deployment timestamp
```

### Script Approach (using Prisma):

You can run a temporary script in the production environment:

1. Create a file `fix-times.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find all rides that look wrong (e.g., created before today)
  // You might want to be more specific with the where clause
  const rides = await prisma.ride.findMany({
    where: {
      createdAt: {
        lt: new Date(), // Process rides created before now
      }
    }
  })

  for (const ride of rides) {
    // Add 6 hours to the scheduled time
    const newTime = new Date(ride.scheduledTime.getTime() + (6 * 60 * 60 * 1000))
    
    console.log(`Updating ride ${ride.id}: ${ride.scheduledTime.toISOString()} -> ${newTime.toISOString()}`)
    
    await prisma.ride.update({
      where: { id: ride.id },
      data: {
        scheduledTime: newTime
      }
    })
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
```

2. Run it with `npx tsx fix-times.ts`.
