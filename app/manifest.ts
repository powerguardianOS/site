import type { MetadataRoute } from 'next'

// The installable "PowerGuardian" home-screen app: all sites of the account in one app (My sites = /account). Each
// controller keeps its own home-screen app as the local fallback (works without internet).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/account',
    name: 'PowerGuardian',
    short_name: 'PowerGuardian',
    description: 'All your PowerGuardian sites in one app.',
    start_url: '/account',
    scope: '/',
    display: 'standalone',
    background_color: '#060a14',
    theme_color: '#060a14',
    icons: [
      { src: '/icons/pg-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/pg-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/pg-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
