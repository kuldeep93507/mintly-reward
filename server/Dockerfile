# Build from the repo root:  docker build -f server/Dockerfile -t ludo-mintly-server .
FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY engine/package.json engine/
COPY server/package.json server/
COPY app/package.json app/
COPY admin/package.json admin/
RUN npm ci --workspace server --workspace engine --workspace admin --include-workspace-root --ignore-scripts
COPY engine engine
COPY server server
COPY admin admin
# Builds the Ludo Admin web app (served at /admin/) and the server bundle.
RUN npm run build -w server

FROM node:22-slim
ENV NODE_ENV=production DATA_DIR=/data PORT=3000 HOST=0.0.0.0
WORKDIR /repo
COPY package.json package-lock.json ./
COPY engine/package.json engine/
COPY server/package.json server/
COPY app/package.json app/
COPY admin/package.json admin/
RUN npm ci --workspace server --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /repo/server/dist server/dist
COPY --from=build /repo/admin/dist admin/dist
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 3000
WORKDIR /repo/server
# Hosted disks (e.g. Render) are mounted over /data at runtime and may be owned by root:
# fix the owner, then drop to the unprivileged node user.
CMD ["sh", "-c", "chown -R node:node /data 2>/dev/null; exec setpriv --reuid=node --regid=node --init-groups node --disable-warning=ExperimentalWarning dist/index.js"]
