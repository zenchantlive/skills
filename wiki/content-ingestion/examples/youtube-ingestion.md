# Example: YouTube Video Ingestion

Walkthrough of ingesting a YouTube video from start to wiki page.

## The scenario

Jordan says: *"ingest this video — Karpathy's talk on LLM wikis: https://youtu.be/zVEb19AwkqM"*

## Step 1 — Detect and extract

The agent runs:

```bash
npx tsx ~/.daemion/skills/content-ingestion/scripts/ingest.ts "https://youtu.be/zVEb19AwkqM"
```

Under the hood:
1. `detectSourceType()` sees `youtu.be` → type = `video`
2. `detectCategory()` → `videos`
3. `runExtractor('extract-youtube.sh', url)` is invoked
4. `yt-dlp -J` fetches metadata as JSON
5. `yt-dlp --write-auto-subs --sub-langs "en.*,en"` downloads subtitles
6. VTT cues stripped to plain transcript
7. JSON is returned: `{ title, url, content, metadata, source: "video" }`

## Step 2 — Hash and dedup check

```
content = (title + metadata header + description + transcript)
source_hash = sha256(content).slice(0, 8)  # e.g. "a1b2c3d4"
```

`alreadyIngested("a1b2c3d4")` walks `~/.daemion/knowledge/raw/` looking for an existing file with this hash. If found, returns `skipped`. If not, proceed.

## Step 3 — Frontmatter and write

```yaml
---
source: video
ref: https://youtu.be/zVEb19AwkqM
title: "Karpathy on LLM Wikis — End of Coding"
captured: 2026-04-08T17:45:00Z
source_hash: a1b2c3d4
confidence: medium
channel: "Andrej Karpathy"
uploader: karpathy
upload_date: "20260401"
duration: "01:23:45"
video_id: zVEb19AwkqM
extraction: auto-subs from yt-dlp
chapters: [{"title":"Intro","start_time":0},{"title":"The Loop","start_time":180}]
---
```

File is written to:
```
~/.daemion/knowledge/raw/videos/2026-04-08-karpathy-on-llm-wikis-end-of-coding.md
```

## Step 4 — Output

The script prints JSON summary to stdout:

```json
{
  "total": 1,
  "written": 1,
  "skipped": 0,
  "failed": 0,
  "results": [
    {
      "source": "https://youtu.be/zVEb19AwkqM",
      "status": "written",
      "path": "/Users/jordan/.daemion/knowledge/raw/videos/2026-04-08-karpathy-on-llm-wikis-end-of-coding.md"
    }
  ]
}
```

## Step 5 — Hand off to compile

The agent does NOT compile from this skill. It tells the user:

> Ingested. Wiki compile is the next step when you're ready to pull this into the wiki:
>
> ```bash
> npx tsx ~/.daemion/skills/knowledge-wiki/scripts/compile.ts
> ```

Or the agent runs compile automatically as part of a larger task, but explicitly through the knowledge-wiki skill.

## What can go wrong

| Failure | What happens |
|---|---|
| `yt-dlp` not installed | Script exits 127 with install instruction |
| Video is private/DRM | `yt-dlp` fails, extraction reports error, batch continues |
| No English subtitles | Falls back to description as content, adds note to metadata |
| Same video already ingested | Skipped with reference to existing file |

## If Jordan wants to discuss the video instead

Do NOT use this skill for that. Read the URL directly into context and answer questions. Ingestion is for **retention**, not **discussion**.
