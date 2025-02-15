import { User } from "./handler"

export type WorldAuthOptions = {
  cookieSessionName?: string
  cookieNonceName?: string
  sessionMaxAge?: number
  signedIn?: (user: User) => Promise<void>
}
 
export type WorldAuthOptions0 = {
  cookieSessionName: string
  cookieNonceName: string
  sessionMaxAge: number
  signedIn: (user: User) => Promise<void>
}

export const defaultWorldAuthOptions: WorldAuthOptions0 = {
   cookieSessionName: 'worldAuthSession',
   cookieNonceName: 'nonce',
   sessionMaxAge: 60 * 60 * 24 * 7, // 7 days
   signedIn: async () => {}
}