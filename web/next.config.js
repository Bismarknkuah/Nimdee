/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  optimizeFonts: false,
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  async headers() {
    return [{ source: '/sw.js', headers: [{ key: 'Service-Worker-Allowed', value: '/' }, { key: 'Cache-Control', value: 'no-cache' }] }];
  },
};
module.exports = nextConfig;
