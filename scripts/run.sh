#!/usr/bin/env bash
# Runs a command inside the Creator Studio dev container, or directly when we're
# already inside it (or in CI). Used by git hooks so the host machine never
# needs Node, pnpm or Rust installed.
set -euo pipefail

if [ -f /.dockerenv ] || [ -n "${CI:-}" ] || [ -n "${CREATOR_STUDIO_NATIVE:-}" ]; then
  exec "$@"
fi

repo_root="$(git rev-parse --show-toplevel)"
exec docker compose -f "$repo_root/compose.yaml" run --rm --no-deps -T dev "$@"
