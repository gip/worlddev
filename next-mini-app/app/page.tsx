'use client'

import { useEffect, useState } from "react"
import Image from "next/image"
import QRCode from "qrcode"
import { Tokens } from "next-world-auth"
import { useWorldAuth } from "next-world-auth/react"

const worldIdStatusLabel: Record<string, string> = {
  idle: "Idle",
  loading: "Preparing request",
  awaiting_connection: "Waiting for connection",
  awaiting_confirmation: "Waiting for confirmation",
  success: "Verified",
  error: "Failed",
}

export default function Home() {
  const {
    isLoading,
    isInstalled,
    isAuthenticated,
    hasStoredWorldID,
    session,
    worldIdStatus,
    worldIdConnectUri,
    worldIdError,
    signInWorldID,
    signInWallet,
    signOut,
    forgetWorldID,
    getLocation,
    pay,
  } = useWorldAuth()
  const [tipAmount, setTipAmount] = useState<number | null>(null)
  const [worldIdQrCode, setWorldIdQrCode] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    if (!worldIdConnectUri) {
      setWorldIdQrCode(null)
      return
    }

    QRCode.toDataURL(worldIdConnectUri, {
      width: 320,
      margin: 1,
    }).then((value) => {
      if (!isCancelled) {
        setWorldIdQrCode(value)
      }
    }).catch(() => {
      if (!isCancelled) {
        setWorldIdQrCode(null)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [worldIdConnectUri])

  const tip = async (amount: number) => {
    const result = await pay({ amount, token: Tokens.WLD, recipient: "0x2Eb67DdFf6761bC0938e670bf1e1ed46110DDABb" })
    if (result.success) {
      setTipAmount(amount)
    }
  }

  const worldIdSession = session?.worldId
  const showWorldIdFlow = Boolean(
    worldIdConnectUri ||
    worldIdError ||
    worldIdStatus !== "idle" ||
    hasStoredWorldID
  )

  const worldIdFlow = showWorldIdFlow ? (
    <div className="flex flex-col items-center gap-2 mt-3">
      {hasStoredWorldID && !worldIdSession && (
        <div className="text-sm italic">
          A saved World ID 4 session is available for returning-user verification.
        </div>
      )}
      {worldIdStatus !== "idle" && !(worldIdStatus === "success" && worldIdSession) && (
        <div>World ID status: <span className="font-bold">{worldIdStatusLabel[worldIdStatus] || worldIdStatus}</span></div>
      )}
      {worldIdError && <div className="text-sm text-red-500">{worldIdError}</div>}
      {worldIdQrCode && (
        <Image
          src={worldIdQrCode}
          alt="World ID connect QR code"
          width={220}
          height={220}
          unoptimized
          className="rounded-xl border border-black/10 bg-white p-3"
        />
      )}
      {worldIdConnectUri && (
        <a
          href={worldIdConnectUri}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline break-all"
        >
          Open World ID connect link
        </a>
      )}
      {hasStoredWorldID && (
        <button
          className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
          onClick={forgetWorldID}
        >
          Forget saved World ID
        </button>
      )}
    </div>
  ) : null

  const worldIdDetails = worldIdSession ? (
    <>
      <div>You have authenticated with <span className="underline">World ID 4</span></div>
      <div>Verification source: <span className="font-bold">{worldIdSession.identifiers.join(", ") || "unknown"}</span></div>
      <div>Orb Verification Status: <span className="font-bold">{session?.isOrbVerified ? "verified ✓" : "not verified ✗"}</span></div>
      <div className="text-xs break-all max-w-xl">
        Session ID: <b>{worldIdSession.sessionId}</b>
      </div>
      <div className="text-xs">
        Verified at: <b>{new Date(worldIdSession.verifiedAt).toLocaleString()}</b>
      </div>
      <div className="text-xs">
        Configured action: <b>{worldIdSession.action}</b>
      </div>
    </>
  ) : null

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 sm:p-20 font-sans text-center">
      <main className="flex flex-col gap-1 row-start-2 items-center">
        <div className="text-2xl font-bold">World Mini App Template</div>
        <div>Template available on <a href="https://github.com/gip/worlddev/tree/main/next-mini-app" target="_blank" rel="noopener noreferrer" style={{ color: "#0070f3", fontStyle: "italic", textDecoration: "underline" }}>GitHub</a></div>
        {isLoading ? (
          <div className="flex items-center justify-center mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        ) : (
          <>
            {!isInstalled && <>
              <div>This app is designed to be run on <a href="https://worldcoin.org/mini-app?app_id=app_a963cd2077f59caf1146198685eed59a&draft_id=meta_4d75d4955b27044f4ef562e60ad09d17" target="_blank" rel="noopener noreferrer">World App</a></div>
              <Image src="/miniappqr.png" alt="Mini App QR Code" width={400} height={400} />
              <hr style={{ width: "100px", margin: 10 }} />
              {worldIdSession ? (
                <>
                  {worldIdDetails}
                  <button
                    className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                    onClick={signOut}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <div>World ID 4 now uses a connect flow instead of the old redirect sign-in.</div>
                  <div>Use the button below to start the World ID 4 session flow and scan the QR code with World App.</div>
                  <button
                    className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                    onClick={signInWorldID}
                  >
                    Sign in with World ID 4
                  </button>
                </>
              )}
              {worldIdFlow}
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
                    <div>Welcome <b>{session.user.username}</b>!</div>
                    <div>Your wallet address is: <span className="text-xs"><b>{session.user.walletAddress}</b></span></div>
                    <button
                      className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                      onClick={() => tip(0.1)}
                    >
                      Tip the developer 0.1 WLD
                    </button>
                    <button
                      className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                      onClick={() => tip(1.0)}
                    >
                      Tip the developer 1.0 WLD
                    </button>
                    {tipAmount && <div className="text-green-500 italic">Thanks for tipping the developer {tipAmount} WLD</div>}
                  </>}
                  {!session.isAuthenticatedWallet && <button
                    className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                    onClick={signInWallet}
                  >
                    Sign in with World Wallet
                  </button>}
                  <hr style={{ width: "100px", margin: 10 }} />
                  {session.isAuthenticatedWorldID && worldIdDetails}
                  {!session.isAuthenticatedWorldID && <button
                    className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                    onClick={signInWorldID}
                  >
                    Sign in with World ID 4
                  </button>}
                  <hr style={{ width: "100px", margin: 10 }} />
                  <div>
                    Your location is: {
                      session.extra?.location
                        ? (<>
                            <div>latitude: {session.extra.location.latitude}</div>
                            <div>longitude: {session.extra.location.longitude}</div>
                          </>)
                        : "unknown"
                      }
                  </div>
                  <button
                    className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                    onClick={getLocation}
                  >
                    {session.extra?.location ? "Update Location" : "Get Location"}
                  </button>
                </div>
                {worldIdFlow}
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
                    onClick={signInWorldID}
                  >
                    Login with World ID 4
                  </button>
                </div>
                <div className="text-sm mt-3">World ID 4 uses a session-based connect flow and can reuse a saved session ID for returning users.</div>
                {worldIdFlow}
              </>
            ))}
          </>
        )}
      </main>
    </div>
  )
}
