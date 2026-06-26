# ---- Base Node ----
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# ---- Dependencies ----
FROM base AS deps
# Install libc6-compat for Next.js image optimization
RUN apk add --no-cache libc6-compat
COPY package*.json ./
RUN npm ci

# ---- Build ----
FROM base AS build
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
# Next.js telemetry is disabled
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=build --chown=nextjs:nodejs /usr/src/app/public ./public
COPY --from=build --chown=nextjs:nodejs /usr/src/app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /usr/src/app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
# Server.js is created by next build from the standalone output
CMD ["node", "server.js"]
