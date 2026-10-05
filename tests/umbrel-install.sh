#!/usr/bin/env bash
set -euo pipefail
test_container=moinpdf-umbrel-test

# Systemd may give the daemon a different mount view from Docker's exec/archive
# helpers. Keep fixture reads and writes in the daemon's own mount namespace.
umbrel_fs() {
    docker exec -i "$test_container" sh -ec '
        main_pid="$(systemctl show -p MainPID --value umbrel)"
        test "$main_pid" -gt 1
        exec nsenter --mount --target "$main_pid" -- "$@"
    ' sh "$@"
}

ready=false
for attempt in $(seq 1 120); do
    if docker exec "$test_container" umbreld client user.exists.query >/dev/null 2>&1; then
        ready=true
        break
    fi
    sleep 5
done
if [ "$ready" != true ]; then
    echo 'Umbrel did not become ready within 10 minutes.' >&2
    exit 1
fi
docker exec "$test_container" umbreld client user.register.mutate \
    --name MoinPDF-CI --password synthetic-umbrel-ci-password >/dev/null

# Use the data directory from the pinned Umbrel OS systemd service. Pull all
# MoinPDF images anonymously, exactly as an end-user's Umbrel installation does.
store_dir=""
for attempt in $(seq 1 60); do
    store_dir="$(umbrel_fs find /home/umbrel/umbrel/app-stores -maxdepth 1 -type d -name 'getumbrel-umbrel-apps-*' -print -quit 2>/dev/null || true)"
    if [ -n "$store_dir" ]; then break; fi
    sleep 5
done
if [ -z "$store_dir" ]; then
    echo 'The official Umbrel app-store clone was not ready within 5 minutes.' >&2
    exit 1
fi
echo 'Umbrel app store is ready; installing the published package.'
# Extract in the running OS namespace. Docker's archive/cp endpoint cannot
# resolve directories under mounts created by Umbrel's systemd services.
tar -C deploy/umbrel -cf - denny-moinpdf | \
    umbrel_fs tar -xf - -C "$store_dir"
umbrel_fs find "$store_dir/denny-moinpdf" -name .gitkeep -delete
umbrel_fs chown -R 1000:1000 "$store_dir/denny-moinpdf"
umbrel_fs test -s "$store_dir/denny-moinpdf/umbrel-app.yml"
docker exec "$test_container" systemctl restart umbrel
registry_ready=false
for attempt in $(seq 1 60); do
    if docker exec "$test_container" umbreld client appStore.registry.query > /tmp/umbrel-ci-registry.json 2>/dev/null && \
        python -c 'import json; assert any(app["id"] == "denny-moinpdf" for store in json.load(open("/tmp/umbrel-ci-registry.json")) for app in store["apps"])' 2>/dev/null; then
        registry_ready=true
        break
    fi
    sleep 2
done
if [ "$registry_ready" != true ]; then
    echo 'Umbrel did not discover the injected test package.' >&2
    umbrel_fs ls -la "$store_dir/denny-moinpdf" || true
    umbrel_fs cat "$store_dir/denny-moinpdf/umbrel-app.yml" || true
    python - <<'PY'
import json
from pathlib import Path
registry = json.loads(Path('/tmp/umbrel-ci-registry.json').read_text())
print([{ 'store': store['meta'], 'app_count': len(store['apps']),
         'moinpdf': [app for app in store['apps'] if 'moinpdf' in app.get('id', '')] }
       for store in registry])
PY
    exit 1
fi
echo 'MoinPDF is visible in the native Umbrel registry.'
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
