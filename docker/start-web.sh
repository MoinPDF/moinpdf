#!/bin/sh
set -eu
export MOINPDF_API_KEY="$(cat /run/moinpdf/api-key)"
test "${#MOINPDF_API_KEY}" -ge 32
umask 077
: > /tmp/access.caddy
if [ -n "${MOINPDF_PASSWORD:-}" ]; then
    export MOINPDF_USERNAME="${MOINPDF_USERNAME:-moinpdf}"
    case "$MOINPDF_USERNAME" in
        *[!a-zA-Z0-9_-]*) echo 'MOINPDF_USERNAME darf nur Buchstaben, Zahlen, _ und - enthalten.' >&2; exit 1 ;;
    esac
    export MOINPDF_PASSWORD_HASH="$(caddy hash-password --plaintext "$MOINPDF_PASSWORD")"
    printf 'basic_auth {\n  {$MOINPDF_USERNAME} {$MOINPDF_PASSWORD_HASH}\n}\n' > /tmp/access.caddy
fi
unset MOINPDF_PASSWORD
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
