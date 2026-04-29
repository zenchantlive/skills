---
name: content-ingestion
description: Ingest URLs, YouTube videos, and local files (PDF/DOCX/etc) into the Daemion knowledge wiki. Triggers on "ingest", "add this", "remember this article/video". CRITICAL — extraction writes to raw/ only; you are NOT done until you READ COLD, FLAG CONTRADICTIONS with the existing wiki, propose a DECIDED compile plan, and compile with the user via knowledge-wiki skill. Silently overwriting existing claims or reporting "ingested successfully" after extraction alone is a skill violation.
---

# Content Ingestion

> **You are the wiki's librarian. You decide structure. The user decides signal.**

**This skill is the INPUT PIPE.** It handles extraction — turning URLs, YouTube videos, PDFs, and local files into raw markdown sources under `~/.daemion/knowledge/raw/`. It does NOT compile those raw sources into the wiki.

**For the compile step** (raw → wiki pages with cross-references, provenance, contradiction handling), see the `knowledge-wiki` skill at `~/.daemion/skills/knowledge-wiki/SKILL.md`.

**For the operational loop that wraps both** (wiki-first research, autonomous maintenance, end-of-response summary, the Linus principle), see the `librarian` skill at `~/.daemion/skills/librarian/SKILL.md`.

The three skills work together: **content-ingestion (input pipe) → knowledge-wiki (substrate) → librarian (workflow)**. All three are installed on every Daemion agent. When an agent says "ingest this URL," the ingest flow goes content-ingestion → librarian decides quick-vs-deep mode → knowledge-wiki primitives write the compile result → lint runs → end-of-response summary.

---

## ⚠️ Extraction is step 1 of 2 — READ THIS FIRST

**The biggest failure mode of this skill is an agent writing a file to `raw/` and reporting success.** That is a lie. Content in `raw/` is not in the wiki. It's in a staging area waiting for compile. If you stop at extraction and say "ingested successfully," you've broken the user's trust and the wiki's integrity.

### After extraction, your task is NOT done. You MUST:

