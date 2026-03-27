
export type WorldIdProtocolVersion = '4.0'

export type WorldIdSession = {
  sessionId: string
  identifiers: string[]
  action: string
  verifiedAt: string
  protocolVersion: WorldIdProtocolVersion
}

export type WorldIdStatus =
  | 'idle'
  | 'loading'
  | 'awaiting_connection'
  | 'awaiting_confirmation'
  | 'success'
  | 'error'

// Session
export type Session = {
  isAuthenticatedWallet: boolean
  isAuthenticatedWorldID: boolean 
  isOrbVerified: boolean
  user: User
  extra: Extra
  worldId?: WorldIdSession
}

export type User = {
  walletAddress?: string
  username?: string
  // Deprecated: World ID 4 uses `session.worldId.sessionId` for continuity.
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
