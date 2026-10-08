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
    disable: true, // Forced disable to prevent cached crashes
    // P3 #197: if `disable` is ever flipped to false, the plugin must NOT
    // clobber the hand-written public/sw.js (custom cache/fetch logic) —
    // give the generated worker its own filename.
    sw: 'next-pwa-sw.js',
  });
}

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  devIndicators: false,
  allowedDevOrigins: ['localhost', '127.0.0.1', 'localhost:3000', 'localhost:5000', '127.0.0.1:3000', '127.0.0.1:5000', '*.aidost.local'],
  // Turbopack root: absolute path to monorepo root (one level above frontend/)
  turbopack: {
    root: resolve(__dirname, '..'),
    // y-monaco (0.1.6) deep-imports `monaco-editor/esm/vs/editor/editor.api.js`,
    // but monaco-editor 0.56 added an exports map where `./*` rewrites to
    // `./esm/vs/*.js` — the old specifier would double the prefix
    // (`esm/vs/esm/vs/...`) and fail with "Module not found". Alias to the
    // specifier the exports map DOES accept: `./*.js` → `./esm/vs/*.js`
    // resolves `editor/editor.api.js` to the exact same file.
    resolveAlias: {
      'monaco-editor/esm/vs/editor/editor.api.js': 'monaco-editor/editor/editor.api.js',
    },
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
        destination: `${BACKEND_URL}/api/sandbox/:path*`
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
        source: '/api/research',
        destination: `${BACKEND_URL}/api/research`
      },
      {
        source: '/api/research/:path*',
        destination: `${BACKEND_URL}/api/research/:path*`
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
        source: '/api/projects',
        destination: `${BACKEND_URL}/api/projects`
      },
      {
        source: '/api/projects/:path*',
        destination: `${BACKEND_URL}/api/projects/:path*`
      },
      {
        source: '/api/assessment',
        destination: `${BACKEND_URL}/api/assessment`
      },
      {
        source: '/api/assessment/:path*',
        destination: `${BACKEND_URL}/api/assessment/:path*`
      },
      {
        source: '/api/workflows',
        destination: `${BACKEND_URL}/api/workflows`
      },
      {
        source: '/api/workflows/:path*',
        destination: `${BACKEND_URL}/api/workflows/:path*`
      },
      {
        source: '/api/verify',
        destination: `${BACKEND_URL}/api/verify`
      },
      {
        source: '/api/verify/:path*',
        destination: `${BACKEND_URL}/api/verify/:path*`
      },
      {
        source: '/api/memory/:path*',
        destination: `${BACKEND_URL}/api/memory/:path*`
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
        source: '/api/copilot',
        destination: `${BACKEND_URL}/api/copilot`
      },
      {
        source: '/api/copilot/:path*',
        destination: `${BACKEND_URL}/api/copilot/:path*`
      },
      {
        source: '/api/preview',
        destination: `${BACKEND_URL}/api/preview`
      },
      {
        source: '/api/preview/:path*',
        destination: `${BACKEND_URL}/api/preview/:path*`
      },
      {
        source: '/api/database',
        destination: `${BACKEND_URL}/api/database`
      },
      {
        source: '/api/database/:path*',
        destination: `${BACKEND_URL}/api/database/:path*`
      },
      {
        source: '/health',
        destination: `${BACKEND_URL}/health`
      },
      {
        source: '/api/travel',
        destination: `${BACKEND_URL}/api/travel`
      },
      {
        source: '/api/travel/:path*',
        destination: `${BACKEND_URL}/api/travel/:path*`
      },
      {
        source: '/api/language',
        destination: `${BACKEND_URL}/api/language`
      },
      {
        source: '/api/language/:path*',
        destination: `${BACKEND_URL}/api/language/:path*`
      },
      {
        source: '/api/decision',
        destination: `${BACKEND_URL}/api/decision`
      },
      {
        source: '/api/decision/:path*',
        destination: `${BACKEND_URL}/api/decision/:path*`
      },
      {
        source: '/api/security',
        destination: `${BACKEND_URL}/api/security`
      },
      {
        source: '/api/security/:path*',
        destination: `${BACKEND_URL}/api/security/:path*`
      },
      {
        source: '/api/catalog',
        destination: `${BACKEND_URL}/api/catalog`
      },
      {
        source: '/api/catalog/:path*',
        destination: `${BACKEND_URL}/api/catalog/:path*`
      },
      {
        source: '/src/:path*',
        destination: `${BACKEND_URL}/src/:path*`
      },
      // Catch-all LAST: fixes dead views (analytics/planning/writing/interpreter/
      // gemini-live-token/crew/rlhf/bharat/skills/quota/circuit-breaker/voice/...)
      // and any future /api/* route without editing this list each time.
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default loadPWA().then(withPWA => withPWA(nextConfig));
