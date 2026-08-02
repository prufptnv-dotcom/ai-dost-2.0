const BACKEND_URL = process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || 'http://localhost:3000';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/chat/:path*',
        destination: `${BACKEND_URL}/api/chat/:path*`,
      },
      {
        source: '/api/image/:path*',
        destination: `${BACKEND_URL}/api/image/:path*`,
      },
      {
        source: '/api/test/:path*',
        destination: `${BACKEND_URL}/api/test/:path*`,
      },
      {
        source: '/api/pdf/:path*',
        destination: `${BACKEND_URL}/api/pdf/:path*`,
      },
      {
        source: '/health',
        destination: `${BACKEND_URL}/health`,
      },
    ];
  },
};

export default nextConfig;
