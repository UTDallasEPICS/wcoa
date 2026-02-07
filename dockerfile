# Stage 1: Build
FROM node:22-slim AS builder

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

# Clean up non-production dependencies to keep the image slim
# This ensures better-sqlite3 remains compiled for ARM
RUN pnpm prune --prod

# Stage 2: Deployment
FROM node:22-slim AS deployment
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy the built Nuxt output
COPY --from=builder /app/.output ./.output

# Copy the production node_modules which contains the compiled better-sqlite3 binaries
# This is the missing link that was causing the "bindings" error
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema (often needed for runtime migrations)
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", ".output/server/index.mjs"]
