/** @type {import('next').NextConfig} */
const supabaseHostname = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : "example.supabase.co";
  } catch {
    return "example.supabase.co";
  }
})();

const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      // Supabase Storage (user avatars, voice samples)
      { protocol: 'https', hostname: supabaseHostname },
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
