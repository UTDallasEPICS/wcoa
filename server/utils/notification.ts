import type { H3Event } from 'h3'
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
  // Soft delete (issue #27): never notify an archived volunteer.
  const volunteer = await prisma.volunteer.findFirst({
    where: { id: volunteerId, deletedAt: null },
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
  context: NotificationContext,
  event?: H3Event
) {
  // Test-only seam (issue #45): throw here so e2e can pin the non-blocking fix
  // for #32. No-op in production (see maybeFault).
  maybeFault('ride-broadcast', event)

  // Fetch all available volunteers.
  // Soft delete (issue #27): skip archived volunteers in the broadcast.
  const volunteers = await prisma.volunteer.findMany({
    where: { status: 'AVAILABLE', deletedAt: null },
  })

  // Send to all in parallel (sendNotification handles individual preferences).
  // allSettled so one failed send doesn't abort the rest of the broadcast.
  await Promise.allSettled(
    volunteers.map((vol) => sendNotification(type, vol.id, context))
  )
}
