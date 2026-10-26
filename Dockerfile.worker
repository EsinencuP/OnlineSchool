FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@10.34.9
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @online-school/api build
RUN pnpm --filter @online-school/worker build

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@10.34.9
COPY --from=build --chown=node:node /workspace /workspace
ENV NODE_ENV=production
WORKDIR /workspace/apps/worker
USER node
CMD ["node", "dist/main.js"]
