# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# --omit=dev: only install production dependencies in the final image
RUN npm ci --omit=dev

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Run as non-root user — security best practice
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy deps from build stage and source code
COPY --from=deps /app/node_modules ./node_modules
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY package.json ./

# Document the port (doesn't actually expose it — docker run -p does that)
EXPOSE 3000

# Health check: Docker will monitor this container's health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
