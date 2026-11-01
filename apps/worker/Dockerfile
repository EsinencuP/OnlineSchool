FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@10.34.9
WORKDIR /workspace

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch --frozen-lockfile
COPY . .
RUN pnpm install --offline --frozen-lockfile && pnpm --filter @online-school/api build
RUN pnpm --filter @online-school/worker build

FROM base AS runtime
COPY --from=build --chown=node:node /workspace /workspace
ENV NODE_ENV=production
WORKDIR /workspace/apps/worker
USER node
CMD ["node", "dist/main.js"]
