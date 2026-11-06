# Node 24 includes the SQLite runtime used by server/store.mjs.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
COPY shared ./shared
COPY public ./public
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4317 PANTRY_DB=/data/pantry.sqlite
# Railway mounts its persistent volume as root-owned. Mount /data before starting.
# No local database or seed is copied; the first start creates a new online DB.
RUN mkdir -p /data
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/assets/audio/*CREDITS* ./dist/credits/audio/
COPY --from=build /app/src/assets/environments/SEA_CREDITS.txt ./dist/credits/environments/
COPY server ./server
COPY shared/*.mjs ./shared/
EXPOSE 4317
CMD ["node", "server/start.mjs"]
