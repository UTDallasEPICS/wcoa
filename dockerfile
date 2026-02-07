FROM node:22-slim AS builder

# 1. Install OpenSSL & clean up in one layer
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 2. Setup PNPM & Prisma Environment
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true 
RUN corepack enable

WORKDIR /app

# 3. Cache Dependencies
COPY pnpm-lock.yaml package.json ./

# Use a named cache mount for the pnpm store
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod=false

# 4. Build Source
COPY . .
RUN npx prisma generate
RUN pnpm run build

# Stage 2: Deployment
FROM node:22-slim AS deployment
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Only copy what is strictly necessary for the runtime
COPY --from=builder /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
