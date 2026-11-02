# VoxTree app image — Next.js app + voice-job worker (same image,
# two commands; see docker-compose.yml services `app` and `worker`).
#
# Debian slim (not Alpine): @ffmpeg-installer/@ffprobe-installer ship
# glibc binaries that do not run on musl, and clip generation shells
# out to them. Node 24 matches local development.
FROM node:24-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time only placeholders so module import / static generation
# never reaches for real services. Real values are injected at
# runtime via the server env file (see the deploy runbook).
ENV DATABASE_URL=postgres://user:pass@localhost:5432/dummy \
    AUTH_SECRET=dummy-auth-secret-that-is-at-least-32-chars \
    NEXT_PUBLIC_APP_URL=http://localhost:3000
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
# The voice worker runs from TypeScript source via tsx.
COPY --from=build /app/workers ./workers
COPY --from=build /app/lib ./lib
COPY --from=build /app/types ./types
COPY --from=build /app/tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["npm", "run", "start"]
