import { WorldAuthOptions, WorldAuthOptions0, defaultWorldAuthOptions } from './options'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySiweMessage, getIsUserVerified, MiniAppWalletAuthSuccessPayload } from '@worldcoin/minikit-js'
import { signRequest, type IDKitResult } from '@worldcoin/idkit-core'
import type { Session, User } from './types'
import type { WorldIdEnvironment, WorldIdRpContextResponse } from './world-id'
import { getWorldIdIdentifiers, isOrbVerifiedIdentifier, isWorldIdSessionResult } from './world-id'

type IRequestPayload = {
  payload: MiniAppWalletAuthSuccessPayload
  nonce: string
}

type WorldIdVerifyResultItem = {
  identifier: string
  success: boolean
  nullifier?: string
  code?: string
  detail?: string
}

type WorldIdVerifyResponse = {
  success?: boolean
  results?: WorldIdVerifyResultItem[]
  action?: string
  nullifier?: string
  created_at?: string
  environment?: WorldIdEnvironment
  session_id?: string
  message?: string
}

type WorldIdServerConfig = {
  appId: `app_${string}`
  action: string
  rpId: string
  signingKey: string
  environment: WorldIdEnvironment
  verifyBaseUrl: string
}

const getWorldIdEnvironment = (): WorldIdEnvironment => {
  return process.env.WLD_WORLD_ID_ENVIRONMENT === 'staging' ? 'staging' : 'production'
}

const getWorldIdServerConfig = (): { config: WorldIdServerConfig | null; error?: string } => {
  const appId = process.env.NEXT_PUBLIC_WLD_APP_ID || process.env.NEXT_PUBLIC_WLD_CLIENT_ID
  const rpId = process.env.WLD_RP_ID
  const action = process.env.WLD_WORLD_ID_ACTION
  const signingKey = process.env.WLD_RP_SIGNING_KEY
  const missing: string[] = []

  if (!appId) missing.push('NEXT_PUBLIC_WLD_APP_ID')
  if (!rpId) missing.push('WLD_RP_ID')
  if (!action) missing.push('WLD_WORLD_ID_ACTION')
  if (!signingKey) missing.push('WLD_RP_SIGNING_KEY')

  if (missing.length > 0) {
    return { config: null, error: `Missing World ID 4 env vars: ${missing.join(', ')}` }
  }

  const environment = getWorldIdEnvironment()

  return {
    config: {
      appId: appId as `app_${string}`,
      action: action!,
      rpId: rpId!,
      signingKey: signingKey!,
      environment,
      verifyBaseUrl: environment === 'staging'
        ? 'https://staging-developer.worldcoin.org'
        : 'https://developer.world.org',
    },
  }
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
      maxAge: options.sessionMaxAge,
    })
  } else {
    cookieStore.delete(options.cookieSessionName)
  }
}

const updateSession = (options: WorldAuthOptions0) => async (session: Session): Promise<Session> => {
  const session0 = await getSession(options)()
  let session1: Session
  if (!session0) {
    session1 = session
  } else {
    const user1 = { ...session0.user, ...session.user }
    session1 = {
      isAuthenticatedWallet: session0.isAuthenticatedWallet || session.isAuthenticatedWallet,
      isAuthenticatedWorldID: session0.isAuthenticatedWorldID || session.isAuthenticatedWorldID,
      isOrbVerified: session0.isOrbVerified || session.isOrbVerified,
      user: user1,
      extra: { ...session0.extra, ...session.extra },
      worldId: session.worldId || session0.worldId,
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
    if (data) {
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

    if (!validMessage.isValid) {
      await deleteSession(options0)
      return NextResponse.json(null)
    }

    const session = {
      isAuthenticatedWallet: true,
      isAuthenticatedWorldID: false,
      isOrbVerified: isUserOrbVerified,
      user: {
        ...user,
      },
      extra: {}
    }
    const session1 = await updateSession(options0)(session)
    if (options.callbacks?.onSignIn) {
      await options.callbacks.onSignIn(session1.user)
    }
    return NextResponse.json(session1)
  } catch {
    await deleteSession(options0)
    return NextResponse.json(null)
  }
}

const getWorldIdRpContext = async () => {
  const { config, error } = getWorldIdServerConfig()
  if (!config) {
    return NextResponse.json({ success: false, error }, { status: 500 })
  }

  const rpSignature = signRequest(config.action, config.signingKey)

  const response: WorldIdRpContextResponse = {
    appId: config.appId,
    action: config.action,
    environment: config.environment,
    rpContext: {
      rp_id: config.rpId,
      nonce: rpSignature.nonce,
      created_at: rpSignature.createdAt,
      expires_at: rpSignature.expiresAt,
      signature: rpSignature.sig,
    },
  }

  return NextResponse.json(response)
}

const verifyWorldId = (options: WorldAuthOptions0) => async (req: NextRequest) => {
  const { config, error } = getWorldIdServerConfig()
  if (!config) {
    return NextResponse.json({ success: false, error }, { status: 500 })
  }

  const idkitResponse = (await req.json()) as IDKitResult
  const verifyResponse = await fetch(`${config.verifyBaseUrl}/api/v4/verify/${config.rpId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(idkitResponse),
  })

  let payload: WorldIdVerifyResponse | null = null
  try {
    payload = await verifyResponse.json() as WorldIdVerifyResponse
  } catch {
    payload = null
  }

  if (!verifyResponse.ok || !payload?.success) {
    return NextResponse.json(payload || { success: false, error: 'World ID verification failed' }, {
      status: verifyResponse.ok ? 400 : verifyResponse.status,
    })
  }

  const resultIdentifiers = payload.results
    ?.filter((result) => result.success)
    .map((result) => result.identifier) || []
  const responseIdentifiers = idkitResponse.responses.map((response) => response.identifier)
  const identifiers = getWorldIdIdentifiers([...resultIdentifiers, ...responseIdentifiers])
  const sessionId = payload.session_id || (isWorldIdSessionResult(idkitResponse) ? idkitResponse.session_id : undefined)

  if (!sessionId) {
    return NextResponse.json({
      success: false,
      error: 'World ID verification succeeded but no session_id was returned',
      verify: payload,
    }, { status: 502 })
  }

  const session: Session = {
    isAuthenticatedWallet: false,
    isAuthenticatedWorldID: true,
    isOrbVerified: identifiers.some(isOrbVerifiedIdentifier),
    user: {},
    extra: {},
    worldId: {
      sessionId,
      identifiers,
      action: config.action,
      verifiedAt: payload.created_at || new Date().toISOString(),
      protocolVersion: '4.0',
    },
  }

  const session1 = await updateSession(options)(session)
  if (options.callbacks?.onSignIn) {
    await options.callbacks.onSignIn(session1.user)
  }

  return NextResponse.json(session1)
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
    case '/api/miniauth/worldid/rp-context':
      if (req.method === 'POST') {
        return getWorldIdRpContext()
      }
      break
    case '/api/miniauth/worldid/verify':
      if (req.method === 'POST') {
        return verifyWorldId(options0)(req)
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
        return session(options0)(req)
      }
      break
    case '/api/miniauth/logout':
      if (req.method === 'POST') {
        const session = await deleteSession(options0)
        if (options.callbacks?.onSignOut && session && session.user) {
          await options.callbacks.onSignOut(session.user)
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
