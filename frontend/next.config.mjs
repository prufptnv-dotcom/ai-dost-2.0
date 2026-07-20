/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/chat/:path*',
        destination: 'http://localhost:3002/api/chat/:path*',
      },
      {
        source: '/api/image/:path*',
        destination: 'http://localhost:3002/api/image/:path*',
      },
      {
        source: '/api/test/:path*',
        destination: 'http://localhost:3002/api/test/:path*',
      },
      {
        source: '/api/pdf/:path*',
        destination: 'http://localhost:3002/api/pdf/:path*',
      },
      {
        source: '/health',
        destination: 'http://localhost:3002/health',
      },
    ];
  },
};

export default nextConfig;
