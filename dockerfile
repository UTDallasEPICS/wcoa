# Stage 1: Build
FROM node:22-slim AS builder

# Install OpenSSL (required for Prisma on Debian-slim)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy lockfile first
COPY pnpm-lock.yaml package.json ./

# Use a BuildKit cache mount to persist pnpm's store across builds
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source and generate/build
COPY . .
RUN npx prisma generate
RUN pnpm run build

# Stage 2: Deployment
FROM node:22-slim AS deployment

# Install OpenSSL for production runtime
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the build output
COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
