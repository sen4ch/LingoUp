# syntax=docker/dockerfile:1
# Build context: repository root.  docker build -f infra/docker/web.Dockerfile .
FROM node:24-trixie-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.15.0 && npm cache clean --force

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@2.11.10 prune @lingoup/web --docker

FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ ./
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ ./
COPY tsconfig.base.json eslint.config.mjs ./
RUN pnpm turbo run build --filter=@lingoup/web

# Next.js standalone output: a minimal server with only the traced dependencies.
FROM node:24-trixie-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
