# ---- Base Node ----
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# ---- Dependencies ----
FROM base AS deps
COPY package*.json ./
# Install only production dependencies
RUN npm ci --only=production
# Also install all dependencies (including dev) in a separate folder for building
RUN cp -R node_modules prod_node_modules
RUN npm ci

# ---- Build ----
FROM base AS build
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production

# Install additional packages needed for PDF generation if using puppeteer/pdfmake
RUN apk add --no-cache fontconfig ttf-dejavu

# Copy production node_modules
COPY --from=deps /usr/src/app/prod_node_modules ./node_modules
# Copy built files
COPY --from=build /usr/src/app/dist ./dist

# Create necessary directories
RUN mkdir -p uploads/documents uploads/images && chown -R node:node uploads

USER node
EXPOSE 8080

CMD ["node", "dist/main"]
