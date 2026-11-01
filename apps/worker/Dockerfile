# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@10.34.9
WORKDIR /workspace

FROM base AS dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=onlineschool-cleanup-pnpm-10,target=/pnpm/store \
    pnpm fetch --frozen-lockfile --store-dir=/pnpm/store

FROM dependencies AS build
COPY . .
RUN --mount=type=cache,id=onlineschool-cleanup-pnpm-10,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --store-dir=/pnpm/store \
    && pnpm --filter @online-school/api build \
    && pnpm --filter @online-school/worker build
RUN node infra/package-runtime.mjs /runtime

FROM base AS runtime
COPY --from=build --chown=node:node /runtime /workspace
ENV NODE_ENV=production
WORKDIR /workspace/apps/worker
USER node
CMD ["node", "dist/main.js"]
