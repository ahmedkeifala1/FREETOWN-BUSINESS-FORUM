import type { Metadata, Viewport } from 'next'
import { Inter, Poppins } from 'next/font/google'

import './globals.css'

import { Footer } from '@/components/site/footer'
import { Header } from '@/components/site/header'
import { getCurrentUser } from '@/lib/auth'
import { isStaff } from '@/lib/rbac'
import { getCurrentEvent, getSettings, setting } from '@/lib/settings'

/**
 * Root layout — the shared chrome from §3.5.
 *
 * Fonts follow §3.3: Poppins for headings, Inter for body. `next/font` self-
 * hosts both, so there is no request to Google's servers on the critical path
 * and no layout shift when they land (NFR-01).
 */

const poppins = Poppins({
  subsets: ['latin'],
  // Only the weights the design uses. Each extra weight is another file on a
  // 3G connection — 800 earns its place on the homepage hero, where the three
  // stacked words are the whole composition and 700 reads as merely bold.
  weight: ['600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const [settings, event] = await Promise.all([getSettings(), getCurrentEvent()])

  const siteName = setting(settings, 'site.name')
  const tagline = setting(settings, 'site.tagline')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fbf.sl'

  return {
    metadataBase: new URL(siteUrl),
    title: {
      // Page titles read "Speakers | Freetown Business Forum".
      default: event ? `${siteName} — ${event.theme}` : siteName,
      template: `%s | ${siteName}`,
    },
    description: event?.description?.slice(0, 300) ?? tagline,
    applicationName: siteName,
    keywords: [
      'Sierra Leone',
      'business forum',
      'investment',
      'Freetown',
      'West Africa',
      'trade',
      'deal room',
    ],
    openGraph: {
      type: 'website',
      siteName,
      locale: 'en_GB',
      title: siteName,
      description: tagline,
      url: siteUrl,
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
    alternates: { canonical: '/' },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // No maximum-scale: pinch-zoom must not be disabled (WCAG 1.4.4, NFR-09).
  themeColor: '#0F7A3D',
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const [event, user] = await Promise.all([getCurrentEvent(), getCurrentUser()])

  return (
    <html
      lang="en-GB"
      className={`${poppins.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white">
        <Header
          eventName={event?.name ?? null}
          registrationOpen={event?.registrationOpen ?? false}
          userFirstName={user?.firstName ?? null}
          isStaff={isStaff(user?.role)}
        />

        <main id="main" className="flex-1">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  )
}
