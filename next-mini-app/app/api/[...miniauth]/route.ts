import WorldAuth from 'next-world-auth'

const handler = WorldAuth({})
export { handler as GET, handler as POST }