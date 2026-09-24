# Build from the repo root:  docker build -f server/Dockerfile -t ludo-mintly-server .
FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY engine/package.json engine/
COPY server/package.json server/
COPY app/package.json app/
RUN npm ci --workspace server --workspace engine --include-workspace-root --ignore-scripts
COPY engine engine
COPY server server
RUN npm run build -w server

FROM node:22-slim
ENV NODE_ENV=production DATA_DIR=/data PORT=3000 HOST=0.0.0.0
WORKDIR /repo
COPY package.json package-lock.json ./
COPY engine/package.json engine/
COPY server/package.json server/
COPY app/package.json app/
RUN npm ci --workspace server --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /repo/server/dist server/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
WORKDIR /repo/server
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/index.js"]
