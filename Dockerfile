# Multi-stage Dockerfile for NyxZap (Vite + Node.js Baileys Express Backend)
FROM node:22-bullseye-slim AS base

WORKDIR /app

# Install curl for healthchecks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Build the React/Vite frontend for production
RUN npm run build:frontend

# Ensure whatsapp_auth persistent directory exists
RUN mkdir -p /app/whatsapp_auth

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose server port
EXPOSE 3000

# Volume for persistent WhatsApp session credentials
VOLUME ["/app/whatsapp_auth"]

# Start production server using tsx
CMD ["npx", "tsx", "server/index.ts"]
