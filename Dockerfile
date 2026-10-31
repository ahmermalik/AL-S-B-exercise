FROM node:24.22.2-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@11.8.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN BETTER_AUTH_SECRET=build-only-placeholder-never-use-at-runtime pnpm build
RUN pnpm exec esbuild src/worker.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/worker.mjs && pnpm exec esbuild scripts/setup.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/setup.mjs
RUN pnpm prune --prod

FROM node:24.22.2-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 DATABASE_PATH=/var/lib/asset-living/close.sqlite
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --chown=node:node scripts/container-start.sh ./container-start.sh
RUN mkdir -p /var/lib/asset-living && chown node:node /var/lib/asset-living
USER node
EXPOSE 3000
VOLUME ["/var/lib/asset-living"]
ENTRYPOINT ["sh", "./container-start.sh"]
CMD ["web"]
