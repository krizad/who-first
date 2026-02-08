# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy client package files
COPY client/package*.json ./client/

# Install dependencies (including devDependencies for building)
# Root install covers server deps and dev tools
RUN npm install
# Client install
RUN cd client && npm install

# Copy source code
COPY . .

# Build both client and server
RUN npm run build:client
RUN npm run build:server

# Stage 2: Production Run
FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy package files for structure (optional but good configs)
COPY package*.json ./

# Copy dependencies
# For a cleaner image, we might want to run npm ci --omit=dev here, 
# but simply copying node_modules from builder is faster and ensures version match.
# However, builder has devDependencies. 
# Let's prune them in a separate step or just copy. 
# Given simple app, copying is fine, but let's try to be clean.
# We'll re-install only production deps.
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

# Copy built server
COPY --from=builder /app/server/dist ./server/dist

# Copy built client to where the server expects it
# Server (in dist/index.js) looks for path.join(__dirname, '../client/dist')
# If __dirname is /app/server/dist, then .. is /app/server.
# So it looks for /app/server/client/dist.
COPY --from=builder /app/client/dist ./server/client/dist

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
