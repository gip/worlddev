import { User } from "./types"

export type Callbacks = {
  onSignIn?: (user: User) => Promise<void>
  onSignOut?: (user: User) => Promise<void>
}

export type WorldAuthOptions = {
  cookieSessionName?: string
  cookieNonceName?: string
  sessionMaxAge?: number
  locationMaxAge?: number
  callbacks?: Callbacks
}
 
export type WorldAuthOptions0 = {
  cookieSessionName: string
  cookieNonceName: string
  sessionMaxAge: number
  locationMaxAge: number
  callbacks: Callbacks
}

export const defaultWorldAuthOptions: WorldAuthOptions0 = {
   cookieSessionName: 'worldAuthSession',
   cookieNonceName: 'nonce',
   sessionMaxAge: 60 * 60 * 24 * 7, // 7 days
   locationMaxAge: 60 * 60 * 24 * 1, // 1 day
   callbacks: {
   }
}