# Build a small production image for the app
FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the source
COPY backend ./backend
COPY frontend ./frontend

EXPOSE 3000

# Basic container healthcheck hitting our /api/health endpoint
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "backend/server.js"]
