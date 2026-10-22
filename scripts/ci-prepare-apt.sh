#!/usr/bin/env bash
set -euo pipefail

# Only configure the disposable GitHub-hosted Linux runner.
if [[ "${GITHUB_ACTIONS:-}" != true || "${RUNNER_OS:-}" != Linux ]]; then
  echo 'This setup is only intended for GitHub Actions Linux runners.' >&2
  exit 1
fi

# The Azure mirror stalled individual browser dependencies for over 15 minutes.
# Prefer the official HTTPS archives already present in the runner's mirror list.
if [[ -f /etc/apt/apt-mirrors.txt ]]; then
  sudo tee /etc/apt/apt-mirrors.txt > /dev/null <<'MIRRORS'
https://archive.ubuntu.com/ubuntu/	priority:1
https://security.ubuntu.com/ubuntu/	priority:2
MIRRORS
fi

sudo tee /etc/apt/apt.conf.d/99-moinpdf-ci-network > /dev/null <<'CONFIG'
Acquire::http::Timeout "20";
Acquire::https::Timeout "20";
Acquire::Retries "1";
CONFIG
