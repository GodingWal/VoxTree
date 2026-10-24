/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      // GCS bucket for VoxTree media
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      // Replicate CDN for generated Pixar avatars
      { protocol: 'https', hostname: 'replicate.delivery' },
      { protocol: 'https', hostname: 'replicate.com' },
    ],
  },
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe",
    "fluent-ffmpeg",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
