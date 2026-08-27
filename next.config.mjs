/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
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
