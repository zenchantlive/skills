#!/usr/bin/env bash
# Daemion knowledge-wiki SessionStart hook for Claude Code.
#
# Injects a small context block at session start that summarizes recent
# wiki pages relevant to the current working directory. Gives the assistant
# a starting point before it even runs knowledge_search.
#
# Written to stdout so Claude Code picks it up as part of <session-restore>.
# Fails silently if the wiki doesn't exist or the gateway is unreachable.
#
# Install: referenced from ~/.claude/settings.json under hooks.SessionStart.

set -e

DAEMION_DIR="${DAEMION_DIR:-$HOME/.daemion}"
WIKI_DIR="$DAEMION_DIR/knowledge/wiki"

# Bail out if the wiki doesn't exist yet.
if [ ! -d "$WIKI_DIR" ]; then
  exit 0
fi

# Derive a project slug from the current working directory's basename.
CWD_BASE="$(basename "${PWD:-.}")"

# Try the gateway first (http://localhost:3001/knowledge/search), fall back
# to grepping the wiki index if the gateway is down.
GATEWAY_URL="${DAEMION_GATEWAY_URL:-http://localhost:3001}"

# Small helper — attempt a curl with a very short timeout.
gateway_query() {
  curl -s -m 2 --fail "$GATEWAY_URL/knowledge/search?q=$(printf '%s' "$1" | sed 's/ /+/g')&limit=5" 2>/dev/null
}

# Probe the gateway.
GATEWAY_ALIVE=0
if curl -s -m 1 --fail "$GATEWAY_URL/health" >/dev/null 2>&1; then
  GATEWAY_ALIVE=1
fi

if [ "$GATEWAY_ALIVE" = "1" ]; then
  # Gateway is up — query for project-specific pages.
  RESULTS="$(gateway_query "$CWD_BASE" | python3 -c '
import json, sys
try:
    data = json.loads(sys.stdin.read())
    results = data.get("results", [])
    if not results:
        sys.exit(0)
    lines = []
    for r in results[:5]:
        slug = r.get("slug", "")
        title = r.get("title", "")
        summary = r.get("summary", "")
        lines.append(f"- [[{slug}]] {title}: {summary}"[:200])
    print("\n".join(lines))
except Exception:
    pass
' 2>/dev/null)"

  if [ -n "$RESULTS" ]; then
    echo ""
    echo "# [daemion-wiki] Relevant pages for $CWD_BASE"
    echo ""
    echo "$RESULTS"
    echo ""
    echo "(Use knowledge_search or knowledge_read via the gateway for more.)"
  fi
else
  # Gateway is down — grep the wiki index file directly.
  INDEX_FILE="$WIKI_DIR/index.md"
  if [ -f "$INDEX_FILE" ]; then
    MATCHES="$(grep -i -E "(\[\[$CWD_BASE|$CWD_BASE\])" "$INDEX_FILE" 2>/dev/null | head -5)"
    if [ -n "$MATCHES" ]; then
      echo ""
      echo "# [daemion-wiki] Pages matching $CWD_BASE (gateway offline — raw index grep)"
      echo ""
      echo "$MATCHES"
      echo ""
    fi
  fi
fi

exit 0
