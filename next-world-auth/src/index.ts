import { handler, getSession } from './handler'
import { WorldAuthOptions, defaultWorldAuthOptions } from './options'
export type { WorldAuthOptions }

export type { Session, User, MyLocation } from './types'

export { getSession }

export default function WorldAuth(options: WorldAuthOptions) {
  const options0 = { ...defaultWorldAuthOptions, ...options }

  return handler(options0)
}