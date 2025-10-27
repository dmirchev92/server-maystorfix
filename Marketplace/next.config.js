/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'https://maystorfix.com',
  },
  images: {
    domains: ['localhost', 'servicetextpro.bg', 'maystorfix.com', '46.224.11.139'],
  },
  // Removed rewrites - using direct API calls instead
}

module.exports = nextConfig

