'use client'

import Image from "next/image";
import { useWorldAuth } from 'next-world-auth/react';

export default function Home() {

  const { isInstalled, isAuthenticated, session, signIn, signOut } = useWorldAuth();

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] text-center">
      <main className="flex flex-col gap-8 row-start-2 items-center">
        <div className="text-2xl font-bold">World Mini App Template</div>
        <div>Template available on <a href="https://github.com/gip/worlddev/tree/main/next-mini-app" target="_blank" rel="noopener noreferrer" style={{ color: '#0070f3', fontStyle: 'italic', textDecoration: 'underline' }}>GitHub</a></div>
        {!isInstalled && <>
          <div>This app is designed to be run on <a href="https://worldcoin.org/mini-app?app_id=app_a963cd2077f59caf1146198685eed59a&draft_id=meta_4d75d4955b27044f4ef562e60ad09d17" target="_blank" rel="noopener noreferrer">World App</a></div>
          <Image src="/miniappqr.png" alt="Mini App QR Code" width={400} height={400} />
        </>}
        {isInstalled && (isAuthenticated ? (
          <>
            <div>You are logged in!</div>
            <div>Welcome {session?.user?.username}!</div>
            <div>Your wallet address is: {session?.user?.walletAddress}</div>
            <div className="flex gap-4 items-center flex-col sm:flex-row">
              <button
                className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                onClick={signOut}
              >
                Logout
              </button>
            </div>
          </>
        ) : (
          <>
            <div>Welcome Guest!</div>
            <ol className="list-inside list-decimal text-sm font-[family-name:var(--font-geist-mono)]">
              <li className="mb-2">
                Wallet authentication for World Mini Apps
              </li>
              <li>A few lines of code to get you started</li>
            </ol>
            <div className="flex gap-4 items-center flex-col sm:flex-row">
              <button
                className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                onClick={signIn}
              >
                Login with World Wallet
              </button>
            </div>
          </>
        ))}
      </main>
    </div>
  );
}