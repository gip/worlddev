'use client'

import React, { ReactNode, createContext, useContext, useEffect, useState } from 'react'
import { MiniKit, Tokens, tokenToDecimals } from '@worldcoin/minikit-js'
import type { IDKitRequest, IDKitResult } from '@worldcoin/idkit-core'
import { WorldAuthOptions, WorldAuthOptions0, defaultWorldAuthOptions } from './options'
import type { Session, MyLocation, WorldIdStatus } from './types'
import { createWorldIdSessionRequest, type WorldIdRpContextResponse } from './world-id'
import errors from './errors'

type ActionSuccess = { success: true }
type ActionFailure = { success: false; error: string }
type ActionResult = ActionSuccess | ActionFailure

type WorldAuthContextType = {
  // State
  isLoading: boolean
  isInitialized: boolean
  isInstalled: boolean
  isAuthenticated: boolean
  hasStoredWorldID: boolean
  session: Session | null
  worldIdStatus: WorldIdStatus
  worldIdConnectUri: string | null
  worldIdError: string | null
  // Actions
  signInWorldID: () => Promise<ActionResult>
  signInWallet: () => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<{ success: boolean }>
  forgetWorldID: () => Promise<{ success: boolean }>
  augmentSession: (key: string, data: object | null) => Promise<{ success: boolean }>
  getLocation: () => Promise<{ success: boolean; latitude?: number; longitude?: number; error?: string }>
  pay: ({ amount, token, recipient }: { amount: number, token: Tokens, recipient: string }) => Promise<{ success: boolean, finalPayload: object | null }>

  minikit: typeof MiniKit | null
}

const initialContext: WorldAuthContextType = {
  isLoading: true,
  isInitialized: false,
  isInstalled: false,
  isAuthenticated: false,
  hasStoredWorldID: false,
  session: null,
  worldIdStatus: 'idle',
  worldIdConnectUri: null,
  worldIdError: null,
  signInWorldID: async () => ({ success: false, error: errors.ERR_NOT_IMPLEMENTED }),
  signInWallet: async () => ({ success: false }),
  signOut: async () => ({ success: false }),
  forgetWorldID: async () => ({ success: false }),
  augmentSession: async () => ({ success: false }),
  getLocation: async () => ({ success: false }),
  pay: async () => ({ success: false, finalPayload: null }),
  minikit: null
}

const WORLD_ID_POLL_INTERVAL_MS = 1000
const WORLD_ID_POLL_TIMEOUT_MS = 2 * 60 * 1000

const WorldAuthContext = createContext<WorldAuthContextType>(initialContext)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const getPublicWorldIdAppId = () => {
  const appId = process.env.NEXT_PUBLIC_WLD_APP_ID || process.env.NEXT_PUBLIC_WLD_CLIENT_ID
  return appId || null
}

const getWorldIdStorageKey = (options: WorldAuthOptions0) => `${options.cookieSessionName}:worldid-session-id`

const readStoredWorldIdSessionId = (options: WorldAuthOptions0) => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage.getItem(getWorldIdStorageKey(options))
  } catch {
    return null
  }
}

const writeStoredWorldIdSessionId = (options: WorldAuthOptions0, sessionId: string) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(getWorldIdStorageKey(options), sessionId)
  } catch {
    // Ignore local storage errors.
  }
}

const clearStoredWorldIdSessionId = (options: WorldAuthOptions0) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.removeItem(getWorldIdStorageKey(options))
  } catch {
    // Ignore local storage errors.
  }
}

const getErrorMessageFromUnknown = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

const getErrorMessageFromResponse = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json() as { error?: string; message?: string }
    return payload.error || payload.message || fallback
  } catch {
    return fallback
  }
}

const isConfirmedWorldIdResult = (result: IDKitResult): result is IDKitResult & { session_id: string } => {
  return 'session_id' in result && typeof result.session_id === 'string' && result.session_id.length > 0
}

