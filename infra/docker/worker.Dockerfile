# syntax=docker/dockerfile:1
# Build context: repository root.  docker build -f infra/docker/worker.Dockerfile .
FROM node:26-trixie-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN npm install --global pnpm@12.15.0 && npm cache clean --force

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@2.11.10 prune @lingoup/worker --docker

FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ ./
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ ./
COPY tsconfig.base.json ./
RUN pnpm turbo run build --filter=@lingoup/worker \
 && pnpm deploy --filter=@lingoup/worker --prod --legacy /out/worker

FROM node:26-trixie-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /out/worker ./
USER node
CMD ["node", "--enable-source-maps", "dist/main.js"]
