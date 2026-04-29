#!/usr/bin/env bash
# extract-youtube.sh — Extract YouTube transcript + metadata to JSON.
#
# Uses yt-dlp (required). Output:
#   { title, url, content, metadata: {channel, uploader, upload_date, duration, description, chapters}, source }
#
# Transcripts: prefers auto-generated subtitles in English, falls back to any available language.

set -e

URL="$1"

if [ -z "$URL" ]; then
  echo "Usage: extract-youtube.sh <youtube-url>" >&2
  exit 1
fi

if ! command -v yt-dlp >/dev/null 2>&1; then
  echo "ERROR: yt-dlp not installed. Install with: brew install yt-dlp" >&2
  exit 127
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# --- Get metadata as JSON ---
META_JSON=$(yt-dlp -J --no-playlist "$URL" 2>/dev/null) || {
  echo "yt-dlp metadata fetch failed for $URL" >&2
  exit 2
}

TITLE=$(echo "$META_JSON" | jq -r '.title // "Untitled"')
CHANNEL=$(echo "$META_JSON" | jq -r '.channel // .uploader // ""')
UPLOADER=$(echo "$META_JSON" | jq -r '.uploader // ""')
UPLOAD_DATE=$(echo "$META_JSON" | jq -r '.upload_date // ""')
DURATION=$(echo "$META_JSON" | jq -r '.duration_string // .duration // ""')
DESCRIPTION=$(echo "$META_JSON" | jq -r '.description // ""')
CHAPTERS=$(echo "$META_JSON" | jq -c '.chapters // []')
VIDEO_ID=$(echo "$META_JSON" | jq -r '.id // ""')

# --- Download transcript ---
yt-dlp \
  --skip-download \
  --write-auto-subs \
  --write-subs \
  --sub-langs "en.*,en" \
  --sub-format "vtt" \
  --output "$TMPDIR/%(id)s.%(ext)s" \
  "$URL" >/dev/null 2>&1 || true

# Find any .vtt file that landed
VTT_FILE=$(find "$TMPDIR" -name "*.vtt" -print -quit 2>/dev/null || true)

if [ -z "$VTT_FILE" ]; then
  # No subtitles — use the description as content fallback
  TRANSCRIPT="$DESCRIPTION"
  EXTRACTION_NOTE="no transcript available — description used as content"
else
  # Strip VTT cues (timestamps, blank lines, WEBVTT header) to plain text
  TRANSCRIPT=$(grep -v -E '^(WEBVTT|NOTE|\s*$|\d{2}:\d{2}:\d{2}|STYLE|REGION|::cue)' "$VTT_FILE" \
    | sed -E 's/<[^>]*>//g' \
    | sed -E 's/^[[:space:]]+//' \
    | awk '!seen[$0]++' \
    | tr '\n' ' ' \
    | sed -E 's/[[:space:]]+/ /g')
  EXTRACTION_NOTE="auto-subs from yt-dlp"
fi

if [ -z "$TRANSCRIPT" ]; then
  echo "No content extracted from $URL" >&2
  exit 3
fi

# Build the content: title + metadata header + transcript
CONTENT="# $TITLE

**Channel:** $CHANNEL
**Uploaded:** $UPLOAD_DATE
**Duration:** $DURATION
**URL:** $URL

## Description

$DESCRIPTION

## Transcript

$TRANSCRIPT"

# --- Emit JSON ---
jq -n \
  --arg title "$TITLE" \
  --arg url "$URL" \
  --arg content "$CONTENT" \
  --arg channel "$CHANNEL" \
  --arg uploader "$UPLOADER" \
  --arg upload_date "$UPLOAD_DATE" \
  --arg duration "$DURATION" \
  --arg video_id "$VIDEO_ID" \
  --arg extraction "$EXTRACTION_NOTE" \
  --argjson chapters "$CHAPTERS" \
  '{
    title: $title,
    url: $url,
    content: $content,
    metadata: {
      channel: $channel,
      uploader: $uploader,
      upload_date: $upload_date,
      duration: $duration,
      video_id: $video_id,
      extraction: $extraction,
      chapters: $chapters
    },
    source: "video"
  }'
