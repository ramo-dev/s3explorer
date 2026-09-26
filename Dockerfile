# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Dependency manifests are copied on their own so the install layer stays cached
# across source-only changes. pnpm resolves against the workspace root, so the
# root lockfile + workspace file are required -- this is why we no longer build
# each app in isolation the way `npm ci` allowed.
# ---------------------------------------------------------------------------

# ---------- client ----------
FROM node:20-alpine AS client-builder
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter s3-explorer-client...
COPY apps/client/ apps/client/
RUN pnpm --filter s3-explorer-client build

# ---------- server ----------
FROM node:20-alpine AS server-builder
WORKDIR /repo

# Install native deps for better-sqlite3 compilation
RUN apk add --no-cache python3 make g++

RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter s3-explorer-server...
COPY apps/server/ apps/server/
RUN pnpm --filter s3-explorer-server build

# `pnpm deploy` emits a self-contained, symlink-free node_modules. Copying the
# virtual store across stages directly would leave dangling symlinks, because
# pnpm's node_modules entries point into a store path that doesn't exist yet.
RUN pnpm --filter s3-explorer-server --prod deploy /out

# ---------- production ----------
FROM node:20-alpine AS production
WORKDIR /app

# python3/make/g++ for the better-sqlite3 native rebuild; su-exec for the
# entrypoint to drop from root -> node after fixing volume ownership.
RUN apk add --no-cache python3 make g++ su-exec

# Copy server build and dependencies
COPY --from=server-builder /out/node_modules ./node_modules
COPY --from=server-builder /out/dist ./dist
COPY --from=server-builder /out/package.json ./

# Rebuild native modules for Alpine
RUN npm rebuild better-sqlite3

# Copy client build to be served by the server
COPY --from=client-builder /repo/apps/client/dist ./public

# /data is reconciled by the entrypoint at runtime so bind mounts and managed
# volumes (Railway, etc.) work regardless of the host's mount permissions.
RUN mkdir -p /data

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
