# syntax=docker/dockerfile:1.7
# Build from the repository root:  docker build -f apps/api/Dockerfile -t impact-pro-api .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile --filter @impact-pro/api...
COPY packages/config packages/config
COPY apps/api apps/api
RUN pnpm --filter @impact-pro/api build \
  && pnpm --filter @impact-pro/api deploy --prod --legacy /out \
  && cp -r apps/api/dist /out/dist \
  && cd /out && npx prisma generate --schema prisma/schema.prisma

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
# Apply pending migrations, then start. Secrets come from the runtime environment.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
