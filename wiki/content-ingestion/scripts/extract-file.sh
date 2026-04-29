#!/usr/bin/env bash
# extract-file.sh — Extract a local file (PDF, DOCX, XLSX, PPTX, images, etc.) to JSON.
#
# Uses liteparse (primary, multi-format). Falls back to pdftotext for PDFs if liteparse fails.
# Output: { title, url, content, metadata, source: "file" }

set -e

FILEPATH="$1"

if [ -z "$FILEPATH" ]; then
  echo "Usage: extract-file.sh <path>" >&2
  exit 1
fi

# Normalize: strip file:// prefix, expand ~
FILEPATH="${FILEPATH#file://}"
FILEPATH="${FILEPATH/#\~/$HOME}"
FILEPATH=$(realpath "$FILEPATH" 2>/dev/null || echo "$FILEPATH")

if [ ! -f "$FILEPATH" ]; then
  echo "File does not exist: $FILEPATH" >&2
  exit 2
fi

FILENAME=$(basename "$FILEPATH")
EXT="${FILENAME##*.}"
EXT_LOWER=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')

# --- Primary: liteparse ---
if command -v liteparse >/dev/null 2>&1; then
  CONTENT=$(liteparse parse --format text --quiet "$FILEPATH" 2>/dev/null || echo "")
  EXTRACTION_NOTE="liteparse"
  if [ -n "$CONTENT" ]; then
    jq -n \
      --arg title "$FILENAME" \
      --arg url "$FILEPATH" \
      --arg content "$CONTENT" \
      --arg ext "$EXT_LOWER" \
      --arg extraction "$EXTRACTION_NOTE" \
      '{
        title: $title,
        url: $url,
        content: $content,
        metadata: {
          extension: $ext,
          extraction: $extraction
        },
        source: "file"
      }'
    exit 0
  fi
fi

# --- Fallback: pdftotext for PDFs ---
if [ "$EXT_LOWER" = "pdf" ] && command -v pdftotext >/dev/null 2>&1; then
  CONTENT=$(pdftotext -layout "$FILEPATH" - 2>/dev/null || echo "")
  if [ -n "$CONTENT" ]; then
    jq -n \
      --arg title "$FILENAME" \
      --arg url "$FILEPATH" \
      --arg content "$CONTENT" \
      --arg ext "$EXT_LOWER" \
      '{
        title: $title,
        url: $url,
        content: $content,
        metadata: {
          extension: $ext,
          extraction: "pdftotext-fallback"
        },
        source: "file"
      }'
    exit 0
  fi
fi

# --- Fallback: plain text files ---
if [[ "$EXT_LOWER" =~ ^(txt|md|markdown|rst|log)$ ]]; then
  CONTENT=$(cat "$FILEPATH")
  jq -n \
    --arg title "$FILENAME" \
    --arg url "$FILEPATH" \
    --arg content "$CONTENT" \
    --arg ext "$EXT_LOWER" \
    '{
      title: $title,
      url: $url,
      content: $content,
      metadata: {
        extension: $ext,
        extraction: "plain-text"
      },
      source: "file"
    }'
  exit 0
fi

echo "Could not extract $FILEPATH — install liteparse (npm install -g liteparse) or convert to .txt/.md first" >&2
exit 3
