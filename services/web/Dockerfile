# syntax=docker/dockerfile:1

# ---- deps: exactly what package-lock.json says ----
FROM node:24-alpine AS deps
WORKDIR /app
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    npm ci --no-audit --no-fund

# ---- build: a standalone server (server.js plus only the node_modules it needs) ----
FROM node:24-alpine AS build
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime: Node and the standalone build, non-root ----
FROM node:24-alpine
ARG APP_VERSION=0.0.0
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 \
    APP_VERSION=${APP_VERSION}
# npm, corepack and yarn are only needed to build, and their bundled packages show up in CVE scans.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn* \
 && addgroup -S -g 10001 app && adduser -S -u 10001 -G app -H app
WORKDIR /app
COPY --from=build --chown=10001:10001 /app/.next/standalone ./
COPY --from=build --chown=10001:10001 /app/.next/static ./.next/static
COPY --from=build --chown=10001:10001 /app/public ./public
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# On SIGTERM, Next.js stops accepting connections and finishes in-flight requests, then exits.
CMD ["node", "server.js"]
