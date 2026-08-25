import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Tally — Collaborative Financial Planning',
  description:
    'AI-powered collaborative financial planning for groups, communities, and organizations working toward shared financial goals.',
  keywords: 'group savings, collaborative finance, shared goals, contribution tracker, financial planning',
  openGraph: {
    title: 'Tally — Collaborative Financial Planning',
    description: 'Plan, track, and achieve shared financial goals together.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
