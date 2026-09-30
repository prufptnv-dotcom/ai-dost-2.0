FROM node:22-bookworm

WORKDIR /app

# P3 #190: production container by default — .env ships NODE_ENV=development
# for host runs and `env_file` would otherwise flip the image to dev mode.
# (docker-compose sets it too, so compose interpolation can still override.)
ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# P3 #195: browsers in a shared world-readable path — the node user below
# cannot read /root/.cache/ms-playwright (where npx playwright install runs
# as root).
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium --with-deps && chmod -R a+rX /ms-playwright

# Copy the rest of the backend files
COPY . .

# P3 #195: run as non-root. With compose bind-mounting
# ./backend/temp/sandboxes, a root-privileged server wrote root-owned files
# onto the host that a normal user could not delete. (Sandbox dirs already
# created as root need a one-time `chmod -R u+rwX` on the host.)
RUN chown -R node:node /app

# Expose the API port
EXPOSE 5000

USER node

# Start the application with the same runtime policy preload chain as npm
# start (P2 #181/#182 — security-hardening, taskCancellation, chatAgentRouteBridge)
CMD ["node", "-r", "./security-hardening.js", "-r", "./taskCancellation.js", "-r", "./chatAgentRouteBridge.js", "server.js"]
