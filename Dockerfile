# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS build
WORKDIR /app
# Canvas-based verification renders synthetic documents in the build stage.
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core fonts-liberation openssl \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run typecheck:selfhost && pnpm run build:selfhost

FROM caddy:2.11.7-alpine
ARG MOINPDF_UID=10001
# We use unprivileged container ports. Remove the upstream binary's file
# capability so it can execute with cap_drop: ALL and no-new-privileges.
RUN setcap -r /usr/bin/caddy \
    && mkdir -p /data /config /srv && chown -R ${MOINPDF_UID}:${MOINPDF_UID} /data /config /srv
COPY --from=build /app/dist/selfhost /srv
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --chmod=755 docker/start-web.sh /usr/local/bin/start-web
USER ${MOINPDF_UID}:${MOINPDF_UID}
EXPOSE 8080 8443
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1:8081/health || exit 1
ENTRYPOINT ["/usr/local/bin/start-web"]
