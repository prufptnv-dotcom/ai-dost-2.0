# Backend Dockerfile for AI-Dost
# Multi‑stage build: install deps then run
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
