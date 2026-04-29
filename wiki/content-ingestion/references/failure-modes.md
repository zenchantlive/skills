# Failure Modes

Catalog of known failures during content ingestion and what to do about them. Grouped by root cause.

## Network failures

### 404 / page not found
**Symptom:** `extract-url.sh` exits non-zero, `curl` returns empty or error page  
**Handling:** `ingest.ts` logs the failure, moves on to next source in batch  
**Recovery:** Fix the URL and retry. If link is truly dead, skip — or use an archive.org version

### Connection timeout
**Symptom:** `curl --max-time 30` exhausts, extraction fails  
**Handling:** Per-source failure, batch continues  
**Recovery:** Retry once. If it keeps failing, the site is down or blocking — skip or come back later

### Rate limit (429)
**Symptom:** Multiple consecutive extraction failures from the same domain  
**Handling:** `ingest.ts` does not currently back off  
**Recovery:** Split the batch into smaller chunks with delays between runs. Long term: add per-domain rate limiting to `ingest.ts`

## Content failures

### Paywall
**Symptom:** Extraction succeeds but content is the teaser/preview, not the full article  
**Handling:** Ingested with `--confidence low` is the honest move  
**Recovery:** 
- If you have a subscription, use the archive/print view URL
- Otherwise, re-ingest with `--confidence low` and let wiki lint flag downstream claims as thin

### Anti-bot / Cloudflare challenge
**Symptom:** Content field is a Cloudflare captcha page, empty, or JavaScript-only  
**Handling:** Extraction "succeeds" but produces garbage  
**Recovery:** 
- Manual: download via browser, then ingest the saved HTML file
- `lightpanda` sometimes handles this; the `curl` fallback definitely won't

### Scanned PDF / image-only document
**Symptom:** `liteparse` returns empty content for a PDF  
**Handling:** Extraction reports "no content"  
**Recovery:** Needs OCR — not handled by this skill. Options:
- Use `tesseract` externally, save as .txt, then ingest
- Skip unless the content is worth manual effort

### DRM-protected YouTube video
**Symptom:** `yt-dlp` fails with a rights message  
**Handling:** Clean failure, extraction reports the error  
**Recovery:** Cannot ingest. Use manual notes if the content is worth keeping

### Non-English YouTube video without translation
**Symptom:** Transcript comes out in source language (Spanish, Japanese, etc.)  
**Handling:** Ingested as-is  
**Recovery:** Wiki compile may struggle. Options:
- Use `--confidence low` to flag downstream
- Translate the raw file manually before compilation
- Long term: add translation step to extract-youtube.sh

### Live stream / streaming URL
**Symptom:** `yt-dlp` returns partial or no transcript  
**Handling:** Extraction may return empty  
**Recovery:** Wait for the stream to end, then re-ingest from the permanent URL

## Tool failures

### lightpanda not installed
**Symptom:** `extract-url.sh` falls back to `curl`, content quality drops  
**Handling:** Transparent — ingestion succeeds with note `extraction: curl-fallback`  
**Recovery:** Install lightpanda: see lightpanda docs for binary  
**Is it required?** No, but **strongly recommended** for any modern JS-heavy site

### yt-dlp not installed
**Symptom:** `extract-youtube.sh` exits immediately with error 127  
**Handling:** YouTube sources fail  
**Recovery:** `brew install yt-dlp`  
**Is it required?** Yes, for any YouTube ingestion

### liteparse not installed
**Symptom:** `extract-file.sh` falls back to `pdftotext` (PDFs only) or plain cat (.txt/.md only)  
**Handling:** .docx/.xlsx/.pptx fail with an install hint  
**Recovery:** `npm install -g liteparse` (or whatever the current install path is)  
**Is it required?** Yes, for any document ingestion beyond plain text and PDFs

### jq not installed
**Symptom:** All shell extractors fail at the final JSON assembly step  
**Handling:** Scripts exit non-zero  
**Recovery:** `brew install jq`  
**Is it required?** Yes, for all extractors

## Dedup / idempotency failures

### Same content, different URL
**Symptom:** Two URLs with identical content get different `source_hash` values if extraction produces different formatting  
**Handling:** Both files land in raw/ as separate entries  
**Recovery:** Wiki compile pass should merge them. If not, manual cleanup.  
**Design note:** `source_hash` is content-based, not URL-based. If lightpanda produces slightly different output on two runs, you'll get dupes. Currently accepted as a tradeoff.

### Same URL, changed content (legitimate update)
**Symptom:** New hash, new file written even though it's the same article  
**Handling:** Both old and new versions kept in raw/  
**Recovery:** Intentional — let wiki compile decide what to do. An updated article might warrant updating the wiki page or keeping both as point-in-time records.

## Script bugs

