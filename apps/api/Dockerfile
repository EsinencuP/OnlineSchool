FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@10.34.9
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @online-school/api build

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@10.34.9
COPY --from=build --chown=node:node /workspace /workspace
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# This directory makes the documented `pnpm prisma migrate deploy` exec command resolve correctly.
WORKDIR /workspace/packages/db
USER node
EXPOSE 3000
CMD ["node", "/workspace/apps/api/dist/main.js"]
