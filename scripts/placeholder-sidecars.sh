#!/usr/bin/env bash
# Creates empty sidecar files for the host target when the real ones are missing.
# `tauri-build` only checks that they exist, so this is enough for `cargo check`,
# clippy and tests. Real binaries: `pnpm sidecars`.
set -euo pipefail
dir="$(dirname "$0")/../apps/desktop/src-tauri/binaries"
triple="$(rustc -vV | sed -n 's/^host: //p')"
ext=""; [[ "$triple" == *windows* ]] && ext=".exe"
for bin in yt-dlp ffmpeg ffprobe deno; do
  f="$dir/$bin-$triple$ext"
  [ -e "$f" ] || touch "$f"
done
