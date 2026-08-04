# Use Node.js 20 LTS Alpine image for minimal footprint
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies in production mode
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose backend port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Command to run application
CMD ["node", "server.js"]
