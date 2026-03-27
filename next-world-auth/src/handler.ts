import { WorldAuthOptions, WorldAuthOptions0, defaultWorldAuthOptions } from './options'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySiweMessage, getIsUserVerified, MiniAppWalletAuthSuccessPayload } from '@worldcoin/minikit-js'
import type { Session, User } from './types'

type IRequestPayload = {
  payload: MiniAppWalletAuthSuccessPayload
  nonce: string
}

type WorldIdTokenClaims = {
  email?: string
  'https://id.worldcoin.org/v1'?: {
    verification_level?: string
  }
}

type WorldIdTokenResponse = {
  id_token?: string
}

const decodeJwt = (token: string): WorldIdTokenClaims => {
  const payload = token.split('.')[1]
  if (!payload) {
    throw new Error('Invalid JWT payload')
  }
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
  return JSON.parse(decoded) as WorldIdTokenClaims
}

const getCallbackRedirectUrl = (req: NextRequest, error?: string) => {
  const redirectUrl = new URL('/', process.env.WLD_SERVER || req.nextUrl.origin)
  if (error) {
    redirectUrl.searchParams.set('error', error)
  }
  return redirectUrl
}

const redirectCallbackError = async (req: NextRequest, options: WorldAuthOptions0, error: string) => {
  await deleteSession(options)
  return NextResponse.redirect(getCallbackRedirectUrl(req, error))
}

const deleteSession = async (options: WorldAuthOptions0): Promise<Session | null> => {
  const cookieStore = await cookies()
  const body = cookieStore.get(options.cookieSessionName)
  const session = JSON.parse(body?.value || '{}')
  cookieStore.delete(options.cookieSessionName)
  return session
}

const setSession = (options: WorldAuthOptions0) => async (session: Session | null) => {
  const cookieStore = await cookies()
  if (session) {
    cookieStore.set(options.cookieSessionName, JSON.stringify(session), {
      secure: true,
      httpOnly: true,
    })
  } else {
    cookieStore.delete(options.cookieSessionName)
  }
}

const updateSession = (options: WorldAuthOptions0) => async (session: Session): Promise<Session> => {
  const session0 = await getSession(options)()
  let session1: Session
  if(!session0) {
    session1 = session
  } else {
    const user1 = { ...session0.user, ...session.user }
    session1 = {
      isAuthenticatedWallet: session0.isAuthenticatedWallet || session.isAuthenticatedWallet,
      isAuthenticatedWorldID: session0.isAuthenticatedWorldID || session.isAuthenticatedWorldID,
      isOrbVerified: session0.isOrbVerified || session.isOrbVerified,
      user: user1,
      extra: { ...session0.extra, ...session.extra }
    }
  }
  await setSession(options)(session1)
  return session1
}


const augmentSession = (options: WorldAuthOptions0) => async (key: string, data: object | null): Promise<Session | null> => {
  const cookieStore = await cookies()
  const body = cookieStore.get(options.cookieSessionName)
  const session = JSON.parse(body?.value || '{}')
  if (session && session.user) {
    const extra = session.extra || {}
    let session1: Session
    if(data) {
      session1 = { ...session, extra: { ...extra, [key]: data } }
    } else {
      delete extra[key]
      session1 = { ...session, extra }
    }
    await setSession(options)(session1)
    return session1
  }
  return null
}

export const getSession = (options: WorldAuthOptions) => async (): Promise<Session | null> => {
  const options0: WorldAuthOptions0 = { ...defaultWorldAuthOptions, ...options }
  const cookieStore = await cookies()
  const body = cookieStore.get(options0.cookieSessionName)
  const session = JSON.parse(body?.value || '{}')
  if (session && session.user) {
    return session
  }
  return null
}

