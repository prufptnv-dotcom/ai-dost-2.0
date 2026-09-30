FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies needed for Next.js
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (ignoring scripts if any that fail on alpine)
RUN npm ci

# Copy all files
COPY . .

# Build the Next.js application
# P3 #184: declare the NEXT_PUBLIC_* build args compose passes — undeclared
# args are silently dropped by BuildKit, so these were never inlined before.
# P3 #185: BACKEND_INTERNAL_URL must be set at BUILD time — rewrites are baked
# into .next/routes-manifest.json, a runtime override is a no-op.
ARG BACKEND_INTERNAL_URL=http://backend:5000
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
ARG NEXT_PUBLIC_GO_WS_URL=ws://localhost:5000
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_GO_WS_URL=$NEXT_PUBLIC_GO_WS_URL
RUN npm run build

# Production image
# P3 #204: use Next's pruned standalone output — the old runner copied the
# FULL node_modules (devDependencies: jest, playwright, tailwind, ...) and ran
# `npm start` (next start), so .next/standalone was built but never used.
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Monorepo layout: standalone contains a nested frontend/ dir —
#   .next/standalone/frontend/server.js serves from there.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./frontend/.next/static
COPY --from=builder --chown=node:node /app/public ./frontend/public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

USER node

CMD ["node", "frontend/server.js"]
