# Production Dockerfile for NyxZap (Vite Frontend + Node.js Baileys Express Backend)
FROM node:22-alpine

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install npm packages cleanly
RUN npm install

# Copy application source code
COPY . .

# Build the React / Vite frontend for production
RUN npm run build:frontend

# Ensure whatsapp_auth persistent directory exists
RUN mkdir -p /app/whatsapp_auth

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose internal port
EXPOSE 3000

# Volume for persistent WhatsApp session credentials
VOLUME ["/app/whatsapp_auth"]

# Start production server using tsx
CMD ["npx", "tsx", "server/index.ts"]
