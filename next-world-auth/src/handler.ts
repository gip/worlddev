import { WorldAuthOptions0 } from './options'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySiweMessage, getIsUserVerified, MiniAppWalletAuthSuccessPayload } from '@worldcoin/minikit-js'

// Session
export type User = {
  walletAddress: string
  username: string
  isHuman: boolean
}

export type Session = {
  user: User
  location?: Location
}

type IRequestPayload = {
  payload: MiniAppWalletAuthSuccessPayload
  nonce: string
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

const augmentSession = (options: WorldAuthOptions0) => async (key: string, data: object): Promise<Session | null> => {
  const cookieStore = await cookies()
  const body = cookieStore.get(options.cookieSessionName)
  const session = JSON.parse(body?.value || '{}')
  if (session && session.status && session.user && session.user.walletAddress) {
    const session1 = { ...session, [key]: data }
    cookieStore.set(options.cookieSessionName, JSON.stringify(session1), {
      secure: true,
      httpOnly: true,
    })
    return session1
  }
  return null
}



const getSession = (options: WorldAuthOptions0) => async (): Promise<Session | null> => {
  const cookieStore = await cookies()
  const body = cookieStore.get(options.cookieSessionName)
  const session = JSON.parse(body?.value || '{}')
  if (session && session.status && session.user && session.user.walletAddress) {
    return session
  }
  return null
}

const completeSiwe = (options: WorldAuthOptions0) => async (req: NextRequest) => {

  const { payload, nonce, user } = (await req.json()) as (IRequestPayload & { user: User })

  if (nonce != (await cookies()).get(options.cookieNonceName)?.value) {
      await deleteSession(options)
      return NextResponse.json({
      status: 'error',
      isValid: false,
      message: 'Invalid nonce',
    })
  }
  try {
    const validMessage = await verifySiweMessage(payload, nonce)
    const isUserOrbVerified = await getIsUserVerified(user.walletAddress)

    if(!validMessage.isValid) {
      await deleteSession(options)
      return NextResponse.json({
        status: 'error',
        isValid: false,
        message: 'Invalid message',
      })
    }

    const session = {
      status: 'success',
      user : {
        ...user,
        isVerified: isUserOrbVerified,
        isHuman: isUserOrbVerified,
      },
    }
    setSession(options)(session)
    if(options.callbacks?.onSignIn) {
      await options.callbacks.onSignIn(session.user)
    }
    console.log('SES', session)
    return NextResponse.json(session)
  } catch (error: unknown) {
    await deleteSession(options)
    return NextResponse.json({
      status: 'error',
      isValid: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    })
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

export const handler = (options: WorldAuthOptions0) => async (req: NextRequest): Promise<NextResponse> => {
  switch (req.nextUrl.pathname) {
    case '/api/miniauth/nonce':
      if (req.method === 'GET') {
        const nonce = crypto.randomUUID().replace(/-/g, '')
        const cookieStore = await cookies()
        cookieStore.set(options.cookieNonceName, nonce, { secure: true, httpOnly: true, maxAge: options.sessionMaxAge })
        return NextResponse.json({ nonce })
      }
      break
    case '/api/miniauth/complete-siwe':
      if (req.method === 'POST') {
        return completeSiwe(options)(req)
      }
      break
    case '/api/miniauth/session':
      if (req.method === 'GET') {
        return session(options)(req)
      }
      break
      case '/api/miniauth/logout':
        if (req.method === 'POST') {
          const session = await deleteSession(options)
          if(options.callbacks?.onSignOut && session && session?.user) {
            await options.callbacks.onSignOut(session?.user)
          }
          return NextResponse.json({ success: true })
        }
        break
        case '/api/miniauth/augment':
          if (req.method === 'POST') {
            const { key, data } = await req.json()
            if (key && typeof data === 'object' && data !== null) {
              const session = await augmentSession(options)(key, data)
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