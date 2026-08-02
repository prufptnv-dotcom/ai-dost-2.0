const BACKEND_URL = process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || 'http://localhost:3000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/chat',
        destination: `${BACKEND_URL}/api/chat`,
      },
      {
        source: '/api/chat/:path*',
        destination: `${BACKEND_URL}/api/chat/:path*`,
      },
      {
        source: '/api/agent',
        destination: `${BACKEND_URL}/api/agent`,
      },
      {
        source: '/api/agent/:path*',
        destination: `${BACKEND_URL}/api/agent/:path*`,
      },
      {
        source: '/api/image',
        destination: `${BACKEND_URL}/api/image`,
      },
      {
        source: '/api/image/:path*',
        destination: `${BACKEND_URL}/api/image/:path*`,
      },
      {
        source: '/api/pdf',
        destination: `${BACKEND_URL}/api/pdf`,
      },
      {
        source: '/api/pdf/:path*',
        destination: `${BACKEND_URL}/api/pdf/:path*`,
      },
      {
        source: '/api/learning',
        destination: `${BACKEND_URL}/api/learning`,
      },
      {
        source: '/api/learning/:path*',
        destination: `${BACKEND_URL}/api/learning/:path*`,
      },
      {
        source: '/api/git',
        destination: `${BACKEND_URL}/api/git`,
      },
      {
        source: '/api/git/:path*',
        destination: `${BACKEND_URL}/api/git/:path*`,
      },
      {
        source: '/api/test/:path*',
        destination: `${BACKEND_URL}/api/test/:path*`,
      },
      {
        source: '/health',
        destination: `${BACKEND_URL}/health`,
      },
    ];
  },
};

export default nextConfig;
