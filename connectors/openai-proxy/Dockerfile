# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
#
# Recordare memory proxy. Build from the repository root (the proxy bundles packages/client):
#   docker build -f connectors/openai-proxy/Dockerfile -t recordare-openai-proxy .
FROM node:22-alpine AS build
WORKDIR /src
COPY packages/client/package.json packages/client/package-lock.json packages/client/
RUN cd packages/client && npm ci --no-audit --no-fund
COPY connectors/openai-proxy/package.json connectors/openai-proxy/package-lock.json connectors/openai-proxy/
RUN cd connectors/openai-proxy && npm ci --no-audit --no-fund
COPY packages/client/src packages/client/src
COPY connectors/openai-proxy/tsconfig.json connectors/openai-proxy/
COPY connectors/openai-proxy/src connectors/openai-proxy/src
RUN cd connectors/openai-proxy && npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=8788
WORKDIR /app
# The bundle is self-contained (no node_modules at run time).
COPY --from=build /src/connectors/openai-proxy/dist/main.js ./main.js
USER node
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:${PORT}/health >/dev/null || exit 1
CMD ["node", "main.js"]
