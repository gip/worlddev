'use client'

import Image from "next/image"
import { useWorldAuth } from 'next-world-auth/react'

export default function Home() {
  const { isInstalled, isAuthenticated, session, signInWorldID, signInWallet, signOut, getLocation } = useWorldAuth()

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 sm:p-20 font-[family-name:var(--font-geist-sans)] text-center">
      <main className="flex flex-col gap-1 row-start-2 items-center">
        <div className="text-2xl font-bold">World Mini App Template</div>
        <div>Template available on <a href="https://github.com/gip/worlddev/tree/main/next-mini-app" target="_blank" rel="noopener noreferrer" style={{ color: '#0070f3', fontStyle: 'italic', textDecoration: 'underline' }}>GitHub</a></div>
        {!isInstalled && <>
          <div>This app is designed to be run on <a href="https://worldcoin.org/mini-app?app_id=app_a963cd2077f59caf1146198685eed59a&draft_id=meta_4d75d4955b27044f4ef562e60ad09d17" target="_blank" rel="noopener noreferrer">World App</a></div>
          <Image src="/miniappqr.png" alt="Mini App QR Code" width={400} height={400} />
        </>}
        {isInstalled && (isAuthenticated && session ? (
          <>
          <hr style={{ width: "100px", margin: 10 }} />
            <div>You are logged in!</div>
            <div className="flex gap-1 items-center flex-col sm:flex-row">
              <button
                className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                onClick={signOut}
              >
                Logout
              </button>
              <hr style={{ width: "100px", margin: 10 }} />
              {session.isAuthenticatedWallet && <>
                <div>You have authenticated with <span className="underline">World Wallet</span></div>
                <div>Welcome <b>{session?.user?.username}</b>!</div>
                <div>Your wallet address is: <span className="text-xs"><b>{session?.user?.walletAddress}</b></span></div>
              </>}
              {!session.isAuthenticatedWallet && <button
                className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                onClick={signInWallet}
              >
                Sign in with World Wallet
              </button>}
              <hr style={{ width: "100px", margin: 10 }} />
              {session.isAuthenticatedWorldID && <>
                <div>You have authenticated with <span className="underline">World ID</span></div>
                <div>Your unique app ID is available</div>
                <div>Orb Verification Status: <span className="font-bold">{session.isOrbVerified ? 'verified ✓' : 'not verified ✗'}</span></div>
              </>}
              {!session.isAuthenticatedWorldID && <button
                className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                onClick={() => signInWorldID()}
              >
                Sign in with World ID
              </button>}
              <hr style={{ width: "100px", margin: 10 }} />
              <div>
              Your location is: {
                session?.extra?.location
                  ? (<>
                      <div>latitude: {session.extra.location.latitude}</div>
                      <div>longitude: {session.extra.location.longitude}</div>
                    </>)
                  : 'unknown'
                }
              </div>
              <button
                className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                onClick={getLocation}
              >
                {session?.extra?.location ? 'Update Location' : 'Get Location'}
              </button>
            </div>
          </>
        ) : (
          <>
          <hr style={{ width: "100px", margin: 10 }} />
            <div>A starter mini app in a few lines of code!</div>
            <div>You are not authenticated - pick a method to sign in</div>
            <hr style={{ width: "100px", margin: 10 }} />
            <div className="flex gap-4 items-center flex-col sm:flex-row">
              <button
                className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                onClick={signInWallet}
              >
                Login with World Wallet
              </button>
              <hr style={{ width: "100px", margin: 10 }} />
              <button
                className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                onClick={() => signInWorldID()}
              >
                Login with World ID
              </button>
            </div>
          </>
        ))}
      </main>
    </div>
  )
}