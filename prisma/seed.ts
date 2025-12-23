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

  const addresses = await Promise.all([
    prisma.address.create({ data: { street: '1501 H Avenue', city: 'Plano', state: 'TX', zip: '75074' } }),
    prisma.address.create({ data: { street: '2831 E President George Bush Hwy', city: 'Richardson', state: 'TX', zip: '75082' } }),
    prisma.address.create({ data: { street: '9 Cowboys Way', city: 'Frisco', state: 'TX', zip: '75034' } }),
    prisma.address.create({ data: { street: '2100 Ave K', city: 'Plano', state: 'TX', zip: '75074' } }),
    prisma.address.create({ data: { street: '800 W Campbell Rd', city: 'Richardson', state: 'TX', zip: '75080' } }),
    prisma.address.create({ data: { street: '1600 Amphitheatre Pkwy', city: 'Mountain View', state: 'CA', zip: '94043' } }),
    prisma.address.create({ data: { street: '6001 W Plano Pkwy', city: 'Plano', state: 'TX', zip: '75093' } }),
  ])

  console.log('--- Seeding Users & Profiles ---')

  // Admins
  await prisma.user.createMany({
    data: [
      { name: 'Tushar Wani', email: 'reachtusharwani@gmail.com', role: 'ADMIN', emailVerified: true },
      { name: 'UTD_Tushar Wani', email: 'tmw220003@utdallas.edu', role: 'ADMIN', emailVerified: true },
    ],
  })

  // Clients
  const clients = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Martha Jenkins', email: 'martha@example.com', role: 'CLIENT', phone: '9725550101',
        client: { create: { homeAddressId: addresses[0].id } },
      },
      include: { client: true },
    }),
    prisma.user.create({
      data: {
        name: 'George Miller', email: 'george@example.com', role: 'CLIENT', phone: '2145550202',
        client: { create: { homeAddressId: addresses[3].id } },
      },
      include: { client: true },
    }),
    prisma.user.create({
      data: {
        name: 'Sarah Connor', email: 'sarah@example.com', role: 'CLIENT', phone: '4695550303',
        client: { create: { homeAddressId: addresses[6].id } },
      },
      include: { client: true },
    }),
  ])

  // Volunteers
  const volunteers = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Bob Tester', email: 'bob@example.com', role: 'VOLUNTEER', phone: '4695550202',
        volunteer: { create: { status: 'AVAILABLE' } },
      },
      include: { volunteer: true },
    }),
    prisma.user.create({
      data: {
        name: 'Alice Springs', email: 'alice@example.com', role: 'VOLUNTEER', phone: '2145550404',
        volunteer: { create: { status: 'AVAILABLE' } },
      },
      include: { volunteer: true },
    }),
    prisma.user.create({
      data: {
        name: 'TW-NPTS', email: 'tushar.wani@npts.tech', role: 'VOLUNTEER', emailVerified: true,
        volunteer: { create: { status: 'AVAILABLE' } },
      },
      include: { volunteer: true },
    }),
  ])

  console.log('--- Seeding Rides ---')

  const now = new Date()
  const oneDay = 86400000

  const ridesData = [
    {
      status: 'COMPLETED',
      clientId: clients[0].client!.id,
      volunteerId: volunteers[0].volunteer!.id,
      pickupDisplay: '1501 H Ave, Plano, TX',
      dropoffDisplay: '9 Cowboys Way, Frisco, TX',
      scheduledTime: new Date(now.getTime() - oneDay * 2),
      notes: 'Routine checkup.',
    },
    {
      status: 'COMPLETED',
      clientId: clients[1].client!.id,
      volunteerId: volunteers[1].volunteer!.id,
      pickupDisplay: '2100 Ave K, Plano, TX',
      dropoffDisplay: 'UTD, Richardson, TX',
      scheduledTime: new Date(now.getTime() - oneDay * 3),
      notes: 'Patient was very talkative.',
    },
    {
      status: 'COMPLETED',
      clientId: clients[2].client!.id,
      volunteerId: volunteers[2].volunteer!.id,
      pickupDisplay: '6001 W Plano Pkwy, Plano, TX',
      dropoffDisplay: 'Presbyterian Hospital, Plano, TX',
      scheduledTime: new Date(now.getTime() - oneDay * 5),
    },
    {
      status: 'ASSIGNED',
      clientId: clients[0].client!.id,
      volunteerId: volunteers[2].volunteer!.id,
      pickupDisplay: '1501 H Ave, Plano, TX',
      dropoffDisplay: 'Methodist Richardson, TX',
      scheduledTime: new Date(now.getTime() + oneDay * 0.5),
      notes: 'Morning appointment.',
    },
    {
      status: 'ASSIGNED',
      clientId: clients[2].client!.id,
      volunteerId: volunteers[0].volunteer!.id,
      pickupDisplay: '6001 W Plano Pkwy, Plano, TX',
      dropoffDisplay: 'Medical City Plano, TX',
      scheduledTime: new Date(now.getTime() + oneDay * 1.5),
    },
    {
      status: 'CREATED',
      clientId: clients[1].client!.id,
      pickupDisplay: '2100 Ave K, Plano, TX',
      dropoffDisplay: 'Plano Medical Center, TX',
      scheduledTime: new Date(now.getTime() + oneDay * 3),
    },
    {
      status: 'CREATED',
      clientId: clients[0].client!.id,
      pickupDisplay: '1501 H Ave, Plano, TX',
      dropoffDisplay: 'Baylor Scott & White, Frisco, TX',
      scheduledTime: new Date(now.getTime() + oneDay * 4),
    },
    {
      status: 'CREATED',
      clientId: clients[2].client!.id,
      pickupDisplay: '6001 W Plano Pkwy, Plano, TX',
      dropoffDisplay: 'Cook Childrens, Plano, TX',
      scheduledTime: new Date(now.getTime() + oneDay * 1),
    },
    {
      status: 'CREATED',
      clientId: clients[1].client!.id,
      pickupDisplay: '2100 Ave K, Plano, TX',
      dropoffDisplay: 'Richardson Hospital, TX',
      scheduledTime: new Date(now.getTime() + oneDay * 0.2),
    },
  ]

  for (const ride of ridesData) {
    await prisma.ride.create({ data: ride as any })
  }

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
