# Raw Source Frontmatter Schema

Every file written to `~/.daemion/knowledge/raw/` must have YAML frontmatter matching this schema. The `knowledge-wiki` compile pass relies on these fields to enforce scope, provenance, and idempotency.

## Required fields

| Field | Type | Description |
|---|---|---|
| `source` | enum: `url`, `video`, `file`, `manual`, `claude-code`, `daemion`, `pi` | What kind of source this came from. Drives the subdirectory under `raw/`. |
| `ref` | string | The canonical reference. URL for web/video, absolute path for file, session ID for transcripts. Must be stable — used for dedup alongside `source_hash`. |
| `captured` | ISO-8601 datetime | When this source was ingested. Used by wiki lint for staleness detection. |
| `source_hash` | 8-char hex | First 8 chars of SHA-256 over the content. Used for idempotency — re-ingesting the same content is skipped. |
| `confidence` | enum: `high`, `medium`, `low` | How trustworthy the source is. Affects provenance markers downstream. Default: `medium`. |

## Optional fields

| Field | Type | Description |
|---|---|---|
| `title` | string | Display title. Defaults to filename if absent. |
| `channel` | string | For videos: channel or uploader name |
| `uploader` | string | For videos: uploader handle |
| `upload_date` | string | For videos: YYYYMMDD as returned by yt-dlp |
| `duration` | string | For videos: duration in seconds or HH:MM:SS |
| `extension` | string | For files: file extension (pdf, docx, etc.) |
| `extraction` | string | Free-form note on how extraction was done (e.g. `liteparse`, `lightpanda`, `pdftotext-fallback`) |
| `chapters` | JSON array | For videos: chapter list from yt-dlp metadata |
| `video_id` | string | For videos: YouTube video ID |

## Example — YouTube video

```yaml
---
source: video
ref: https://youtube.com/watch?v=abc123
title: "Karpathy on the end of coding"
captured: 2026-04-08T17:30:00Z
source_hash: a1b2c3d4
confidence: high
channel: "Andrej Karpathy"
uploader: karpathy
upload_date: "20260401"
duration: "01:23:45"
video_id: abc123
extraction: yt-dlp auto-subs
---
```

## Example — Web article

```yaml
---
source: url
ref: https://example.com/article
title: "An Article Title"
captured: 2026-04-08T17:30:00Z
source_hash: e5f6a7b8
confidence: medium
extraction: lightpanda
---
```

## Example — Local PDF

```yaml
---
source: file
ref: /Users/jordan/Downloads/paper.pdf
title: paper.pdf
captured: 2026-04-08T17:30:00Z
source_hash: 9c0d1e2f
confidence: high
extension: pdf
extraction: liteparse
---
```

## Parsing notes

- Frontmatter is standard YAML 1.2 between `---` delimiters at the top of the file
- String values with special characters (quotes, colons) MUST be JSON-quoted
- Booleans: `true` / `false`, not `yes` / `no`
- Date values are strings — don't rely on YAML date coercion (breaks in Node.js parsers)
- Empty values: omit the field, don't use `null` or empty string

## What compile reads

The `knowledge-wiki` compile pass uses:
- `source_hash` → check against `.manifest.json` for uncompiled sources
- `confidence` → weight claims during extraction
- `captured` → fold into the output page's `provenance` block
- `ref` → emit as citation in the compiled page
- `title` → becomes the source header in the compile context