export const WorldAuthProvider = ({ options, children }: { options?: WorldAuthOptions; children: ReactNode }) => {
  const options0: WorldAuthOptions0 = { ...defaultWorldAuthOptions, ...options || {} }
  const [authState, setAuthState] = useState<WorldAuthContextType>(initialContext)

  const syncStoredWorldIdState = (session: Session | null) => {
    if (session?.worldId?.sessionId) {
      writeStoredWorldIdSessionId(options0, session.worldId.sessionId)
      return true
    }
    return Boolean(readStoredWorldIdSessionId(options0))
  }

  const waitForWorldIdCompletion = async (request: IDKitRequest): Promise<{ success: true; result: IDKitResult } | { success: false; error: string }> => {
    const startedAt = Date.now()

    while ((Date.now() - startedAt) < WORLD_ID_POLL_TIMEOUT_MS) {
      const status = await request.pollOnce()

      if (status.type === 'confirmed' && status.result) {
        return { success: true, result: status.result }
      }

      if (status.type === 'failed') {
        return { success: false, error: status.error || errors.ERR_WORLD_ID_FAILED }
      }

      setAuthState((prev) => ({
        ...prev,
        worldIdStatus: status.type === 'waiting_for_connection'
          ? 'awaiting_connection'
          : 'awaiting_confirmation',
        worldIdConnectUri: request.connectorURI || null,
      }))

      await sleep(WORLD_ID_POLL_INTERVAL_MS)
    }

    return { success: false, error: errors.ERR_WORLD_ID_TIMED_OUT }
  }

  useEffect(() => {
    const init = () => {
      try {
        MiniKit.install(getPublicWorldIdAppId() || undefined)
        const installed = MiniKit.isInstalled()
        setAuthState(prev => ({
          ...prev,
          isInstalled: installed,
          isInitialized: true,
          hasStoredWorldID: Boolean(readStoredWorldIdSessionId(options0)),
        }))
      } catch {
        setAuthState(prev => ({
          ...prev,
          isInitialized: true,
          hasStoredWorldID: Boolean(readStoredWorldIdSessionId(options0)),
        }))
      }
    }
    init()
  }, [])

  useEffect(() => {
    const checkSession = async () => {
      if (!authState.isInitialized) {
        return
      }

      const hasStoredWorldID = Boolean(readStoredWorldIdSessionId(options0))

      try {
        const res = await fetch('/api/miniauth/session')
        if (res.ok) {
          const session = await res.json() as Session | null
          const nextHasStoredWorldID = syncStoredWorldIdState(session) || hasStoredWorldID

          if (session) {
            setAuthState(prev => ({
              ...prev,
              isAuthenticated: true,
              isLoading: false,
              hasStoredWorldID: nextHasStoredWorldID,
              session,
            }))
            return
          }
        }
      } catch {
        // Fall through to the unauthenticated state.
      }

      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        hasStoredWorldID,
        session: null,
      }))
    }

    checkSession()
  }, [authState.isInitialized])

  const augmentSession = async (key: string, data: object | null): Promise<{ success: boolean }> => {
    const res = await fetch('/api/miniauth/augment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data })
    })
    if (res.ok) {
      const session = await res.json() as Session | null
      setAuthState(prev => ({
        ...prev,
        hasStoredWorldID: syncStoredWorldIdState(session),
        session,
      }))
    }
    return { success: res.ok }
  }

  const forgetWorldID = async () => {
    clearStoredWorldIdSessionId(options0)
    setAuthState(prev => ({
      ...prev,
      hasStoredWorldID: false,
      worldIdConnectUri: null,
      worldIdError: null,
      worldIdStatus: 'idle',
    }))
    return { success: true }
  }

  const signOut = async () => {
    setAuthState(prev => ({
      ...prev,
      isLoading: true,
      isAuthenticated: false,
      session: null,
      worldIdConnectUri: null,
      worldIdError: null,
      worldIdStatus: 'idle',
    }))

    document.cookie = `${options0.cookieSessionName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`

    let success = false
    try {
      const res = await fetch('/api/miniauth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      success = res.ok
    } catch {
      // Ignore logout fetch errors.
    }

    setAuthState(prev => ({
      ...prev,
      isLoading: false,
      hasStoredWorldID: Boolean(readStoredWorldIdSessionId(options0)),
    }))

    return { success }
  }

  const signInWorldID = async (): Promise<ActionResult> => {
    setAuthState(prev => ({
      ...prev,
      isLoading: true,
      worldIdStatus: 'loading',
      worldIdConnectUri: null,
      worldIdError: null,
    }))

    try {
      const rpContextResponse = await fetch('/api/miniauth/worldid/rp-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!rpContextResponse.ok) {
        const error = await getErrorMessageFromResponse(rpContextResponse, errors.ERR_WORLD_ID_CONFIG)
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          worldIdStatus: 'error',
          worldIdError: error,
        }))
        return { success: false, error }
      }

      const worldIdConfig = await rpContextResponse.json() as WorldIdRpContextResponse
      const appId = worldIdConfig.appId || getPublicWorldIdAppId()
      if (!appId) {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          worldIdStatus: 'error',
          worldIdError: errors.ERR_WORLD_ID_CONFIG,
        }))
        return { success: false, error: errors.ERR_WORLD_ID_CONFIG }
      }

      const storedSessionId = readStoredWorldIdSessionId(options0) || undefined
      const request = await createWorldIdSessionRequest({
        app_id: appId,
        rp_context: worldIdConfig.rpContext,
        environment: worldIdConfig.environment,
      }, worldIdConfig.action, storedSessionId)

      const connectorURI = request.connectorURI || null
      setAuthState(prev => ({
        ...prev,
        worldIdStatus: connectorURI ? 'awaiting_connection' : 'awaiting_confirmation',
        worldIdConnectUri: connectorURI,
      }))

      if (authState.isInstalled && connectorURI) {
        window.location.href = connectorURI
      }

      const completion = await waitForWorldIdCompletion(request)
      if (!completion.success) {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          worldIdStatus: 'error',
          worldIdConnectUri: null,
          worldIdError: completion.error,
        }))
        return { success: false, error: completion.error }
      }

      if (!isConfirmedWorldIdResult(completion.result)) {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          worldIdStatus: 'error',
          worldIdConnectUri: null,
          worldIdError: errors.ERR_WORLD_ID_INVALID_RESPONSE,
        }))
        return { success: false, error: errors.ERR_WORLD_ID_INVALID_RESPONSE }
      }

      const verifyResponse = await fetch('/api/miniauth/worldid/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completion.result),
      })

      if (!verifyResponse.ok) {
        const error = await getErrorMessageFromResponse(verifyResponse, errors.ERR_WORLD_ID_FAILED)
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          worldIdStatus: 'error',
          worldIdConnectUri: null,
          worldIdError: error,
        }))
        return { success: false, error }
      }

      const session = await verifyResponse.json() as Session | null
      if (!session?.worldId?.sessionId) {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          worldIdStatus: 'error',
          worldIdConnectUri: null,
          worldIdError: errors.ERR_WORLD_ID_INVALID_RESPONSE,
        }))
        return { success: false, error: errors.ERR_WORLD_ID_INVALID_RESPONSE }
      }

      writeStoredWorldIdSessionId(options0, session.worldId.sessionId)
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
        hasStoredWorldID: true,
        session,
        worldIdStatus: 'success',
        worldIdConnectUri: null,
        worldIdError: null,
      }))
      return { success: true }
    } catch (error) {
      const message = getErrorMessageFromUnknown(error, errors.ERR_FAILED_EXCEPTION)
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        worldIdStatus: 'error',
        worldIdConnectUri: null,
        worldIdError: message,
      }))
      return { success: false, error: message }
    }
  }

  const signInWallet = async () => {
    if (!authState.isInstalled) {
      return { success: false, error: errors.ERR_NOT_INSTALLED }
    }

    setAuthState(prev => ({
      ...prev,
      isLoading: true,
    }))
    try {
      const res = await fetch('/api/miniauth/nonce')
      const { nonce } = await res.json()

      const { finalPayload } = await MiniKit.commandsAsync.walletAuth({
        nonce,
        requestId: '0',
        expirationTime: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
        notBefore: new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
        statement: 'This is my statement and here is a link https://worldcoin.com/apps',
      })

      // @ts-expect-error - finalPayload is a MiniAppWalletAuthPayload
      const user = await MiniKit.getUserByAddress(finalPayload.address)

      if (finalPayload.status === 'error') {
        return { success: false }
      }

      const response = await fetch('/api/miniauth/complete-siwe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: finalPayload,
          nonce,
          user
        }),
      })
      
      const session = await response.json() as Session | null

      if (session) {
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          isLoading: false,
          hasStoredWorldID: syncStoredWorldIdState(session),
          session,
        }))
        return { success: true }
      }

      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        session: null,
      }))
      return { success: false, error: 'sign-in failed' }
    } catch {
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        session: null,
      }))
      return { success: false, error: errors.ERR_FAILED_EXCEPTION }
    }
  }

  const pay = async ({ amount, token, recipient }: { amount: number, token: Tokens, recipient: string }): Promise<{ success: boolean, finalPayload: object | null }> => {
    const payload = {
      to: recipient,
      reference: '0',
      tokens: [{ symbol: token, token_amount: tokenToDecimals(amount, token).toString() }],
      description: 'Sending WLD',
    }
    const { finalPayload } = await MiniKit.commandsAsync.pay(payload)
    return { success: true, finalPayload }
  }
  

  const getLocation = async (force = false): Promise<MyLocation> => {
    const validUntil = new Date(2099, 0, 1).toISOString()
    if (!authState.session) {
      return { success: false, error: 'not authenticated', validUntil }
    }
    try {
      const location = authState.session.extra?.location as MyLocation | undefined
      const now = new Date()
      if (
        location &&
        typeof location.latitude === 'number' &&
        typeof location.longitude === 'number' &&
        new Date(location.validUntil) > now &&
        !force
      ) {
        return {
          success: true,
          latitude: location.latitude,
          longitude: location.longitude,
          validUntil: location.validUntil,
        }
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported'))
          return
        }
        navigator.geolocation.getCurrentPosition(resolve, reject)
      })
      const validUntil0 = new Date(now.getTime() + options0.locationMaxAge * 1000).toISOString()
      const locationData = {
        success: true,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        validUntil: validUntil0,
      }
      await augmentSession('location', locationData)
      return locationData
    } catch {
      const locationData = {
        success: false,
        error: 'failed to get location',
        validUntil,
      }
      await augmentSession('location', locationData)
      return locationData
    }
  }

  return (
    <WorldAuthContext.Provider value={{
      ...authState,
      signInWorldID,
      signInWallet,
      signOut,
      forgetWorldID,
      augmentSession,
      getLocation,
      pay,
      minikit: MiniKit,
    }}>
      {children}
    </WorldAuthContext.Provider>
  )
}

export const useWorldAuth = () => {
  const context = useContext(WorldAuthContext)
  if (!context) {
    throw new Error('useWorldAuth must be used within a WorldAuthProvider')
  }
  return context
}
