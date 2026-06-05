FROM node:24-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY . .

# Create data directories (overridden by volume mounts at runtime)
RUN mkdir -p data logs backups

# Run as non-root
RUN addgroup -S focusboard && adduser -S focusboard -G focusboard \
    && chown -R focusboard:focusboard /app
USER focusboard

# Backend is NOT exposed to the host — only reachable from the frontend container
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/config > /dev/null || exit 1

CMD ["node", "server.js"]
