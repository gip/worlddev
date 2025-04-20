'use client'

import React, { ReactNode, createContext, useEffect, useState, useContext } from 'react'
import { MiniKit } from '@worldcoin/minikit-js'
import { WorldAuthOptions, WorldAuthOptions0, defaultWorldAuthOptions } from './options'
import type { Session, MyLocation } from './types'

type WorldAuthContextType = {
  isLoading: boolean
  isInitialized: boolean
  isInstalled: boolean // Are we running in the World App?
  isAuthenticated: boolean // Session should not be null if isAuthenticated is true
  session:  Session | null
  signInWorldID: (state: string | null) => Promise<{ success: false }>
  signInWallet: () => Promise<{ success: boolean }>
  signOut: () => Promise<{ success: boolean }>
  augmentSession: (key: string, data: object | null) => Promise<{ success: boolean }>
  getLocation: () => Promise<{ success: boolean; latitude?: number; longitude?: number; error?: string }>
}

const initialContext: WorldAuthContextType = {
  isLoading: true,
  isInitialized: false,
  isInstalled: false,
  isAuthenticated: false,
  session: null,
  signInWorldID: async (state: string | null) => ({ success: false }),
  signInWallet: async () => ({ success: false }),
  signOut: async () => ({ success: false }),
  augmentSession: async () => ({ success: false }),
  getLocation: async () => ({ success: false })
}

const WorldAuthContext = createContext<WorldAuthContextType>(initialContext)

export const WorldAuthProvider = ({ options, children }: { options?: WorldAuthOptions; children: ReactNode }) => {
  const options0: WorldAuthOptions0 = { ...defaultWorldAuthOptions, ...options || {} }
  const [authState, setAuthState] = useState<WorldAuthContextType>(initialContext)

  useEffect(() => {
    const init = async () => {
      try {
        await MiniKit.install(process.env.NEXT_PUBLIC_WLD_CLIENT_ID)
        const installed = MiniKit.isInstalled()
        console.log('MiniKit installed:', installed) // Debugging log
        setAuthState(prev => ({ ...prev, isInstalled: installed, isInitialized: true }))
      } catch (error) {
        console.error('MiniKit installation failed:', error)
        setAuthState(prev => ({ ...prev, isInitialized: true }))
      }
    }
    init()
  }, [])

  useEffect(() => {
    const checkSession = async () => {
      if (authState.isInitialized) {
        const res = await fetch(`/api/miniauth/session`)
        if(res.ok) {
          const s = await res.json()
          if(s) {
            setAuthState(prev => ({
              ...prev,
              isAuthenticated: true,
              session: s,
            }))
          } else {
            setAuthState(prev => ({
              ...prev,
              isAuthenticated: false,
              session: null,
            }))
          }
        }
      }
    }
    checkSession()
  }, [authState.isInstalled, authState.isInitialized])

  const augmentSession = async (key: string, data: object | null): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/miniauth/augment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data })
    })
    if(res.ok) {
      const s = await res.json()
      setAuthState(prev => ({ ...prev, session: s }))
    }
    return { success: res.ok }
  }

  const signOut = async () => {
    const res = await fetch(`/api/miniauth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    if(res.ok) {
      setAuthState(prev => ({ ...prev, isAuthenticated: false, session: null }))
    }
    return { success: res.ok }
  }

  const signInWorldID = async (state: string | null = null): Promise<{ success: false }> => {
    try {
      const params = new URLSearchParams({
        redirect_uri: process.env.NEXT_PUBLIC_WLD_REDIRECT_URI || '',
        response_type: 'code',
        response_mode: 'query',
        scope: 'openid profile email',
        client_id: process.env.NEXT_PUBLIC_WLD_CLIENT_ID || ''
      })
      if(state) {
        params.append('state', state)
      }
      const location = `https://id.worldcoin.org/authorize?${params.toString()}`
      window.location.href = location
      // Dead - client will redirect
    } catch (error) {
      // Noop
    }
    return { success: false }
  }

  const signInWallet = async () => {
    if (!authState.isInstalled) {
      return { success: false }
    }

    try {
      const res = await fetch(`/api/miniauth/nonce`)
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
      
      const session = await response.json()

      if (session) {
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          session,
        }))
        return { success: true }
      }

      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        session: null,
      }))
      return { success: false, error: 'sign-in failed' }
    } catch {
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        session: null,
      }))
      return { success: false, error: 'sign-in failed: exception' }
    }
  }

const getLocation = async (force = false): Promise<MyLocation> => {
  const validUntil = new Date(2099, 0, 1).toISOString() // TODO: should that expire?
  if (!authState.session) {
    return { success: false, error: 'not authenticated', validUntil }
  }
  try {
    const location = authState.session?.extra?.location as MyLocation | undefined
    const now = new Date();
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
      };
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'))
        return
      }
      navigator.geolocation.getCurrentPosition(resolve, reject)
    })
    
    const validUntil = new Date(now.getTime() + options0.locationMaxAge * 1000).toISOString()
    const locationData = {
      success: true,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      validUntil,
    }
    
    await augmentSession('location', locationData)
    
    return {
      success: true,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      validUntil,
    }
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error'
    const locationData = {
      success: false,
      error: errorMessage,
      validUntil
    }
    
    await augmentSession('location', locationData)
    
    return {
      success: false,
      error: errorMessage,
      validUntil,
    }
  }
}

  return (
    <WorldAuthContext.Provider value={{ ...authState, signInWorldID, signInWallet, signOut, augmentSession, getLocation }}>
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