import { defineEventHandler, readBody } from 'h3'
import { auth } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers
  })
  if (!session || !session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const { notifications } = await readBody(event)

  if (!notifications || typeof notifications !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid notifications data' })
  }

  // Get volunteer ID from session user
  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: session.user.id },
  })

  if (!volunteer) {
    throw createError({ statusCode: 404, statusMessage: 'Volunteer profile not found' })
  }

  // Merge new settings with existing
  const currentSettings = (volunteer.notificationSettings as any) || {}
  const newSettings = { ...currentSettings, ...notifications }

  await prisma.volunteer.update({
    where: { id: volunteer.id },
    data: { notificationSettings: newSettings },
  })

  return { success: true }
})
