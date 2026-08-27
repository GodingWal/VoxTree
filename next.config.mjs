/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage (user avatars, voice samples)
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
      // GCS bucket for VoxTree media
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      // Replicate CDN for generated Pixar avatars
      { protocol: 'https', hostname: 'replicate.delivery' },
      { protocol: 'https', hostname: 'replicate.com' },
      // Vercel Blob / generic CDN if needed (restrict further once known)
      { protocol: 'https', hostname: '**.vercel-storage.com' },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
      "@ffmpeg-installer/ffmpeg",
      "@ffprobe-installer/ffprobe",
      "fluent-ffmpeg",
    ],
  },
  // Ensure the binary-installer packages are never bundled by webpack on
  // the server — they use dynamic require() with variable paths that
  // webpack turns into a `sync ^.*\/.*$` context covering every file in
  // the package (README.md, .d.ts, tsconfig.json) which then fails to parse.
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = [
        "@ffmpeg-installer/ffmpeg",
        "@ffprobe-installer/ffprobe",
        "fluent-ffmpeg",
      ];
      // Preserve existing externals (array or function)
      const prev = config.externals;
      config.externals = [
        ...(Array.isArray(prev) ? prev : prev ? [prev] : []),
        ...externals,
      ];
    }
    return config;
  },
};

export default nextConfig;
