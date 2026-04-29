# Example: Batch Article Ingestion

Walkthrough of ingesting multiple web articles at once.

## The scenario

Jordan says: *"ingest these articles on agent protocols"* and drops 5 URLs.

## Step 1 — Create the batch file

```bash
cat > /tmp/protocols-batch.txt <<'EOF'
# Agent protocol research batch — 2026-04-08
https://github.com/universal-tool-calling-protocol/utcp
https://github.com/AgentNetworkProtocol/AgentNetworkProtocol
https://a2a.ai/docs/overview
https://www.anthropic.com/news/multi-agent-research-system
https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
EOF
```

## Step 2 — Run ingestion

```bash
npx tsx ~/.daemion/skills/content-ingestion/scripts/ingest.ts --file /tmp/protocols-batch.txt
```

Or with a confidence override for high-trust sources:

```bash
npx tsx ~/.daemion/skills/content-ingestion/scripts/ingest.ts \
  --file /tmp/protocols-batch.txt \
  --confidence high
```

## Step 3 — Watch the progress

The script prints per-source status to stderr as it goes:

```
→ https://github.com/universal-tool-calling-protocol/utcp
  ✓ written (/Users/jordan/.daemion/knowledge/raw/links/2026-04-08-utcp.md)
→ https://github.com/AgentNetworkProtocol/AgentNetworkProtocol
  ✓ written (/Users/jordan/.daemion/knowledge/raw/links/2026-04-08-agent-network-protocol.md)
→ https://a2a.ai/docs/overview
  ✗ failed: curl fetch failed for https://a2a.ai/docs/overview
→ https://www.anthropic.com/news/multi-agent-research-system
  ✓ written (/Users/jordan/.daemion/knowledge/raw/links/2026-04-08-multi-agent-research.md)
→ https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
  — skipped: already ingested at /Users/jordan/.daemion/knowledge/raw/links/2026-04-07-karpathy-wiki-gist.md
```

## Step 4 — Read the summary

Final JSON on stdout:

```json
{
  "total": 5,
  "written": 3,
  "skipped": 1,
  "failed": 1,
  "results": [...]
}
```

## Step 5 — Handle the failure

The agent reports:

> Ingested 3 of 5 sources. One failure: `a2a.ai/docs/overview` — curl could not fetch the page. It may be behind a paywall or anti-bot wall. Options:
> 1. Skip and keep the other 4
> 2. Retry with a saved HTML file if you have one
> 3. Use a different reference URL for A2A
>
> One source was already in the wiki (`karpathy-wiki-gist`), so it was skipped for idempotency.
>
> The 3 new sources are ready to compile via:
>
> ```bash
> npx tsx ~/.daemion/skills/knowledge-wiki/scripts/compile.ts
> ```

## What goes wrong in batches

- **One bad URL does not kill the batch.** The failure is logged, ingestion continues.
- **Duplicates are free.** Previously-ingested sources skip without an error.
- **Rate limits are not handled automatically** — if many URLs are from the same domain, consider splitting the batch or adding delays manually.
- **Order matters only for debugging.** The script processes sequentially, not in parallel.

## When to use batch mode

- Research sprint — multiple sources on the same topic
- Import of bookmarks or link archive
- Backfill of reference material before a project kicks off
- Nightly job that reads a file updated by some other system

## When NOT to use batch mode

- Single source — just pass it as a positional arg
- Sources require different `--confidence` levels — run separately
- Mix of real ingestion and "I'm just curious what's on this page" — use the skill for the former, direct reading for the latter
