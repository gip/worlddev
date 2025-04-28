import { handler, getSession } from './handler'
import { WorldAuthOptions, defaultWorldAuthOptions } from './options'
export type { WorldAuthOptions }

export type { Session, User, MyLocation } from './types'

export { getSession as getServerSession }

export default function WorldAuth(options: WorldAuthOptions) {
  const options0 = { ...defaultWorldAuthOptions, ...options }

  return handler(options0)
}

export { Tokens } from '@worldcoin/minikit-js'