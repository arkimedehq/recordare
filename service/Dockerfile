# Recordare service. Build from the repository root: docker build -f service/Dockerfile service
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 8080
# Apply migrations, then start (single-instance home / research deployments).
CMD ["sh", "-c", "npx typeorm migration:run -d dist/db/data-source.js && node dist/main.js"]
