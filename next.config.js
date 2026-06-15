/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Opt in to Turbopack with proper root configuration
  turbopack: {
    root: __dirname,
  },

  // Handle images from external sources
  images: {
    // No external domains needed as we're using SVG placeholders
    domains: [],
    remotePatterns: [],
    // Disable image optimization in development for better performance
    unoptimized: true,
  },
  
  // Add production browser source maps for better debugging
  productionBrowserSourceMaps: true,

  // Keep large static asset trees out of serverless function bundles.
  // `public/product-images` (27k+ files, ~387 MB) and `public/documents`
  // (catalog PDFs) are served statically from the CDN and never read by
  // server code at runtime — only product JSON under `public/data` is.
  // Bundling them pushed multiple functions past Vercel's 250 MB limit.
  // (Top-level key in Next 15+; was experimental.outputFileTracingExcludes before.)
  outputFileTracingExcludes: {
    '*': [
      './public/product-images/**',
      './public/documents/**',
    ],
  },
}

module.exports = nextConfig