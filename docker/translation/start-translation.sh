#!/bin/sh
set -eu
# platform must finish starting the app while the separate downloader prepares
# models. This service stays on the private, internal network throughout.
marker="${HOME}/.local/share/moinpdf/ready-models.json"
if [ ! -s "$marker" ]; then
    echo 'Warte auf die erstmalige Einrichtung der Übersetzungsmodelle.'
fi
while [ ! -s "$marker" ]; do
    sleep 5
done
exec ./scripts/entrypoint.sh "$@"
