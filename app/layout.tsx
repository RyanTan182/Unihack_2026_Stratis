import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ToastContainer } from '@/components/ui/toast-notification'
import { Toaster } from "sonner"
import './globals.css'

const geist = Geist({
  subsets: ["latin"],
  variable: '--font-sans',
  display: 'swap',
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Stratis — Supply Chain Intelligence',
  description: 'Real-time global supply chain risk analysis with AI-powered predictions and live news monitoring',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
        <Analytics />
        <ToastContainer />
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
