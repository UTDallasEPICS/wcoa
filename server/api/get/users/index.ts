export default defineEventHandler((event) => {
  return event.context.prisma.user.findMany()
})
