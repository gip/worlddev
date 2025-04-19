
// Session
export type Session = {
  isAuthenticatedWallet: boolean
  isAuthenticatedWorldID: boolean 
  isOrbVerified: boolean
  user: User
  extra: Extra
}

export type User = {
  walletAddress?: string
  username?: string
  appWorldID?: string
}
  
export type MyLocation = {
  success: boolean,
  error?: string
  latitude?: number
  longitude?: number
  validUntil: string
}

export type Extra = {
  location?: MyLocation
} & {
  [K in Exclude<string, 'location'>]?: object & { validUntil: string }
}