const completeSiwe = (options: WorldAuthOptions) => async (req: NextRequest) => {
  const options0: WorldAuthOptions0 = { ...defaultWorldAuthOptions, ...options }
  const { payload, nonce, user } = (await req.json()) as (IRequestPayload & { user: User })

  if (nonce !== (await cookies()).get(options0.cookieNonceName)?.value) {
      await deleteSession(options0)
      return NextResponse.json({
      status: 'error',
      isValid: false,
      message: 'Invalid nonce',
    })
  }
  try {
    const [validMessage, isUserOrbVerified] = await Promise.all([
      verifySiweMessage(payload, nonce),
      getIsUserVerified(user.walletAddress!)
    ])

    if(!validMessage.isValid) {
      await deleteSession(options0)
      return NextResponse.json(null)
    }

    const session = {
      isAuthenticatedWallet: true,
      isAuthenticatedWorldID: false,
      isOrbVerified: isUserOrbVerified,
      user : {
        ...user,
      },
      extra: {}
    }
    const session1 = await updateSession(options0)(session)
    if(options.callbacks?.onSignIn) {
      await options.callbacks.onSignIn(session.user)
    }
    return NextResponse.json(session1)
  } catch {
    await deleteSession(options0)
    return NextResponse.json(null)
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const session = (options: WorldAuthOptions0) => async (req: NextRequest) => {
  const session = await getSession(options)()
  if (!session) {
    return NextResponse.json(null, { status: 401 })
  }
  return NextResponse.json(session)
}

export const handler = (options: WorldAuthOptions) => async (req: NextRequest): Promise<NextResponse> => {
  const options0: WorldAuthOptions0 = { ...defaultWorldAuthOptions, ...options }

  switch (req.nextUrl.pathname) {
    case '/api/auth/callback':
      // World ID callback
      if (req.method === 'GET') {
        const code = req.nextUrl.searchParams.get('code')
        if (!code) {
          return NextResponse.json({ status: 'error', message: 'No code provided' }, { status: 400 })
        }

        const data = new URLSearchParams()
        data.append('code', code)
        data.append('grant_type', 'authorization_code')
        const redirectUri = process.env.NEXT_PUBLIC_WLD_REDIRECT_URI
        if (!redirectUri) {
          return redirectCallbackError(req, options0, 'world-id-config')
        }
        data.append('redirect_uri', redirectUri)

        const clientId = process.env.WLD_CLIENT_ID
        const clientSecret = process.env.WLD_CLIENT_SECRET
        if (!clientId || !clientSecret) {
          return redirectCallbackError(req, options0, 'world-id-config')
        }
        let idToken: string | undefined
        try {
          const res = await fetch('https://id.worldcoin.org/token', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: data,
          })
          if (!res.ok) {
            return redirectCallbackError(req, options0, 'world-id-token')
          }
          const tokenResponse = (await res.json()) as WorldIdTokenResponse
          idToken = tokenResponse.id_token
        } catch {
          return redirectCallbackError(req, options0, 'world-id-token')
        }
        if (!idToken) {
          return redirectCallbackError(req, options0, 'world-id-token')
        }
        let decoded: WorldIdTokenClaims
        try {
          decoded = decodeJwt(idToken)
        } catch {
          return redirectCallbackError(req, options0, 'world-id-token')
        }
        const { email } = decoded
        if (!email) {
          return redirectCallbackError(req, options0, 'world-id-token')
        }
        const verificationLevel = decoded['https://id.worldcoin.org/v1']?.verification_level
        const session: Session = {
          isAuthenticatedWallet: false,
          isAuthenticatedWorldID: true,
          isOrbVerified: verificationLevel === 'orb',
          user: {
            appWorldID: email
          },
          extra: {}
        }
        await updateSession(options0)(session)
        if(options.callbacks?.onSignIn) {
          await options.callbacks.onSignIn(session.user)
        }
        return NextResponse.redirect(getCallbackRedirectUrl(req))
      }
      break
    case '/api/miniauth/nonce':
      if (req.method === 'GET') {
        const nonce = crypto.randomUUID().replace(/-/g, '')
        const cookieStore = await cookies()
        cookieStore.set(options0.cookieNonceName, nonce, { secure: true, httpOnly: true, maxAge: options0.sessionMaxAge })
        return NextResponse.json({ nonce })
      }
      break
    case '/api/miniauth/complete-siwe':
      if (req.method === 'POST') {
        return completeSiwe(options0)(req)
      }
      break
    case '/api/miniauth/session':
      if (req.method === 'GET') {
        const s = await session(options0)(req)
        return s
      }
      break
      case '/api/miniauth/logout':
        if (req.method === 'POST') {
          const session = await deleteSession(options0)
          if(options.callbacks?.onSignOut && session && session?.user) {
            await options.callbacks.onSignOut(session?.user)
          }
          return NextResponse.json({ success: true })
        }
        break
        case '/api/miniauth/augment':
          if (req.method === 'POST') {
            const { key, data } = await req.json()
            if (typeof key === 'string' && key.length > 0 && (data === null || typeof data === 'object')) {
              const session = await augmentSession(options0)(key, data)
              return NextResponse.json(session)
            }
            return NextResponse.json({ status: 'error' }, { status: 400 })
          }
          break
    default:
      break
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
