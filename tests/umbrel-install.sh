#!/usr/bin/env bash
set -euo pipefail
test_container=moinpdf-umbrel-test

ready=false
for attempt in $(seq 1 120); do
    if docker exec "$test_container" umbreld client user.exists.query >/dev/null 2>&1; then
        ready=true
        break
    fi
    sleep 5
done
test "$ready" = true
docker exec "$test_container" umbreld client user.register.mutate \
    --name MoinPDF-CI --password synthetic-umbrel-ci-password >/dev/null

# The registry packages may still be private before their initial public
# release. Authenticate only this disposable daemon; never include credentials
# in the app package, its data directories, logs, or test evidence.
printf '%s' "$GHCR_TOKEN" | docker exec -i "$test_container" \
    docker login ghcr.io --username "$GHCR_USER" --password-stdin >/dev/null
unset GHCR_TOKEN

store_dir=""
for attempt in $(seq 1 60); do
    store_dir="$(docker exec "$test_container" sh -c 'find /data/app-stores -maxdepth 1 -type d -name "getumbrel-umbrel-apps-*" -print -quit' 2>/dev/null || true)"
    if [ -n "$store_dir" ]; then break; fi
    sleep 5
done
test -n "$store_dir"
docker cp deploy/umbrel/denny-moinpdf "$test_container:$store_dir/denny-moinpdf"
docker exec "$test_container" find "$store_dir/denny-moinpdf" -name .gitkeep -delete
docker exec "$test_container" chown -R 1000:1000 "$store_dir/denny-moinpdf"
docker exec "$test_container" umbreld client appStore.registry.query > /tmp/umbrel-ci-registry.json
python - <<'PY'
from pathlib import Path
assert 'denny-moinpdf' in Path('/tmp/umbrel-ci-registry.json').read_text()
PY
docker exec "$test_container" umbreld client apps.install.mutate --appId denny-moinpdf >/dev/null

for attempt in $(seq 1 240); do
    docker exec "$test_container" umbreld client apps.state.query --appId denny-moinpdf > /tmp/umbrel-ci-state.json
    if python -c 'import json; assert json.load(open("/tmp/umbrel-ci-state.json"))["state"] == "ready"' 2>/dev/null; then
        echo 'Umbrel reports MoinPDF ready; browser and document workflows are checked next.'
        exit 0
    fi
    sleep 5
done
echo 'Umbrel did not finish installing MoinPDF within 20 minutes.' >&2
exit 1
