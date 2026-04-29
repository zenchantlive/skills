#!/usr/bin/env bash
# Daemion knowledge-wiki Stop/PreCompact hook for Claude Code.
#
# After Jordan's existing afterimage-save.sh writes `.claude/state/afterimage.md`
# at session end, this hook copies the afterimage into
# `~/.daemion/knowledge/raw/sessions/claude-code/` so it becomes a compilable
# source for the Daemion knowledge wiki.
#
# This is the automated capture half of the memory loop:
#   - User/agent writes afterimage.md → local state
#   - This hook mirrors it into raw/ → available to wiki compile later
#
# Safe to run as a no-op if afterimage.md doesn't exist or is empty.
# Fails silently — never blocks the session from ending.
#
# Install: referenced from ~/.claude/settings.json under hooks.Stop and
# hooks.PreCompact. Run it AFTER afterimage-save.sh in the hook list so the
# afterimage file is already on disk when this reads it.

set -e

DAEMION_DIR="${DAEMION_DIR:-$HOME/.daemion}"
RAW_DIR="$DAEMION_DIR/knowledge/raw/sessions/claude-code"

# Locate the afterimage. Project local first, then home fallback.
AFTERIMAGE=""
if [ -f ".claude/state/afterimage.md" ]; then
  AFTERIMAGE=".claude/state/afterimage.md"
elif [ -f "$HOME/.claude/state/afterimage.md" ]; then
  AFTERIMAGE="$HOME/.claude/state/afterimage.md"
fi

# Nothing to capture — exit clean.
if [ -z "$AFTERIMAGE" ] || [ ! -s "$AFTERIMAGE" ]; then
  exit 0
fi

# Make sure the raw session directory exists.
mkdir -p "$RAW_DIR" 2>/dev/null || exit 0

# Derive a stable slug from the current working directory.
CWD_BASE="$(basename "${PWD:-unknown}" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-' | sed 's/--*/-/g; s/^-//; s/-$//')"
[ -z "$CWD_BASE" ] && CWD_BASE="unknown"

# Use the date + cwd as the filename. Multiple captures on the same day
# from the same project overwrite — that's intentional (the afterimage
# is always the freshest snapshot of that session's state).
DATE="$(date -u +%Y-%m-%d)"
OUT_FILE="$RAW_DIR/${DATE}-${CWD_BASE}.md"

# Compute a simple hash of the afterimage for deduplication / idempotency.
HASH=$(cat "$AFTERIMAGE" | shasum -a 256 | cut -c1-8 2>/dev/null || echo "nohash")

# Build frontmatter + body.
{
  echo "---"
  echo "source: session"
  echo "ref: claude-code-$CWD_BASE-$DATE"
  echo "captured: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "source_hash: $HASH"
  echo "confidence: medium"
  echo "cwd: $PWD"
  echo "session_type: claude-code"
  echo "---"
  echo ""
  cat "$AFTERIMAGE"
} > "$OUT_FILE" 2>/dev/null || exit 0

# Log for human visibility. Never fails the hook.
echo "[daemion-wiki] captured session snapshot to raw/sessions/claude-code/$(basename "$OUT_FILE")" >&2

exit 0
