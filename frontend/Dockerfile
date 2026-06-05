# ── Stage 1: Build React app ─────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /build

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine

# Copy the built React app
COPY --from=builder /build/dist /usr/share/nginx/html

# Copy our nginx config (SPA routing + API proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx serves on port 80 internally; docker-compose maps it to 3001 on the host
EXPOSE 80
