# Single-container build — Express backend serves the built React frontend.
# Simpler than the two-container setup but the recommended approach is docker-compose
# with separate frontend (nginx) and backend (Node) containers.
# See docker-compose.yml for the production multi-container configuration.

# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:24-alpine AS frontend-builder

WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:24-alpine AS production

LABEL org.opencontainers.image.title="FocusBoard"
LABEL org.opencontainers.image.description="ADHD-friendly task aggregator — Jira, Gmail, GitHub, Slack and Calendar in one place"
LABEL org.opencontainers.image.source="https://github.com/Briancoughlin/FocusBoard"

WORKDIR /app

# Backend dependencies (production only)
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Backend source
COPY backend/ ./backend/

# Built frontend — served as static files by the Express backend
COPY --from=frontend-builder /build/frontend/dist ./backend/public-dist

# Persistent data directories — mount these as volumes
RUN mkdir -p /app/backend/data /app/backend/logs /app/backend/backups

# Run as non-root for security
RUN addgroup -S focusboard && adduser -S focusboard -G focusboard
RUN chown -R focusboard:focusboard /app
USER focusboard

EXPOSE 3001

WORKDIR /app/backend

# Health check — verifies the server is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/ > /dev/null || exit 1

CMD ["node", "server.js"]
