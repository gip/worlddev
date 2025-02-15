import { User } from "./handler"

export type WorldAuthOptions = {
  cookieSessionName?: string
  cookieNonceName?: string
  signedIn?: (user: User) => Promise<void>
}
 
export type WorldAuthOptions0 = {
  cookieSessionName: string
  cookieNonceName: string
  signedIn: (user: User) => Promise<void>
}

export const defaultWorldAuthOptions: WorldAuthOptions0 = {
   cookieSessionName: 'worldAuthSession',
   cookieNonceName: 'nonce',
   signedIn: async () => {}
}