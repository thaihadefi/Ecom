# --- build: compile TypeScript to dist/ ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# --- runtime: production deps only + compiled output ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=build /app/dist ./dist

# media/ is volume-mounted at runtime (docker-compose.yml), not baked into the image.

EXPOSE 4000
CMD ["node", "dist/index.js"]
