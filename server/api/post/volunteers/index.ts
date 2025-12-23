import { prisma } from '../../../utils/prisma'
import { sendEmail } from '../../../utils/email'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.name || !body.email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Name and Email are required',
    })
  }

  // 1. Upsert User
  // We use upsert to create if not exists, or update name/phone if exists
  // Ideally, we might check if they are already a volunteer
  let user = await prisma.user.findUnique({
    where: { email: body.email }
  })

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        role: 'VOLUNTEER'
      }
    })
  } else {
    // Optionally update user info? Let's just ensure role is VOLUNTEER? 
    // Or maybe keep as is if they are ADMIN?
    // For simplicity, let's update name/phone and role if it was CLIENT
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name,
        phone: body.phone, // Update phone
        role: user.role === 'CLIENT' ? 'VOLUNTEER' : user.role // Upgrade CLIENT to VOLUNTEER
      }
    })
  }

  // 2. Create Volunteer profile if not exists
  const existingVolunteer = await prisma.volunteer.findUnique({
    where: { userId: user.id }
  })

  if (existingVolunteer) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User is already a volunteer',
    })
  }

  const volunteer = await prisma.volunteer.create({
    data: {
      userId: user.id,
      status: body.status || 'AVAILABLE'
    },
    include: {
      user: true
    }
  })

  // Send welcome email
  if (volunteer.user.email) {
    sendEmail(
      volunteer.user.email,
      'Welcome to WCOA Volunteer Program',
      `
        <h1>Welcome, ${volunteer.user.name}!</h1>
        <p>Thank you for signing up as a volunteer.</p>
        <p>You can now log in and browse available rides.</p>
      `
    ).catch(console.error)
  }

  return volunteer
})
