# Example: Local PDF Ingestion

Walkthrough of ingesting a PDF stored on disk.

## The scenario

Jordan drops a PDF into `~/Downloads/` and says: *"add this paper to the wiki"*

## Step 1 — Identify the file

```bash
ls -la ~/Downloads/*.pdf
# /Users/jordan/Downloads/attention-is-all-you-need.pdf
```

## Step 2 — Run ingestion with high confidence

Research papers are primary sources — use `--confidence high`:

```bash
npx tsx ~/.daemion/skills/content-ingestion/scripts/ingest.ts \
  --confidence high \
  ~/Downloads/attention-is-all-you-need.pdf
```

Under the hood:
1. `detectSourceType()` sees the file exists → type = `file`
2. `detectCategory()` → `files`
3. `runExtractor('extract-file.sh', path)` is invoked
4. Path is normalized: `~` → absolute, `realpath` resolves symlinks
5. `liteparse parse --format text --quiet <path>` extracts text
6. If liteparse fails or is missing, falls back to `pdftotext -layout` (if installed)
7. JSON is returned: `{ title, url, content, metadata: { extension, extraction }, source: "file" }`

## Step 3 — Hash and write

```yaml
---
source: file
ref: /Users/jordan/Downloads/attention-is-all-you-need.pdf
title: attention-is-all-you-need.pdf
captured: 2026-04-08T17:55:00Z
source_hash: f0e1d2c3
confidence: high
extension: pdf
extraction: liteparse
---

Provided proper attribution is provided, Google hereby grants permission
to reproduce the tables and figures in this paper solely for use in
journalistic or scholarly works.

Attention Is All You Need
...
```

File lands at:
```
~/.daemion/knowledge/raw/files/2026-04-08-attention-is-all-you-need-pdf.md
```

## Step 4 — Note on `ref`

For local files, `ref` is the **absolute path on disk**. This is intentional:
- If the file is deleted, the wiki still has the content (raw dump)
- If the file is moved, ingestion sees a new "source" (different `ref`, same `source_hash` → still skipped)
- If the file is updated in place, the hash changes → a new raw file is written
- Absolute path makes the source unambiguous across sessions

**Side effect:** if you move your home directory or rename your user, the `ref` values become stale. That's fine — the content is still intact, only the pointer is wrong. Fix via search-and-replace if needed.

## Step 5 — Compile handoff

```bash
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/compile.ts
```

The compile pass notices the new PDF in `raw/files/`, reads it, extracts claims with `^[inferred]` markers where the LLM synthesizes, and writes wiki pages in `topics/` or `projects/` as appropriate.

## What can go wrong

| Failure | What happens | Recovery |
|---|---|---|
| PDF is scanned (image-only) | `liteparse` returns empty → script exits 3 | Needs OCR — not handled. Run `tesseract` externally, save as `.txt`, re-ingest |
| PDF is password-protected | `liteparse` errors out | Remove password externally, re-ingest |
| `liteparse` not installed | Falls back to `pdftotext` (if installed) | Install via `npm install -g liteparse` |
| Neither `liteparse` nor `pdftotext` | Exits with an install hint | Install one of them |
| File path contains spaces | Handled by bash quoting | Make sure the path is quoted in the command |
| Relative path | `realpath` normalizes it | No action needed |

## Other file types

The same flow handles:
- **DOCX, DOC** → `liteparse` extracts, preserving text flow
- **XLSX, XLS** → `liteparse` flattens sheets to text
- **PPTX, PPT** → `liteparse` extracts slide text
- **Images (PNG, JPG)** → `liteparse` does OCR if configured
- **Plain text (`.txt`, `.md`, `.markdown`, `.rst`, `.log`)** → script just reads the file directly, no extractor needed

For anything `liteparse` doesn't handle: convert to PDF or markdown first, then ingest.

## When NOT to ingest a local file

- You just want to read it — use `cat` or open it in a viewer
- It's a database or binary you don't want as text — will produce garbage
- It's from the project you're currently working in — git history is authoritative, don't duplicate
- It's a short note — add it directly to the relevant wiki page instead of ingesting
