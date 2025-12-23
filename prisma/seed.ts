import { prisma } from '../server/utils/prisma'

async function main() {
  console.log('--- Cleaning Database ---')
  await prisma.ride.deleteMany()
  await prisma.volunteer.deleteMany()
  await prisma.client.deleteMany()
  await prisma.address.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()

  console.log('--- Seeding North Texas Addresses ---')

  // A Plano Residence
  const address1 = await prisma.address.create({
    data: {
      street: '1501 H Avenue',
      city: 'Plano',
      state: 'TX',
      zip: '75074',
    },
  })

  // A Richardson Medical Area
  const address2 = await prisma.address.create({
    data: {
      street: '2831 E President George Bush Hwy',
      city: 'Richardson',
      state: 'TX',
      zip: '75082',
    },
  })

  // A Frisco Landmark
  const address3 = await prisma.address.create({
    data: {
      street: '9 Cowboys Way',
      city: 'Frisco',
      state: 'TX',
      zip: '75034',
    },
  })

  console.log('--- Seeding Users & Profiles ---')

  // 1. Admin
  await prisma.user.create({
    data: {
      name: 'Tushar Wani',
      email: 'reachtusharwani@gmail.com',
      role: 'ADMIN',
      emailVerified: true,
    },
  })

  await prisma.user.create({
    data: {
      name: 'UTD_Tushar Wani',
      email: 'tmw220003@utdallas.edu',
      role: 'ADMIN',
      emailVerified: true,
    },
  })

  // 2. Client
  const clientUser = await prisma.user.create({
    data: {
      name: 'Martha Jenkins',
      email: 'martha@example.com',
      role: 'CLIENT',
      phone: '972-555-0101',
      client: {
        create: {
          homeAddressId: address1.id,
        },
      },
    },
    include: { client: true },
  })

  // 3. Volunteer
  const volunteerUser = await prisma.user.create({
    data: {
      name: 'Bob Tester',
      email: 'bob@example.com',
      role: 'VOLUNTEER',
      phone: '469-555-0202',
      volunteer: {
        create: {
          status: 'AVAILABLE',
          notificationSettings: { push: true, email: false },
        },
      },
    },
    include: { volunteer: true },
  })

  await prisma.user.create({
    data: {
      name: 'TW-NPTS',
      email: 'tushar.wani@npts.tech',
      role: 'VOLUNTEER',
      emailVerified: true,
      volunteer: {
        create: {
          status: 'AVAILABLE',
          notificationSettings: { push: true, email: false },
        },
      },
    },
    include: { volunteer: true },
  })

  console.log('--- Seeding Rides ---')

  // Ride 1: Upcoming Ride (Future)
  await prisma.ride.create({
    data: {
      status: 'CREATED',
      clientId: clientUser.client!.id,
      pickupDisplay: '1501 H Ave, Plano, TX 75074',
      dropoffDisplay: 'Methodist Richardson Medical Center, Richardson, TX',
      pickupAddressId: address1.id,
      dropoffAddressId: address2.id,
      scheduledTime: new Date(Date.now() + 86400000), // Tomorrow
      notes: 'Martha has a walker. Please pull into the circular drive.',
    },
  })

  // Ride 2: Completed Ride (Past)
  await prisma.ride.create({
    data: {
      status: 'COMPLETED',
      clientId: clientUser.client!.id,
      volunteerId: volunteerUser.volunteer!.id,
      pickupDisplay: '1501 H Ave, Plano, TX 75074',
      dropoffDisplay: '9 Cowboys Way, Frisco, TX 75034',
      pickupAddressId: address1.id,
      dropoffAddressId: address3.id,
      scheduledTime: new Date(Date.now() - 86400000), // Yesterday
      notes: 'Ride completed successfully. Client was on time.',
    },
  })

  console.log('Seeding finished successfully.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