### Frontmatter parse errors downstream
**Symptom:** Wiki compile fails to parse a raw file  
**Handling:** Compile skips the file with a warning  
**Root cause usually:** Title contained an unescaped quote or colon in the frontmatter  
**Fix:** `ingest.ts` uses `JSON.stringify()` on the title field specifically to avoid this. If it still happens, check the schema doc for what needs escaping.

### Extractor returns malformed JSON
**Symptom:** `ingest.ts` errors at `JSON.parse`  
**Handling:** Per-source failure, batch continues  
**Root cause usually:** Shell extractor's content included unescaped quotes or newlines  
**Fix:** All extractors use `jq -n --arg ... --arg ...` which handles escaping. If it still happens, rerun the extractor directly with `2>&1 | jq .` to see what it produced.

## Unknown failures

If ingestion fails and nothing in this doc matches:

1. Run the extractor directly: `~/.daemion/skills/content-ingestion/scripts/extract-url.sh "$URL"`
2. Run `ingest.ts --dry-run "$URL"` to isolate whether the problem is extraction or writing
3. Check `~/.daemion/knowledge/raw/` has write permissions
4. Check disk space
5. If none of the above, file a bug note in the wiki under `projects/daemion/bugs/`

## Graceful degradation rules

These failure modes should NEVER crash the whole batch:
- One URL fails → log it, move to next
- One extractor missing → fall back where possible, fail cleanly where not
- Disk write fails → log and continue (don't partially corrupt)
- Duplicate detected → skip with a note, not an error

The rule: **per-source failures stay per-source.** Batch ingestion is valuable precisely because you can throw 50 URLs at it and get 48 landed + 2 reported failures. If a bug ever causes whole-batch failure on a single bad source, that's a regression to fix.

## Platform gotchas (macOS)

Workarounds already baked into the scripts — documented here so future edits don't accidentally undo them:

### `lightpanda` command syntax

**Wrong:** `lightpanda --strip-mode full <url>` — this form does NOT work with the current lightpanda binary. It's the syntax from an older skill/wrapper and looks plausible but silently produces no output.

**Right:** `lightpanda fetch --dump markdown --strip_mode full <url>`

Key parts:
- `fetch` is a required subcommand (not implicit)
- `--dump markdown` is what tells it to produce clean markdown
- `--strip_mode` uses an **underscore**, not a dash

If you ever need to debug why extract-url.sh is falling back to curl, check this first. `lightpanda --help` lists the subcommands.

### BSD sed doesn't support non-greedy `.*?`

macOS ships BSD sed, not GNU sed. The non-greedy regex form `.*?` fails with:

```
sed: 1: "s/<script[^>]*>.*?<\/sc ...": RE error: repetition-operator operand invalid
```

**Workaround used in extract-url.sh:** HTML stripping in the curl fallback uses `perl -0777 -pe` instead of `sed -E`. Perl supports non-greedy and multiline matching natively.

If you ever need to add more regex-based stripping, either use perl, or write the sed expression as a greedy pattern with a minimized character class (e.g. `<script[^<]*</script>` — works but less safe).

### `/tmp` → `/private/tmp` symlink resolution

On macOS, `/tmp` is a symlink to `/private/tmp`. The `realpath` call in `extract-file.sh` follows the symlink, so local file `ref` values get the `/private/` prefix:

```
Input:  /tmp/paper.pdf
Stored ref: /private/tmp/paper.pdf
```

This is **not a bug** — both paths point to the same file and the OS resolves them correctly. But be aware:
- Idempotency still works (hash is content-based, not path-based)
- Manual searches for "ref: /tmp/..." will not find the entry — search for the `/private/` form
- Moving or renaming files breaks the `ref` but not the content

### YouTube auto-subtitles may be in wrong language

`yt-dlp --sub-langs "en.*,en"` tries to pick English. If a video has no English auto-subs and no manual English subs, the subs file downloaded may be in another language. The script doesn't detect this — it just strips VTT cues and writes whatever text is in the file.

**Symptom:** YouTube-ingested file has `content:` in a non-English language.

**Workaround:** Use `--confidence low` on the ingest so downstream compile marks the claims more cautiously, and check the raw file after ingestion if the video was critical.

### VTT stripping patterns

The VTT-to-text pipeline in `extract-youtube.sh` uses `grep -v -E` to exclude header lines (`WEBVTT`, `NOTE`, `STYLE`, timestamps). Pure ERE — no Perl regex. If VTT files ever change format, this may need updating. Check with:

```bash
yt-dlp --skip-download --write-auto-subs --sub-langs en --sub-format vtt --output '/tmp/test.%(ext)s' <url>
cat /tmp/test.en.vtt
```

### `~` expansion in file paths

Bash does tilde expansion only when `~` is unquoted and at the start of a word. `extract-file.sh` handles `~` explicitly via parameter substitution: `FILEPATH="${FILEPATH/#\~/$HOME}"`. Don't rely on bash's automatic expansion inside quoted strings or when the path is read from a batch file.
