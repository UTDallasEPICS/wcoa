import { prisma } from './prisma'
import { sendEmail } from './email'

type NotificationType = 'RIDE_CREATED' | 'RIDE_ASSIGNED' | 'RIDE_REMINDER' | 'RIDE_CANCELLED' | 'RIDE_COMPLETED'

interface NotificationContext {
  name?: string
  date?: string
  time?: string
  pickup?: string
  dropoff?: string
  client?: string
  notes?: string
  link?: string
  [key: string]: string | undefined
}

export async function sendNotification(
  type: NotificationType,
  volunteerId: string,
  context: NotificationContext
) {
  // 1. Fetch Template & Global Setting
  const template = await prisma.notificationTemplate.findUnique({
    where: { name: type },
  })

  if (!template || !template.enabled) {
    console.log(`Notification ${type} is disabled or template missing.`)
    return
  }

  // 2. Fetch Volunteer Preferences
  const volunteer = await prisma.volunteer.findUnique({
    where: { id: volunteerId },
    include: { user: true },
  })

  if (!volunteer || !volunteer.user.email) {
    console.log(`Volunteer ${volunteerId} not found or no email.`)
    return
  }

  // Check user preference (Default to TRUE if not set)
  const settings = (volunteer.notificationSettings as any) || {}
  const userEnabled = settings[type] !== false // Strict check for false to allow undefined as true

  if (!userEnabled) {
    console.log(`Volunteer ${volunteerId} opted out of ${type}.`)
    return
  }

  // 3. Render Content
  let subject = template.subject
  let body = template.body

  for (const key in context) {
    const value = context[key] || ''
    const regex = new RegExp(`{{${key}}}`, 'g')
    subject = subject.replace(regex, value)
    body = body.replace(regex, value)
  }

  // 4. Send Email
  console.log(`Sending ${type} to ${volunteer.user.email}`)
  await sendEmail(volunteer.user.email, subject, body)
}

export async function broadcastNotification(
  type: NotificationType,
  context: NotificationContext
) {
  // Fetch all available volunteers
  const volunteers = await prisma.volunteer.findMany({
    where: { status: 'AVAILABLE' },
  })

  // Send to all (sendNotification handles individual preferences)
  for (const vol of volunteers) {
    await sendNotification(type, vol.id, context)
  }
}
