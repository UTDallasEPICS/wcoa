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

# Prune to remove devDependencies (saves hundreds of MBs)
RUN pnpm prune --prod

# --- Stage 2: Deployment ---
FROM node:22-slim AS deployment
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# 1. Copy the built Nuxt output
COPY --from=builder /app/.output ./.output

# 2. Copy production node_modules 
# IMPORTANT: Also copy the node_modules from inside the server output if they exist
COPY --from=builder /app/node_modules ./node_modules

# 3. Copy package.json and Prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# NEW: Set this env var to help Node find the bindings
ENV NODE_PATH=/app/node_modules
EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", ".output/server/index.mjs"]
