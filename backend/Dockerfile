# Backend Dockerfile for AI-Dost
# Multi‑stage build: install deps then run
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY . .
USER node
EXPOSE 5000
CMD ["node", "server.js"]
