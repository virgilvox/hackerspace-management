/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' bundles the app into a self-contained output for Docker deployments.
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,

  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
