#!/usr/bin/env bash
# extract-url.sh — Extract a web URL to JSON { title, url, content, metadata, source }
#
# Strategy: prefer lightpanda (clean markdown), fall back to curl + HTML strip via perl.
# Output is always JSON on stdout. Errors go to stderr and exit non-zero.

set -e

URL="$1"

if [ -z "$URL" ]; then
  echo "Usage: extract-url.sh <URL>" >&2
  exit 1
fi

# --- Try lightpanda first ---
if command -v lightpanda >/dev/null 2>&1; then
  CONTENT=$(lightpanda fetch --dump markdown --strip_mode full "$URL" 2>/dev/null || echo "")
  if [ -n "$CONTENT" ]; then
    # Grab title from the first H1 in the markdown, fall back to <title> via curl
    TITLE=$(echo "$CONTENT" | grep -m 1 -oE '^# .+' | sed 's/^# //' | tr -d '\n' || echo "")
    if [ -z "$TITLE" ]; then
      TITLE=$(curl -sL --max-time 10 "$URL" 2>/dev/null | grep -oE '<title[^>]*>[^<]*</title>' | head -1 | perl -pe 's/<title[^>]*>(.*?)<\/title>/\1/' | tr -d '\n' || echo "")
    fi
    if [ -z "$TITLE" ]; then TITLE="Untitled"; fi

    jq -n \
      --arg title "$TITLE" \
      --arg url "$URL" \
      --arg content "$CONTENT" \
      '{title: $title, url: $url, content: $content, metadata: {extraction: "lightpanda"}, source: "url"}'
    exit 0
  fi
fi

# --- Fallback: curl + perl HTML strip ---
HTML=$(curl -sL --max-time 30 --user-agent "Mozilla/5.0 (compatible; daemion-ingest/1.0)" "$URL" 2>/dev/null || true)

if [ -z "$HTML" ]; then
  echo "curl fetch failed for $URL" >&2
  exit 2
fi

TITLE=$(echo "$HTML" | perl -0777 -ne 'print $1 if /<title[^>]*>(.*?)<\/title>/s' | tr -d '\n')
if [ -z "$TITLE" ]; then TITLE="Untitled"; fi

# Strip scripts, styles, then tags via perl (non-greedy matching works here)
CONTENT=$(echo "$HTML" | perl -0777 -pe '
  s/<script[^>]*>.*?<\/script>//gs;
  s/<style[^>]*>.*?<\/style>//gs;
  s/<!--.*?-->//gs;
  s/<[^>]+>//gs;
  s/&nbsp;/ /g;
  s/&amp;/&/g;
  s/&lt;/</g;
  s/&gt;/>/g;
  s/&quot;/"/g;
  s/&#39;/'"'"'/g;
  s/[\t ]+/ /g;
  s/\n[ \n]+/\n/g;
')

if [ -z "$CONTENT" ] || [ "$(echo "$CONTENT" | wc -c)" -lt 50 ]; then
  echo "No content extracted from $URL (got ${#CONTENT} chars)" >&2
  exit 3
fi

jq -n \
  --arg title "$TITLE" \
  --arg url "$URL" \
  --arg content "$CONTENT" \
  '{title: $title, url: $url, content: $content, metadata: {extraction: "curl-fallback"}, source: "url"}'
