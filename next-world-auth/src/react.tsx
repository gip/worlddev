'use client'

import React, { ReactNode, createContext, useEffect, useState, useContext } from 'react'
import { MiniKit } from '@worldcoin/minikit-js'

type User = {
  walletAddress: string
  username?: string
  isHuman?: boolean
}

type WorldAuthContextType = {
  isInstalled: boolean
  isAuthenticated: boolean
  session: {
    user?: User
  } | null
  signIn: () => Promise<{ success: boolean }>
}

const initialContext: WorldAuthContextType = {
  isInstalled: false,
  isAuthenticated: false,
  session: null,
  signIn: async () => ({ success: false }),
}

const WorldAuthContext = createContext<WorldAuthContextType>(initialContext)

export const WorldAuthProvider = ({ children }: { children: ReactNode }) => {
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
              session: { user: s.user },
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
          session: { user: session.user },
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

  return (
    <WorldAuthContext.Provider value={{ ...authState, signIn }}>
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