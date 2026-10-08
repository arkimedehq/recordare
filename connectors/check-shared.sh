#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Andrea Genovese
#
# The hook script is shared by the Claude Code and the Codex connectors; each plugin directory keeps its own copy so
# that it stays self-contained. This check fails when the copies differ (run in CI; edit one, copy it to the other).
set -e
cd "$(dirname "$0")"
cmp claude-code/scripts/recordare-hook.mjs codex/scripts/recordare-hook.mjs
node --check codex/scripts/recordare-hook.mjs
echo "connectors: shared hook script identical"
