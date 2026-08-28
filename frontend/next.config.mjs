import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || 'http://127.0.0.1:5000';

async function loadPWA() {
  const { default: withPWA } = await import('@ducanh2912/next-pwa');
  return withPWA({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    sw: 'sw.js',
  });
}

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  allowedDevOrigins: ['localhost', '127.0.0.1', 'localhost:3000', 'localhost:5000', '127.0.0.1:3000', '127.0.0.1:5000', '*.aidost.local'],
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
        source: '/api/v1/sandbox/:path*',
        destination: `${BACKEND_URL}/api/test/:path*`
      },
      {
        source: '/api/v1/:path*',
        destination: `${BACKEND_URL}/api/v1/:path*`
      },
      {
        source: '/api/chat',
        destination: `${BACKEND_URL}/api/chat`
      },
      {
        source: '/api/chat/:path*',
        destination: `${BACKEND_URL}/api/chat/:path*`
      },
      {
        source: '/api/agent',
        destination: `${BACKEND_URL}/api/agent`
      },
      {
        source: '/api/agent/:path*',
        destination: `${BACKEND_URL}/api/agent/:path*`
      },
      {
        source: '/api/sandbox',
        destination: `${BACKEND_URL}/api/sandbox`
      },
      {
        source: '/api/sandbox/:path*',
        destination: `${BACKEND_URL}/api/sandbox/:path*`
      },
      {
        source: '/api/figma',
        destination: `${BACKEND_URL}/api/figma`
      },
      {
        source: '/api/figma/:path*',
        destination: `${BACKEND_URL}/api/figma/:path*`
      },
      {
        source: '/api/deploy',
        destination: `${BACKEND_URL}/api/deploy`
      },
      {
        source: '/api/deploy/:path*',
        destination: `${BACKEND_URL}/api/deploy/:path*`
      },
      {
        source: '/api/document',
        destination: `${BACKEND_URL}/api/document`
      },
      {
        source: '/api/document/:path*',
        destination: `${BACKEND_URL}/api/document/:path*`
      },
      {
        source: '/api/eval',
        destination: `${BACKEND_URL}/api/eval`
      },
      {
        source: '/api/eval/:path*',
        destination: `${BACKEND_URL}/api/eval/:path*`
      },
      {
        source: '/api/image',
        destination: `${BACKEND_URL}/api/image`
      },
      {
        source: '/api/image/:path*',
        destination: `${BACKEND_URL}/api/image/:path*`
      },
      {
        source: '/api/pdf',
        destination: `${BACKEND_URL}/api/pdf`
      },
      {
        source: '/api/pdf/:path*',
        destination: `${BACKEND_URL}/api/pdf/:path*`
      },
      {
        source: '/api/learning',
        destination: `${BACKEND_URL}/api/learning`
      },
      {
        source: '/api/learning/:path*',
        destination: `${BACKEND_URL}/api/learning/:path*`
      },
      {
        source: '/api/git',
        destination: `${BACKEND_URL}/api/git`
      },
      {
        source: '/api/git/:path*',
        destination: `${BACKEND_URL}/api/git/:path*`
      },
      {
        source: '/api/test/:path*',
        destination: `${BACKEND_URL}/api/test/:path*`
      },
      {
        source: '/api/terminal',
        destination: `${BACKEND_URL}/api/terminal`
      },
      {
        source: '/api/terminal/:path*',
        destination: `${BACKEND_URL}/api/terminal/:path*`
      },
      {
        source: '/api/preview/:path*',
        destination: `${BACKEND_URL}/api/preview/:path*`
      },
      {
        source: '/health',
        destination: `${BACKEND_URL}/health`
      },
    ];
  },
};

export default loadPWA().then(withPWA => withPWA(nextConfig));
