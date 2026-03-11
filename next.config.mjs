/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' bundles the app into a self-contained output for Docker deployments.
  // On Vercel this setting is ignored — Vercel handles its own output format.
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,

  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
