import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * The navigation was restructured to six top-level sections. These keep the
   * old paths working — links already shared, anything a search engine has
   * indexed, and the QR codes on printed material from the last edition.
   *
   * Permanent (308) rather than temporary: the old paths are not coming back,
   * and a 308 passes ranking on to the new address instead of splitting it.
   * `:path*` carries the rest of the URL through, so a deep link to a single
   * article or speaker lands on that article or speaker, not on the index.
   */
  async redirects() {
    return [
      { source: '/forum', destination: '/events', permanent: true },
      { source: '/forum/:path*', destination: '/events/:path*', permanent: true },

      { source: '/news', destination: '/blog', permanent: true },
      { source: '/news/:path*', destination: '/blog/:path*', permanent: true },

      // The Deal Room is now a section in its own right rather than a page
      // inside Invest, so these two are not a simple prefix swap.
      { source: '/invest/opportunities', destination: '/deal-room', permanent: true },
      {
        source: '/invest/opportunities/:path*',
        destination: '/deal-room/:path*',
        permanent: true,
      },
      { source: '/invest/apply', destination: '/deal-room/apply', permanent: true },

      { source: '/invest/sectors', destination: '/learning-hub/sectors', permanent: true },
      {
        source: '/invest/sectors/:path*',
        destination: '/learning-hub/sectors/:path*',
        permanent: true,
      },
      {
        source: '/invest/doing-business',
        destination: '/learning-hub/doing-business',
        permanent: true,
      },
      { source: '/invest', destination: '/learning-hub', permanent: true },

      { source: '/media/downloads', destination: '/learning-hub/downloads', permanent: true },
      { source: '/media', destination: '/learning-hub/recordings', permanent: true },
      { source: '/media/:path*', destination: '/learning-hub/recordings', permanent: true },
    ]
  },
}

export default nextConfig
