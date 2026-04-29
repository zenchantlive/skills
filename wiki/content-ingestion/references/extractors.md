# Extractor Comparison

The ingestion pipeline chooses one of three extractor scripts based on source type. This doc compares them and explains fallbacks.

## extract-url.sh — web pages

**Primary tool: `lightpanda`**
- Installed at `~/.local/bin/lightpanda`
- Produces clean markdown from HTML
- Handles JavaScript-rendered pages (real browser under the hood)
- Best extraction quality for modern sites
- Best for: SPAs, dynamic content, anything with meaningful JS

**Fallback: `curl` + crude HTML strip**
- Only runs if lightpanda fails or is uninstalled
- `curl -sL` with a Mozilla user-agent to dodge anti-bot heuristics
- Strips `<script>`, `<style>`, and all tags via sed
- Expands common HTML entities (`&nbsp;`, `&amp;`, etc.)
- Quality is **noticeably worse** — expect whitespace issues and missing content

**When each is chosen:**
- Default → try lightpanda first
- Lightpanda errors or returns empty → fall back to curl

**Failure signs in output:**
- Content is mostly navigation labels → extraction got the chrome, not the article — lightpanda probably needs to wait longer for JS, but fallback doesn't know how
- Content is literally empty → 404, paywall, or aggressive anti-scraping
- Content is huge (>100 KB) → got a full SPA dump instead of one article; try a different URL

## extract-youtube.sh — YouTube videos

**Primary tool: `yt-dlp`** (required — no fallback)
- Installed via `brew install yt-dlp`
- Fetches metadata as JSON (title, channel, duration, chapters, description)
- Downloads auto-generated subtitles in `en.*` → `.vtt` files
- Strips VTT cues to plain transcript text
- Exits non-zero if `yt-dlp` is not installed

**Subtitle preference order:**
1. Manual subtitles in English (if available)
2. Auto-generated subtitles in English
3. Any other language (degraded — content field contains non-English transcript)
4. No subtitles → description used as content with a note

**Output shape:**
```
# <Title>
**Channel:** ...
**Uploaded:** ...
**Duration:** ...
**URL:** ...

## Description
...

## Transcript
...
```

**Metadata fields captured:** title, channel, uploader, upload_date, duration, video_id, chapters, extraction note

**Common failures:**
- Private or unlisted video → yt-dlp returns error
- Age-gated video → yt-dlp may need cookies (not configured here)
- DRM-protected (VEVO music, paid content) → fails cleanly
- Live stream → transcript may be missing or partial
- Video in non-English language with no auto-subs → transcript will be in source language

## extract-file.sh — local documents

**Primary tool: `liteparse`**
- Installed at `~/.nvm/.../bin/liteparse` (global npm install)
- Supports PDF, DOCX, XLSX, PPTX, images, and more
- Uniform `--format text --quiet` interface
- Best for: any local document that isn't plain text or markdown

**Fallback 1: `pdftotext`** (PDF only)
- Comes from poppler-utils: `brew install poppler`
- NOT currently installed on this system — add only if you need it
- `-layout` mode preserves column structure

**Fallback 2: plain read** (for `.txt`, `.md`, `.markdown`, `.rst`, `.log`)
- Just `cat` the file
- Always works, even with zero dependencies

**Failure modes:**
- `.docx`/`.xlsx`/`.pptx` without liteparse → fails with an install instruction
- Scanned PDF (images only, no text layer) → liteparse returns empty; needs OCR (not handled)
- Password-protected PDF → liteparse errors out
- Corrupted file → both primary and fallback fail

## Quality ranking

From best to worst extraction quality on typical content:

1. **yt-dlp auto-subs** (YouTube transcripts are decent, chapters help)
2. **lightpanda** (clean web pages)
3. **liteparse** (structured documents — depends on source quality)
4. **plain text / markdown** (trivially perfect for text files)
5. **pdftotext with -layout** (loses structure but preserves words)
6. **curl + HTML strip** (lossy, crude — last resort)

## Debugging extraction

To test an extractor directly without going through `ingest.ts`:

```bash
# Web
~/.daemion/skills/content-ingestion/scripts/extract-url.sh "https://example.com" | jq .

# YouTube
~/.daemion/skills/content-ingestion/scripts/extract-youtube.sh "https://youtu.be/abc123" | jq .

# Local file
~/.daemion/skills/content-ingestion/scripts/extract-file.sh "~/Downloads/paper.pdf" | jq .
```

All scripts output JSON on stdout. `jq .` pretty-prints it. Use `jq .content` to see just the extracted text.
