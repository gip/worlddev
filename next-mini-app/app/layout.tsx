import type { Metadata } from "next"
import "./globals.css"
import { WorldAuthProvider } from 'next-world-auth/react'

export const metadata: Metadata = {
  title: "World Mini App",
  description: "Wallet authentication for World Mini Apps"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <WorldAuthProvider>
        <body className="antialiased">
          {children}
        </body>
      </WorldAuthProvider>
    </html>
  )
}
