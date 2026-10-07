#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
#
# Copies the client library's sources into a host repository that cannot install the package yet (Recordare is not
# published): sync-to.sh <target dir>, e.g. ../personalAgent/backend/src/recordare/client. Each file gets a header with
# the source commit; the host never edits them — change the library here and sync again.
set -euo pipefail
cd "$(dirname "$0")/.."
target="${1:?usage: sync-to.sh <target dir>}"
commit="$(git rev-parse --short HEAD)$(git diff --quiet -- src || echo '+dirty')"
mkdir -p "$target"
rm -f "$target"/*.ts
for f in src/*.ts; do
  {
    echo "// GENERATED from recordare packages/client/${f} @ ${commit} — do not edit here: change the library and run"
    echo "// packages/client/scripts/sync-to.sh again."
    cat "$f"
  } > "$target/$(basename "$f")"
done
echo "synced $(ls src/*.ts | wc -l | tr -d ' ') files from recordare@${commit} to ${target}"
