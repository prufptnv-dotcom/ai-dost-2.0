import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || 'http://127.0.0.1:5005';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Turbopack root: absolute path to monorepo root (one level above frontend/)
  turbopack: {
    root: resolve(__dirname, '..'),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'image.pollinations.ai',
      },
      {
        protocol: 'https',
        hostname: '**.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
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
