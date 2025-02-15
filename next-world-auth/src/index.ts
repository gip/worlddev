import { handler } from './handler'
import { WorldAuthOptions, defaultWorldAuthOptions } from './options'
export type { WorldAuthOptions }

export default function WorldAuth(options: WorldAuthOptions) {
  const options0 = { ...defaultWorldAuthOptions, ...options }

  return handler(options0)
}