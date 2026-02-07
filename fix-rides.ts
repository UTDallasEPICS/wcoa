import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting ride time fix...')

  // Adjust the cutoff date as needed. This example targets rides created before the fix deployment.
  const cutoffDate = new Date('2026-02-07T00:00:00Z') 

  const rides = await prisma.ride.findMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
      // You might want to filter further if you know specific IDs or conditions
    },
  })

  console.log(`Found ${rides.length} rides to update.`)

  for (const ride of rides) {
    // Add 6 hours (6 * 60 * 60 * 1000 ms) to the scheduled time
    // This assumes the original time was stored as UTC but represented local time (e.g. 9am stored as 09:00 UTC)
    // We want 9am CST to be stored as 15:00 UTC (9 + 6)
    const originalTime = new Date(ride.scheduledTime)
    const newTime = new Date(originalTime.getTime() + 6 * 60 * 60 * 1000)

    console.log(`Updating ride ${ride.id}:`)
    console.log(`  Original: ${originalTime.toISOString()} (${originalTime.toLocaleString()})`)
    console.log(`  New:      ${newTime.toISOString()} (${newTime.toLocaleString()})`)

    await prisma.ride.update({
      where: { id: ride.id },
      data: {
        scheduledTime: newTime,
      },
    })
  }

  console.log('Finished updating rides.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