1. **READ COLD.** Read the extracted file with NO reference to existing wiki pages. Extract 8–15 distinct idea clusters per substantive source (>5K words). Do NOT start from "what does this connect to in the wiki?" — that filters out everything novel. Read the source on its own terms first. See [read-cold-map-warm](#read-cold-map-warm) below.

2. **MAP WARM.** Only after the flat list is written, compare against existing wiki pages. Classify each cluster as: extends-existing, new-page, **contradicts-existing**, or archive-only. **Contradictions are first-class output** — see [Flagging Contradictions](#flagging-contradictions) below. If you find one, you MUST surface it in the compile plan, not quietly pick a side.

3. **DECIDE placement yourself.** Do not ask the user "where should this go?" or "new folder or existing?" You are the librarian. Those are your calls. The user decides SIGNAL (what's worth keeping). You decide STRUCTURE (where it lives). See [decide-vs-ask](#decide-vs-ask) below.

4. **DEFAULT to extending existing pages.** A 2-hour podcast should produce AT MOST 3 new pages. Most clusters fold into existing pages as new sections. See the [new-page-vs-new-section heuristic](#new-page-vs-new-section) below.

5. **PROPOSE a decided plan.** "Here's what I'll write: [list of pages + updates]. Stop me if wrong." Not "should I?" Not "where should X go?" A decided plan with one or two genuine tiebreakers at most.

6. **WRITE the pages** via the `knowledge-wiki` skill's compile workflow. Inline attribution to named sources. **Create a `people/<name>.md` entity page for EVERY non-trivial human voice in the source — including hosts/interviewers, not just the primary speaker.** A podcast interview produces TWO entity pages minimum (host + guest). Do NOT create pages for podcasts, newsletters, orgs, or publications prospectively — attribute to humans, not shows. See [Source-entity rule](#source-entity-rule) below. Proper provenance. Dense wikilinks (5–15 per page).

7. **LINT after every write.**

8. **Report the final wiki state** — which pages exist now that didn't before, which existing pages got new sections. Acceptable phrasing examples:
   - ✅ *"Extracted to raw/ (23K words). Proposed compile plan: 2 new pages + 4 section updates. Stop me if wrong."*
   - ✅ *"Compiled into [[page-a]], [[page-b]], and sections added to [[c]], [[d]], [[e]]. Lint clean."*
   - ❌ *"Ingested successfully."* (ambiguous — did you read it? did you compile?)
   - ❌ *"Added the video to the wiki."* (only true after compile)
   - ❌ *"Done."* (lazy)

**If the skill body ever gets truncated below this point, the above is the minimum behavior.** The frontmatter description repeats the core rule. The `ingest.ts` script also prints this rule in its tool output. Three layers of protection exist because this is the failure that breaks the system.

## Flagging Contradictions

**Contradiction detection is a required output of the MAP WARM step — not an optional side note.** When a new source disagrees with what the wiki already says, that disagreement is itself high-value knowledge. Silently picking one side erases the learning. This is the single fastest way to corrupt the wiki.

**The rule:** if any cluster from your cold read contradicts an existing wiki page, the compile plan you propose to the user MUST list it as a contradiction, with both claims attributed and dated. Do not quietly "update" the old page. Do not quietly drop the new claim. Surface it.

### What counts as a contradiction

- **Direct factual disagreement** — old page says "gateway uses SQLite," new source says "gateway uses Postgres"
- **Reversal of a decision** — old page says "we chose cron chaining," new source says "cron chaining is deprecated, use self-scheduling"
- **Updated understanding** — old page asserts X with confidence, new source reveals X was based on a misreading of the primary source
- **Scope mismatch surfacing as conflict** — old page says "always do X," new source says "never do X" (often resolvable as both-are-true under different scopes)
- **Speaker-internal reversal** — within the SAME source, the speaker changes their mind (early in interview said X, later said Y). Both matter.

### How to flag during MAP WARM

For each cluster you classify as `contradicts-existing`, record:

```
CONTRADICTION:
  new claim:    <what the source says> — per [[source-slug]] ([date/timestamp])
  old claim:    <what the wiki currently says> — per [[existing-page]] ([capture date])
  stakes:       low | medium | high
  suggested:    ambiguous | supersede | both-scoped | escalate
  reasoning:    <why you're suggesting that resolution — one sentence>
```

- **low stakes** — terminology, historical minutiae, non-load-bearing fact. Safe to auto-resolve with `^[ambiguous]` or a supersession note.
- **medium stakes** — affects a project page but not user preferences or architecture. Propose a resolution, let the user accept or override in one click.
- **high stakes** — architecture decisions, user preferences, project priorities, cross-agent claims. **MUST escalate** — do not pick a side yourself. Present both claims and ask.

### How to surface in the compile plan

Contradictions appear as their OWN bullet in the decided plan, not buried inside a section update:

> *"Proposed compile plan:*
> - *NEW: `topics/strategy/exponential-bet-sizing.md`*
> - *EXTEND: [[vision]] — section on "growth as product"*
> - *⚠️ CONTRADICTION (high stakes): Amol claims you should hire PMs early. [[project-structure]] currently says "no PMs until Series B" per your 2026-01 note. Which stands? Both? Escalating to you.*
> - *⚠️ CONTRADICTION (low stakes): Amol says Claude Code launched in Feb 2025; [[claude-code-timeline]] says March 2025. Suggesting `^[ambiguous]` with both citations. OK?*
> - *ARCHIVE ONLY: 2 clusters*"

The user can then accept, override, or ask follow-ups — but the contradiction is visible, not hidden.

### What NOT to do

- **Do NOT edit the old page to match the new source** without recording the old claim somewhere. Silent overwrite = confident lie.
- **Do NOT drop the new claim** because it's "inconvenient" or contradicts established knowledge. The disagreement IS the signal.
- **Do NOT auto-resolve high-stakes contradictions.** Escalate.
- **Do NOT bury contradictions inside section-update bullets.** They get their own line in the plan so the user can't miss them.
- **Do NOT classify a cluster as `extends-existing` when it actually reverses the existing claim.** That's a contradiction, not an extension.

### Handoff to knowledge-wiki skill

You detect and flag here. The actual resolution writing (ambiguity markers, supersession notes, cross-scope handling) happens when you WRITE the pages via the `knowledge-wiki` skill. That skill's "Contradiction Handling — When Sources Disagree" section defines the four resolution patterns (both-stand / supersede / both-scoped / escalate) and how they get written into the wiki. Read it before you write.

**The test:** if the user reads your compile plan and can't tell from it alone "is anything in this source disagreeing with what we already believe?", you failed the MAP WARM step. Go back.

## Source-entity rule

**Every non-trivial human voice in a source gets their own `people/<name>.md` entity page — not just the primary speaker.** This is load-bearing for attribution quality over time.

### Who counts as a "non-trivial human voice"

- **The author, guest, speaker, or author** — obviously
- **The interviewer, host, or moderator** — YES. Their framing questions are their own knowledge. "What does this host think about X across 500 interviews?" is only answerable if the host has been a first-class entity from day one.
- **Named co-authors of papers or talks** — each gets a page
- **Anyone cited 2+ times across your existing wiki pages** — if they come up repeatedly, create an entity page even if they're not in the current source

### How many entity pages per compile

| Source type | Entity pages you should create |
|---|---|
| Podcast interview (1 host + 1 guest) | **2** — both get pages |
| Panel discussion (1 host + 3 guests) | **4** — all participants |
| Multi-author paper | **one per named author** |
| Blog post by single author | **1** |
| Conference talk, single speaker | **1** |
| Company blog post with no named author | **0** (attribute to the org via prose, or skip attribution) |

**Common failure:** compiling a podcast and creating only the guest's page because "the host was just asking questions." This loses the host's framing knowledge forever. Always create both.

### What NOT to create pages for

**Do NOT create pages for publications, newsletters, podcasts, shows, orgs, or companies on first ingestion.** You attribute to the humans who speak for them:

- "per Amol on [[lennys-podcast-amol]]" — the podcast itself is just the raw file slug
- "per Lenny's framing question" — attribute to `[[lenny-rachitsky]]`, not to `[[lennys-podcast]]`
- "Anthropic announced X" in prose, without a wikilink — or attribute to the specific spokesperson

**The three-instance rule:** you may create a non-human entity page ONLY when BOTH of these are true:
1. The same non-human entity is cited on **3+ wiki pages**
2. You find yourself wanting to write a page *about the entity itself* (not just link to it)

When the trigger fires: put the page in `people/` (not a new folder), add `entity_type: publication | org | show | newsletter` to the frontmatter, scope `public`. One folder for all entities — don't create parallel `sources/` or `orgs/` taxonomies.

### Integration with the decided plan

Your decided compile plan MUST include the entity pages explicitly — not hide them inside "and I'll attribute to the speaker." They are first-class deliverables:

> *"Proposed plan:*
> - *ENTITY: `people/amol-avasare.md` (public — Head of Growth, Anthropic)*
> - *ENTITY: `people/lenny-rachitsky.md` (public — podcast host)*
> - *NEW: `topics/strategy/exponential-bet-sizing.md`*
> - *..."*

This makes the count visible to the user — they can challenge "why is this person getting a page?" or "why aren't you creating one for the co-host?" before you write.

## Speaker Attribution — Confidence Tiers

**For multi-speaker sources (interviews, podcasts, panels), you are inferring attribution from context — not reading ground truth.** YouTube auto-captions, yt-dlp transcripts, and many quoted article formats don't cleanly separate speakers. You're reading context cues to guess who said what. That guess has a confidence level — mark it.

**Three tiers (enforced by the knowledge-wiki skill when you write pages):**

| Tier | Attribution format | When it applies |
|---|---|---|
| **High** | `per [[speaker-name]]` | Explicit speaker markers in the raw file (`>>`, labeled turns) AND clear content ownership cues |
| **Medium** | `per [[speaker-name]] ^[inferred]` | No explicit marker but topic/self-reference/voice makes it obvious (e.g., "my team at Anthropic," "when I joined Mercury") |
| **Low** | `per [[raw-file-slug]]` (attribute to the raw file, not a person) | Could plausibly be either speaker; rapid back-and-forth; cross-quoting; reactive fragments ("Yeah." "Right.") |

**Core rule: when in doubt, drop down a tier.** A wrong attribution is worse than a vague one.

**What this means during MAP WARM:**

- For each cluster you extract, note the confidence level of the attribution before writing it into the compile plan
- If an interview has 90% high-confidence and 10% ambiguous passages, you can still high-confidence the 90% — you don't have to drop everything to low. Tier per-claim, not per-source.
- If you find yourself writing "Amol said X but actually it might have been Lenny," STOP — that's a low-tier claim. Attribute to the raw file.
- If the source is a panel with 3+ speakers and no explicit labels, default EVERYTHING to medium at best, and most to low. Panels are attribution hazards.

**Default by source type:**

- Long-form 1-on-1 Q&A interview (Lenny's Podcast style) → **high** default
- Panel / roundtable / 3+ speakers → **medium** at best, mostly **low**
- Solo podcast, blog post, talk → doesn't apply (single author)
- Quoted fragments in articles without clear attribution → **low**

See the knowledge-wiki skill's "Speaker Attribution Confidence Tiers" section for the full writing rules. This skill just needs to make sure you **classify each claim's confidence during MAP WARM** so the writing step has accurate tier info to work with.

## Purpose — Extraction Only

This skill does **one thing**: turn a URL or file into a plain markdown file with frontmatter, written to `~/.daemion/knowledge/raw/<category>/<date>-<slug>.md`.

It does NOT:
- Compile raw into wiki pages → use `knowledge-wiki` skill's compile step
- Query knowledge → use `knowledge-wiki` skill's search
- Extract entities or build knowledge graphs → removed (the old Engram approach is deprecated)
- Summarize content → if the user wants a summary, fetch and summarize directly without using this skill

**Think of this skill as the input pipe to the wiki, nothing more.** Keep it simple. Everything downstream is another skill's job — BUT your responsibility does not end at raw/. You must complete the handoff to compile before the task is done (see above).

## When To Use

Use this skill when:
- User says **"ingest this"**, **"add this to the wiki"**, **"remember this article/video"**, **"store this"**, **"save this link"**
- User shares **multiple URLs** they want retained for later
- User drops a **local file path** (PDF, DOCX, markdown, etc.) they want added
- User asks you to **watch a YouTube video and retain it**
- Batch-loading reference material for a research session

Do NOT use this skill when:
- User wants a **quick summary** — just fetch and summarize directly
- User wants to **edit or query** existing wiki knowledge — use `knowledge-wiki` skill
- URL points to a **binary download** with no readable content (installer, zip, image-only)
- User is actively **discussing** an article — read it directly into context, don't ingest yet
- User wants **compilation** from raw to wiki pages — use `knowledge-wiki` skill's compile step

## The Flow

```
User input (URL or file path)
    ↓
[extract-*.sh]   ← source-type detection, extract to JSON
    ↓
[ingest.ts]      ← JSON → markdown with frontmatter + source_hash
    ↓
~/.daemion/knowledge/raw/<category>/<date>-<slug>.md
    ↓
(later, separate skill)
    ↓
[knowledge-wiki compile] → wiki/<scope>/<folder>/<slug>.md
```

This skill owns the first three steps. The fourth is explicitly another skill's responsibility.

## Scripts

All scripts live in `scripts/`. Read `references/extractors.md` for when to use which.

| Script | Purpose |
|---|---|
| `scripts/ingest.ts` | **Main entry point.** Single URL, single file, or `--file batch.txt`. Handles idempotency, frontmatter, write. |
| `scripts/extract-url.sh` | Web extraction. Uses `lightpanda` if available, falls back to `curl` + HTML strip. |
| `scripts/extract-youtube.sh` | YouTube transcript via `yt-dlp`. Captures metadata: title, channel, duration, chapters. |
| `scripts/extract-file.sh` | Local file via `liteparse` (PDF, DOCX, XLSX, PPTX, images). Falls back to `pdftotext` for PDFs. |

## Single Source Workflow

```bash
# URL
npx tsx ~/.daemion/skills/content-ingestion/scripts/ingest.ts "https://example.com/article"

# YouTube
npx tsx ~/.daemion/skills/content-ingestion/scripts/ingest.ts "https://youtube.com/watch?v=abc123"

# Local file
npx tsx ~/.daemion/skills/content-ingestion/scripts/ingest.ts "~/Downloads/paper.pdf"

# Dry run — see what would be written, don't touch disk
npx tsx ~/.daemion/skills/content-ingestion/scripts/ingest.ts --dry-run "https://example.com"

# Override category (default: auto-detected from source type)
npx tsx ~/.daemion/skills/content-ingestion/scripts/ingest.ts --category videos "https://example.com/talk"

# Set confidence (default: medium)
npx tsx ~/.daemion/skills/content-ingestion/scripts/ingest.ts --confidence high "https://primary-source.com"
```

## Batch Workflow

```bash
# Ingest a list of URLs, one per line
npx tsx ~/.daemion/skills/content-ingestion/scripts/ingest.ts --file urls.txt
```

- Failures are **per-URL** — one bad URL doesn't kill the batch
- Already-ingested sources are **skipped** via `source_hash` deduplication
- Summary reported at end: written, skipped, failed

See `templates/batch-urls.txt` for the expected input format.

## Decision Tree — What Extractor Runs

```
Input
├── exists on disk OR file:// prefix → extract-file.sh (liteparse)
├── contains youtube.com OR youtu.be → extract-youtube.sh (yt-dlp)
└── any other URL → extract-url.sh (lightpanda or curl fallback)
```

The `ingest.ts` script handles this detection automatically. You only need to call the individual extractors directly when debugging or when auto-detection fails.

## Category Selection

Extracted sources go into subdirectories under `~/.daemion/knowledge/raw/`. See `references/category-rules.md` for full rules. Quick version:

| Category | For |
|---|---|
| `links/` | Web articles, blog posts, papers, documentation |
| `videos/` | YouTube transcripts, podcasts, video talks |
| `files/` | Local documents, PDFs, slide decks, images |
| `sessions/claude-code/` | Claude Code session transcripts (auto-written by session-end hook) |
| `sessions/daemion/` | Daemion thread summaries |
| `sessions/pi/` | Pi session extracts |

Override with `--category <name>` if auto-detection is wrong.

## Provenance and Confidence

Every raw source carries a confidence level used downstream by `knowledge-wiki` lint:

- `high` — peer-reviewed paper, official docs, primary source. Lint trusts claims.
- `medium` — default. Blog post, conference talk, well-known author.
- `low` — podcast, casual video, forum post, unverified claim. Lint flags derived claims as `^[inferred]` more aggressively.

Set with `--confidence high|medium|low`. Without this flag, the default is medium.

Provenance frontmatter details are in `references/frontmatter-schema.md`.

## Idempotency

Every extracted source is hashed (`source_hash` = SHA-256 of content, first 8 chars). Before writing, `ingest.ts` checks if any existing file in `raw/` has the same hash. If yes → skip with a `[skipped: already ingested]` message.

This means:
- Re-running ingestion on the same URL is **safe and cheap**
- Updated content gets a **new hash** and becomes a new entry (both kept — let the wiki compile decide what to do)
- Batch mode **naturally deduplicates** across runs

## Dependencies

| Dependency | Required | Purpose | Install |
|---|---|---|---|
| `node` / `npx tsx` | ✅ | Runs `ingest.ts` | Bundled with Node.js |
| `curl` | ✅ | HTTP fallback for URL extraction | System default |
| `yt-dlp` | Recommended | YouTube transcript extraction | `brew install yt-dlp` |
| `lightpanda` | Recommended | Clean web → markdown extraction | See lightpanda docs |
| `liteparse` | Recommended | Multi-format local file extraction | `pip install liteparse` |
| `pdftotext` | Optional | PDF fallback if liteparse missing | `brew install poppler` |
| `jq` | Optional | JSON processing in shell scripts | `brew install jq` |

**Degraded modes:**
- No `lightpanda` → falls back to `curl` + naive HTML stripping (works, less clean)
- No `yt-dlp` → YouTube extraction fails with clear error
- No `liteparse` → PDF uses `pdftotext` fallback; DOCX/XLSX/PPTX fail with clear error

Check `references/failure-modes.md` for full failure recovery.

## Failure Modes

See `references/failure-modes.md` for the full catalog. Quick reference:

| Failure | What happens | How to recover |
|---|---|---|
| 404 / network timeout | Per-source failure logged, batch continues | Retry later, or skip |
| Paywall | Extraction returns minimal content | Flag with `--confidence low` or skip |
| Bot/challenge page captured as content | Raw file title may be `Untitled` and body says browser unsupported, verification required, Cloudflare, or security challenge; hash dedupe may then falsely mark different protected URLs as “already ingested” because they all captured the same challenge page | Treat it as a failed extraction, not a valid raw source. Use an alternate reader such as `https://r.jina.ai/http://https://example.com/path`, RSS/sitemap metadata, or direct official mirrors/PDFs; then write a curated raw file with the real source URL, extraction note, and distinct slug/hash before compiling. |
| DRM-protected YouTube | yt-dlp fails | Cannot ingest; use manual notes |
| Missing extractor | Clear error with install instructions | Install the tool, re-run |
| Rate limit | Extraction delays/fails | Wait, retry with smaller batch |
| Malformed HTML | Fallback to raw text | Usable but messier — lint will flag |

## Reference Docs

Loaded as needed, not by default:

| File | When to read |
|---|---|
| `references/frontmatter-schema.md` | Before hand-editing raw files, or when debugging frontmatter parse errors |
| `references/category-rules.md` | When deciding which subdirectory a source belongs in, or when `--category` override is needed |
| `references/extractors.md` | When source extraction fails or quality is poor — compares extractors and fallbacks |
| `references/failure-modes.md` | When ingestion fails unexpectedly — catalog of known failures and recovery strategies |

## Examples

See `examples/` for concrete walkthroughs:
- `examples/youtube-ingestion.md` — full flow for a YouTube video
- `examples/batch-articles.md` — multi-URL batch
- `examples/local-pdf.md` — local document ingestion

## What Changed From The Old Skill

The previous content-ingestion skill (at `~/.claude/skills/content-ingestion/`) is **deprecated**. It targeted the Engram memory graph (Neo4j + embeddings + Haiku triplet extraction). This skill replaces it with a much simpler flow that targets the Daemion knowledge wiki.

**Kept:** the extraction layer (yt-dlp, lightpanda, liteparse) — those were storage-agnostic.
**Dropped:** Haiku triplet extraction, Neo4j storage, Ollama embeddings, entity deduplication, cross-source synthesis. The wiki compile pass handles the equivalent concerns differently (and better, per the Karpathy LLM Wiki pattern).

**Do not use the old skill.** It's marked deprecated with a pointer to this one.

For the migration rationale, see `~/.daemion/skills/knowledge-wiki/SKILL.md` — the whole knowledge substrate moved from Engram to a compiled wiki.
