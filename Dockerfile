# Multi-stage build for optimized production image
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files for better layer caching
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies with npm ci for faster, reliable builds
WORKDIR /app/backend
RUN npm ci --include=dev --no-audit --no-fund && \
    npm cache clean --force

# Copy source code
COPY backend/ ./

# Build application (if there are build steps)
# RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install system dependencies and security updates
RUN apk add --no-cache \
    dumb-init \
    curl \
    tini \
    && apk upgrade \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install only production dependencies
WORKDIR /app/backend
RUN npm ci --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Go back to app root and copy source
WORKDIR /app

# Copy backend source code and configuration
COPY --from=builder --chown=appuser:nodejs /app/backend/src/ ./backend/src/
COPY --chown=appuser:nodejs backend/env.example ./backend/

# Copy frontend assets
COPY --chown=appuser:nodejs frontend/ ./frontend/

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && \
    chown -R appuser:nodejs /app && \
    chmod -R 755 /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Add labels for better container management
LABEL maintainer="No-JS AI Chat Team" \
      version="2.0" \
      description="No-JS AI Chat Application" \
      org.opencontainers.image.source="https://github.com/your-username/no-js-ai-chat"

# Health check with improved reliability
HEALTHCHECK --interval=30s --timeout=15s --start-period=45s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["node", "backend/src/server.js"]