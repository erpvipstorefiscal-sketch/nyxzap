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

# Ensure whatsapp_auth and uploads persistent directories exist
RUN mkdir -p /app/whatsapp_auth /app/uploads

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose internal port
EXPOSE 3000

# Volumes for persistent WhatsApp session credentials and uploaded flow media
VOLUME ["/app/whatsapp_auth", "/app/uploads"]

# Start production server using tsx
CMD ["npx", "tsx", "server/index.ts"]
