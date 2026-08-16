#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${DSH_HOME:=${HOME}/.dsh}"
# Prefer explicit DSH data home used in this environment
if [[ -d /home/node/.dsh ]]; then
  : "${DSH_HOME:=/home/node/.dsh}"
fi
DEST="${DSH_HOME}/local-plugins/dsh-git-forge"
mkdir -p "$DEST/lib/shared" "$DEST/scripts"
cp -a "$ROOT/package.json" "$ROOT/cordis.patch.yml" "$ROOT/LICENSE" \
  "$ROOT/README.md" "$ROOT/README.zh-CN.md" \
  "$ROOT/CHANGELOG.md" "$ROOT/CHANGELOG.zh-CN.md" \
  "$DEST/" 2>/dev/null || {
  cp -a "$ROOT/package.json" "$ROOT/cordis.patch.yml" "$ROOT/LICENSE" "$DEST/"
  [[ -f "$ROOT/README.md" ]] && cp -a "$ROOT/README.md" "$DEST/"
  [[ -f "$ROOT/README.zh-CN.md" ]] && cp -a "$ROOT/README.zh-CN.md" "$DEST/"
  [[ -f "$ROOT/CHANGELOG.md" ]] && cp -a "$ROOT/CHANGELOG.md" "$DEST/"
  [[ -f "$ROOT/CHANGELOG.zh-CN.md" ]] && cp -a "$ROOT/CHANGELOG.zh-CN.md" "$DEST/"
}
cp -a "$ROOT/lib/." "$DEST/lib/"
cp -a "$ROOT/scripts/." "$DEST/scripts/"
chmod +x "$DEST/scripts/"*.sh "$DEST/scripts/"*.mjs 2>/dev/null || true
echo "synced -> $DEST"
node --check "$DEST/lib/index.js"
node "$DEST/scripts/smoke-test.mjs"
