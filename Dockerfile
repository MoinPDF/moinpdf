# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build:selfhost

FROM caddy:2.10.2-alpine
RUN mkdir -p /data /config /srv && chown -R 10001:10001 /data /config /srv
COPY --from=build /app/dist/selfhost /srv
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --chmod=755 docker/start-web.sh /usr/local/bin/start-web
USER 10001:10001
EXPOSE 8080 8443
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1:8081/health || exit 1
ENTRYPOINT ["/usr/local/bin/start-web"]
