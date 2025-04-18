// Session
export type User = {
  walletAddress: string
  username: string
  isHuman: boolean
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

export type Session = {
  user: User
  extra: Extra
}