# Category Rules

Every ingested source lands in a subdirectory under `~/.daemion/knowledge/raw/`. The category drives how the `knowledge-wiki` compile pass treats the source and which wiki pages it contributes to.

## The directories

```
~/.daemion/knowledge/raw/
├── links/                        # Web articles, blog posts, papers, docs
├── videos/                       # YouTube, podcasts, video talks
├── files/                        # Local documents (PDF, DOCX, slides, images)
└── sessions/
    ├── claude-code/              # Claude Code session transcripts
    ├── daemion/                  # Daemion app thread summaries
    └── pi/                       # Pi session extracts
```

## Auto-detection rules

The `ingest.ts` script picks the category based on the source type:

| Source type | Auto category |
|---|---|
| URL containing `youtube.com` or `youtu.be` | `videos` |
| Path exists on disk (or `file://` prefix) | `files` |
| Any other URL | `links` |

The `sessions/*` subdirectories are **not** used by the regular `ingest.ts` entry point. They're written by session-end hooks and similar automation.

## When to override with `--category`

Use `--category <name>` when auto-detection picks the wrong bucket. Common cases:

| Situation | Override |
|---|---|
| URL to a video hosted outside YouTube (Vimeo, a company talk page) | `--category videos` |
| Local file that's actually a conversation transcript | `--category sessions/daemion` |
| A URL that points to a PDF hosted online | `--category files` (the content will feel more document-like downstream) |
| A GitHub README you want treated as a doc, not a generic link | `--category links` (default is fine, but be explicit) |

## Per-category compile treatment

The compile pass uses category as a hint for what kind of wiki page to produce:

- `links/` → produces concept pages, definition pages, and synthesis pages in `topics/`
- `videos/` → treated as longer-form with chapters; often generates multiple topic pages per video
- `files/` → tends to produce project-specific pages if the file is about a specific system, otherwise topics
- `sessions/*` → produces primarily `projects/<name>/decisions/` entries, keyed on decisions and rationale

This mapping isn't rigid — the compile pass has full license to put content wherever scope rules allow. Category is a suggestion, not a constraint.

## Naming within a category

The `ingest.ts` script uses this pattern:

```
raw/<category>/<YYYY-MM-DD>-<slug>.md
```

Where `slug` is derived from the source title:
- Lowercase
- Non-alphanumeric → hyphens
- Collapsed runs of hyphens
- Truncated to 60 characters

Examples:
- `raw/links/2026-04-08-the-end-of-coding.md`
- `raw/videos/2026-04-08-karpathy-on-llm-wikis.md`
- `raw/files/2026-04-08-attention-is-all-you-need.md`

## Subdirectory creation

The script creates subdirectories on demand with `mkdirSync({ recursive: true })`. You never need to pre-create them. Session subdirectories (`sessions/claude-code/` etc.) are also created on first use.

## When none of this fits

If your content genuinely doesn't fit any category, create a new top-level directory under `raw/` and use `--category <new-dir>`. The compile pass will pick it up as long as it's under `raw/`. But before doing this: re-read this doc and ask whether the content really needs its own bucket, or whether one of the existing categories works.
