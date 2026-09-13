/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Allow larger request bodies for multi-image uploads (up to 100 images).
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  // Baseline anti-hack headers. No framing of the app (clickjacking), no
  // MIME sniffing (uploaded-asset confusion), minimal referrer leakage, and
  // hardware features the app never uses stay off (file-picker uploads are
  // unaffected — no getUserMedia anywhere in src/).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
