# Stage 1: Build
FROM node:22-slim AS builder

ENV CI=true

# Install build essentials for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Setup PNPM & Prisma Environment
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true 
RUN corepack enable

WORKDIR /app

# Cache Dependencies
COPY pnpm-lock.yaml package.json ./

# Install all dependencies (including devDeps for the build)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN npx prisma generate
RUN pnpm run build

# --- Stage 2: Deployment ---
FROM node:22-slim AS deployment

# Install build essentials for native modules (better-sqlite3 needs python/make/g++)
RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy package files first
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/prisma ./prisma

# Install production dependencies FRESH
# This ensures native modules like better-sqlite3 are built for the runtime environment
RUN pnpm install --prod --frozen-lockfile

# Copy the built application
COPY --from=builder /app/.output ./.output

# FIX: Replace the incomplete node_modules in .output with our fresh installation
# We use -L to dereference symlinks (important for pnpm) so we get real files
RUN rm -rf .output/server/node_modules && \
    cp -rL /app/node_modules .output/server/node_modules

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", ".output/server/index.mjs"]
