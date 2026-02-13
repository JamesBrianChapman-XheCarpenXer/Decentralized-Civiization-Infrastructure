# SRCP Enterprise - Production Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Builder
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /build

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build application
RUN npm run build

# Run tests
RUN npm run test

# Stage 2: Production
FROM node:20-alpine

# Install security updates
RUN apk upgrade --no-cache && \
    apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S srcp && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G srcp srcp

WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder --chown=srcp:srcp /build/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=srcp:srcp /build/dist ./dist
COPY --from=builder --chown=srcp:srcp /build/package*.json ./

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:$PORT/health || exit 1

# Switch to non-root user
USER srcp

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/server.js"]

# Expose port
EXPOSE 3000

# Labels
LABEL maintainer="SRCP Enterprise Team" \
      version="6.0.0-enterprise" \
      description="SRCP Decentralized Platform - Production Image"
