'use client'

import React, { ReactNode, createContext, useEffect, useState, useContext } from 'react'
import { MiniKit } from '@worldcoin/minikit-js'
import { WorldAuthOptions, WorldAuthOptions0, defaultWorldAuthOptions } from './options'
import type { User, MyLocation } from './types'

type WorldAuthContextType = {
  isInstalled: boolean
  isAuthenticated: boolean
  session: {
    user?: User
    extra?: { location?: { latitude?: number; longitude?: number; validUntil?: string } } & Record<string, unknown>
  } | null
  signIn: () => Promise<{ success: boolean }>
  signOut: () => Promise<{ success: boolean }>
  augmentSession: (key: string, data: object | null) => Promise<{ success: boolean }>
  getLocation: () => Promise<{ success: boolean; latitude?: number; longitude?: number; error?: string }>
}

const initialContext: WorldAuthContextType = {
  isInstalled: false,
  isAuthenticated: false,
  session: null,
  signIn: async () => ({ success: false }),
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
        setAuthState(prev => ({ ...prev, isInstalled: installed }))
      } catch (error) {
        console.error('MiniKit installation failed:', error)
      }
    }
    init()
  }, [])

  useEffect(() => {
    const checkSession = async () => {
      if (authState.isInstalled) {
        const res = await fetch(`/api/miniauth/session`)
        if(res.ok) {
          const s = await res.json()
          if(s.status === 'success') {
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
  }, [authState.isInstalled])

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

  const signIn = async () => {
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

      if (session && session.status === 'success') {
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

const getLocation = async (): Promise<MyLocation> => {
  try {
    // Check if session already has a valid location
    const location = authState.session?.extra?.location as {
      latitude?: number;
      longitude?: number;
      validUntil?: string;
    } | undefined;
    const now = new Date();
    if (
      location &&
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number' &&
      location.validUntil &&
      new Date(location.validUntil) > now
    ) {
      return {
        success: true,
        latitude: location.latitude,
        longitude: location.longitude,
      };
    }
    // Otherwise, get new location
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'))
        return
      }
      navigator.geolocation.getCurrentPosition(resolve, reject)
    })
    // Set validUntil to 10 minutes from now
    const validUntil = new Date(now.getTime() + options0.locationMaxAge * 1000).toISOString()
    await augmentSession('location', {
      success: true,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      validUntil,
    })
    return {
      success: true,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Unknown error',
    }
  }
}

  return (
    <WorldAuthContext.Provider value={{ ...authState, signIn, signOut, augmentSession, getLocation }}>
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