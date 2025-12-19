export default defineEventHandler(async (event) => {
  const email = getRouterParam(event, 'email')

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email is required',
    })
  }

  const user = await event.context.prisma.user.findUnique({
    where: {
      email,
    },
  })

  return user
})

