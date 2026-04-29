---
name: knowledge-wiki
description: Second-brain wiki. Capture, compile, query, lint. CRITICAL — you are the LIBRARIAN. You decide structure (where pages go); the user decides signal (what's worth keeping). READ COLD before mapping to existing pages. DEFAULT to extending pages over creating new ones. NEVER silently overwrite — preserve contradictions with attribution. Stopping at raw/ and reporting "done" is a skill violation.
---

# Knowledge Wiki

> **You are the wiki's librarian. You decide structure. The user decides signal.**

**This skill is the SUBSTRATE layer.** It describes what the wiki *is*: page format, scope rules, wikilinks mechanics, compile workflow, lint, claim-level provenance, contradiction handling, source-entity rules. It's the constitution.

**For the WORKFLOW of actually using the wiki** — answering questions, researching when the wiki is thin, maintaining the graph as you go, the wiki-first-research-second-never-fabricate rules, the end-of-response summary spec, the Linus principle — **see the `librarian` skill at `~/.daemion/skills/librarian/SKILL.md`**. Both skills are installed on every Daemion agent. This one tells you what the wiki is; the librarian skill tells you how to use it correctly.

**For extracting raw sources** (URLs, YouTube, local files) into `raw/` before compilation, see the `content-ingestion` skill at `~/.daemion/skills/content-ingestion/SKILL.md`.

The three skills work together: **content-ingestion → knowledge-wiki → librarian** is the input pipeline → substrate → operational loop.

---

You have a persistent knowledge wiki — a second brain that survives across sessions. It stores what you've learned, decided, observed, and been told in structured, interlinked markdown pages.

This is not a log. It's compiled knowledge. Raw conversations go in, structured wiki pages come out. The wiki gets richer with every session.

## ⚠️ The four rules that break everything if you skip them

1. **READ COLD, MAP WARM.** When compiling a new source, read the raw file on its own terms FIRST. Extract 8-15 distinct idea clusters before looking at the existing wiki. Only after the flat list exists, compare to existing pages. Starting from "what does this connect to?" filters out everything novel and produces hyperfocused slop.

2. **DEFAULT TO EXTENDING, NOT CREATING.** A 2-hour podcast should produce AT MOST 3 new pages. Most clusters fold into existing pages as new sections. If you're about to create a 5th new page from one source, stop and ask: "Would this be 2-3 paragraphs appended to an existing page instead?" See the [new-page-vs-new-section heuristic](#new-page-vs-new-section) below.

3. **DECIDE STRUCTURE YOURSELF.** Do not ask the user "where should this go?" or "new folder or existing?" You are the librarian. Folder, slug, scope, placement — those are your calls. The user decides what's worth keeping (signal). You decide where it lives (structure). See [decide-vs-ask](#decide-vs-ask) below.

4. **NEVER SILENTLY OVERWRITE.** If a new source contradicts an existing page, you record both claims with attribution and dates — you do not edit the old claim out. See [Contradiction Handling](#contradiction-handling--when-sources-disagree) below. This is load-bearing; without it the wiki becomes confident-sounding lies.

5. **NEVER LEAVE THE WIKI WITHOUT REINDEXING.** Every write, edit, or delete on any wiki page — including the shared wiki and any personal agent wiki — MUST be followed by a lint + reindex pass before you consider the work done. One command: `npx tsx ~/.daemion/skills/knowledge-wiki/scripts/lint.ts`. This validates the page, rebuilds `index.md`, and syncs the FTS5 full-text search index in one call. **If you skip it, `knowledge_search` returns stale results for every future query — which creates the wiki-skip failure mode for the NEXT agent, not just yourself.** A single missed reindex compounds across the team. Running lint is not a "polish step" — it's as load-bearing as the write itself. See the "Lint — First-Class Operation" section below for the full rule, the degraded-mode behavior when the gateway is down, and the failure modes of skipping it.

**Stopping at raw/ is not "ingested."** Extraction writes to a staging area. The content is NOT in the wiki until you've read cold, proposed a decided plan, written the pages with inline wikilinks, and linted. Acceptable phrasing: *"Extracted (23K words). Proposed plan: 2 new pages + 4 section updates. Stop me if wrong."* Not acceptable: *"Ingested successfully."*

**Writing a wiki page and not running lint is not "done."** The page exists on disk but the substrate's search layer doesn't know about it. Acceptable phrasing: *"Wrote `page-x.md`, lint clean, 36 pages indexed."* Not acceptable: *"Wrote the page."*

## Your Wiki vs Shared Wiki — DEFAULT TO SHARED

**This is important. Read it carefully.**

You have two knowledge spaces, but they are NOT equal partners. The shared wiki is the **default destination** for almost everything you learn. The personal wiki is a **narrow exception** for a specific class of self-observations.

### The rule

> **Default: shared wiki. Escape to personal only when the knowledge is about YOU specifically.**

Most of what you learn belongs in the shared wiki at `~/.daemion/knowledge/wiki/`:
- Architecture decisions → shared
- Code patterns discovered → shared
- External research (articles, videos, papers) → shared
- Project roadmap, status, bugs → shared
- Concepts and definitions → shared
- Tool usage and techniques → shared
- Historical decisions and their rationale → shared
- **Anything another agent could reuse** → shared

**Only these go into YOUR personal wiki** at `~/.daemion/agents/{your-name}/knowledge/`:
- Self-observations about your own effectiveness ("I tend to miss edge cases when…")
- Personal patterns you've noticed ("I work better when I run lint before compile")
- Private notes about how YOU specifically should handle recurring situations
- Things you'd be embarrassed to have another agent read
- Work-in-progress drafts before promoting to shared

**Ask yourself before writing to your personal wiki:** *Would another agent find this useful if they encountered the same situation?* If yes → shared wiki. If no → personal wiki.

### The 80/20 rule

In practice, expect roughly **80% of your wiki writes to land in shared** and **20% or less in personal**. If you're writing more than 20% to personal, you're probably hoarding knowledge that other agents should see.

### Cross-agent knowledge is the point

The whole reason for the shared wiki is that agents are a **team**. When researcher finds something, daemion should benefit. When pulse notices a pattern across conversations, librarian should see it. Private hoarding defeats the purpose.

### How to know which wiki is yours

Your agent name is provided in your system prompt or session context. Your personal wiki lives at:
```
~/.daemion/agents/{your-name}/knowledge/
```

If this directory exists, it's yours. If it doesn't yet, it gets auto-created on first write by `ensureAgentWiki()`. If you have no agent identity (you're a generic session), read and write the shared wiki only.

Both wikis use the same `people/` `projects/` `topics/` folder structure — but yours is private, the shared one is team.

## When to Capture Knowledge

Capture is not something you do when told to. It's something you notice is needed. Watch for:

**Decisions** — "We chose X over Y because Z." This is the most valuable knowledge. The reasoning behind decisions is what future sessions need most. → **shared wiki**, under `projects/<name>/decisions/` or similar.

**User preferences** — The user corrects your approach, confirms something worked, or expresses a preference. "Don't mock the database" or "terse responses, no hedging." → **shared wiki** under `people/<user-name>/`. Every agent working with this user needs to know.

**Project patterns** — You notice something architectural: "SQLite FTS5 outperforms regex for thread search." → **shared wiki** under `projects/<name>/` or `topics/`. Reusable across agents.

**Self-observations** — "I tend to under-link in my first draft of a page — need to do a density pass before lint." → **personal wiki**. This is about YOU specifically.

**Facts** — Something is true about the project, the codebase, or the domain that isn't obvious from reading code. "The auth middleware rewrite is driven by legal compliance, not tech debt." → **shared wiki**.

**Connections** — You realize two things are related that weren't previously linked. Add a `[[wikilink]]` inline where you mention the related concept — new connections usually don't need a new page, just a new link.

**Don't capture:**
- Things derivable from code or git history
- Ephemeral task state (use tasks for that)
- Every detail of every conversation (that's what raw/ is for)

## When to Surface Knowledge

Don't wait to be asked. When the conversation touches a topic you have wiki pages about, bring them up naturally:

- "Based on our wiki, we decided X for this reason — [[decision-page]]. Still applies here."
- "The wiki has a page on this: [[relevant-concept]]. The key point is..."
- "This contradicts what's in [[existing-page]] — should we update it?"

**Don't dump entire pages.** Summarize the relevant point and cite the page. The user can read the full page if they want.

**Don't surface on every turn.** Only when the knowledge is genuinely relevant to what's being discussed.

## When to Connect

As you read and write wiki pages, watch for connections:

- A concept mentioned in one page that has its own page → add a `[[wikilink]]`
- Two pages that describe related things but don't reference each other → add cross-references
- A new insight that bridges two existing topics → consider a connection page

Propose connections during conversation: "This relates to [[existing-page]] — should I add a link?" For automatic compilation, the compiler creates connections as part of the resolve step.

## When to Question

If something in the conversation contradicts existing wiki knowledge, flag it:

- "The wiki says X ([[page]]), but what you're describing is Y. Should I update the wiki?"
- "This decision reverses [[previous-decision]]. I'll mark that page as superseded."

Don't silently overwrite. Knowledge changes should be visible.

## Interactive Ingest

When the user shares a URL, article, video, or any external source during conversation:

### Step 1: READ
Fetch and read the source. For URLs, use the ingest-url script:
```bash
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/ingest-url.ts <url>
```
This saves the extracted content to `raw/links/`.

### Step 2: EXTRACT
Identify what's in the source:
- Entities (people, tools, projects, organizations)
- Concepts (ideas, patterns, principles)
- Claims (specific factual statements)
- Relationships (how entities/concepts connect)
- Open questions (what the source raises but doesn't answer)

### Step 3: PROPOSE
Present your extraction to the user. Don't write to the wiki yet.

"Here's what I found in this source:
- 5 concepts, 3 entities, 8 claims
- Connects to existing pages: [[page-a]], [[page-b]]
- 2 claims contradict [[page-c]]
- I'd create 2 new pages and update 3 existing ones

Want me to proceed, or adjust anything?"

### Step 4: RESOLVE
After user confirms, check against the existing wiki:
- Read index.md to find candidate overlaps
- For each extracted item: is it new, an update, or a contradiction?
- Map the wikilinks

### Step 5: WRITE
Create/update pages, add cross-references, update index.md, append to log.md.

### Automatic Ingest (no human in the loop)
For session captures (session end, compaction), skip the PROPOSE step. Extract → Resolve → Write. The lint pass catches issues later.

## Query

When you need to find knowledge:

### Tiered retrieval — escalate cost, don't blast
1. **Read index.md** — scan one-line summaries. This answers 80% of lookups.
2. **Grep specific terms** in candidate pages identified from the index.
3. **Read full pages** only for confirmed-relevant results.
4. **Search all wikis** (shared + your own + other agents' public) only as last resort.

If the gateway is running, use the API:
```
GET /knowledge/search?q=<keywords>&limit=5
GET /knowledge/article/<slug>
```

If working offline, use the search script:
```bash
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/search.ts "query terms"
```

### Citing knowledge
When you use wiki knowledge in your response, cite the page:
- "According to [[page-slug]], the pattern is..."
- Reference the page naturally, don't dump raw content.

### Filing query answers
If your answer to a question is valuable enough to keep, file it as a wiki page. These are archive pages — point-in-time answers that don't get updated by future compilations. Good candidates:
- Comparisons you worked out
- Analyses that synthesized multiple sources
- Answers the user is likely to ask again

## Lint — First-Class Operation

**Lint is not optional.** A wiki that doesn't lint decays into a folder of disconnected essays. Linting is the quality gate that keeps the wiki functioning as [[karpathy-llm-wiki-pattern|compiled knowledge]] instead of a pile of markdown.

### When to lint

Run lint **explicitly** in these situations:

1. **After writing or editing wiki pages.** Always. Before ending the task. Lint catches the things you miss.
2. **After ingesting a new source** that touched multiple pages.
3. **Before presenting a final compile/backfill summary** to the user.
4. **When you notice drift** — contradictions, stale references, sparse pages during a read.
5. **Periodically** — start of a fresh session on a project with an active wiki.

### How to run it

```bash
# Lint the shared wiki (validates + rebuilds index.md + syncs FTS5 via gateway)
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/lint.ts

# Lint an agent's private wiki
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/lint.ts --agent <name>

# Skip the index rebuild + FTS sync (pure validation pass)
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/lint.ts --no-sync

# Future: --fix mode for auto-fixable structural issues
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/lint.ts --fix
```

Output is JSON. Parse it — count by severity and type, then act on each category.

**Lint does THREE things in one call (shared wiki and agent wiki when gateway is reachable):**
1. **Validates** — scope violations, sparse linking, orphaned pages, missing frontmatter, provenance drift, contradictions, todo-links
2. **Rebuilds `index.md`** — the human-readable page index at the wiki root
3. **Syncs FTS5** — pings `POST /knowledge/compile` on the gateway to update the SQLite full-text search index so `knowledge_search` returns fresh results

For agent wikis, the gateway path is `POST /knowledge/compile?agent=<name>`.

**Write gate note:** substantive prose writes now require `knowledge_write(..., humanized: true)` after a real `content-humanizer` pass. Short structural edits still go through without that flag.

This is the whole reason the rule is "run lint after every write." You don't have to remember to run `rebuild-index.ts` separately or remember to sync FTS — lint does all three. If the gateway is down, lint prints a warning to stderr and FTS stays stale until you run lint again with the gateway up.

**If lint is ever skipped after a write:**
- `index.md` goes stale → agents reading the index for tiered retrieval see outdated summaries
- FTS5 goes stale → `knowledge_search` returns wrong results
- Lint errors go unfixed → scope violations, orphaned pages, contradictions accumulate
- Wiki drifts from being a compiled substrate toward being a bag of files

Run lint. Always. After every write. No exceptions.

### What lint checks (14 types across 3 tiers)

**Errors — must fix immediately:**
- `scope-violation` — public page linking to non-public target. Blocks the page from being shared safely.

**Warnings — need attention before the wiki is healthy:**
- `missing-title` / `missing-scope` / `missing-summary` — frontmatter incomplete
- `sparse-linking` — fewer than 5 inline wikilinks. The graph structure IS the knowledge.
- `provenance-drift` — >60% of lines marked `^[inferred]` or `^[ambiguous]` without source grounding
- `stale-claim` — source captured >180 days ago but body claims current state (needs verification)
- `missing-from-index` / `index-ghost` — index out of sync with filesystem

**Info — worth reviewing, not blocking:**
- `todo-link` — forward link to a page that doesn't exist yet (encouraged — write the target next time)
- `sparse-content` — page has <30 words (probably too thin)
- `orphaned-page` — no inbound wikilinks, page is disconnected from the graph
- `missing-cross-reference` — page mentions a glossary concept in prose without linking to it
- `possible-contradiction` — conflict keyword ("contradicts", "superseded by", etc.) found near a wikilink — review

### Action protocol (follow this order)

1. **Run lint.** Don't skip this step.
2. **Fix all `error` severity issues first.** Scope violations block safe sharing.
3. **Fix all structural `warning` issues** — missing frontmatter, missing-from-index, index-ghost.
4. **Fix sparse-linking warnings** by adding inline wikilinks where concepts are mentioned. Use the autolinker pattern if needed — scan the body for concepts that have wiki pages and link them on first mention.
5. **Review `stale-claim` warnings** against the current state of the underlying source. Update or mark as historical.
6. **Review `provenance-drift` warnings** — add source grounding or accept as synthesis.
7. **Review `info`-level issues** — especially `missing-cross-reference` and `possible-contradiction`. These are agent-judgment calls.
8. **Re-run lint** to confirm the issue count dropped.
9. **Report the final lint state** to the user before marking the task done. Format: `errors=X warnings=Y info=Z, outstanding: <brief list>`.

### Gateway endpoint

`POST /knowledge/lint` runs a subset of checks (scope validation + FTS sync). The full semantic lint lives in the skill script above — use the script for complete quality checks, use the endpoint for fast pre-flight before a FTS rebuild.

## Compilation — Interactive By Default

Compilation transforms raw sources (raw/) into wiki pages (wiki/). **This is an interactive conversation with the user, not a silent batch job.** The compile script is a helper — the actual knowledge synthesis is your job, in dialogue with the user who knows what matters.

### read-cold-map-warm

**The single most common compile failure: hyperfocus on one keyword.** An agent reads a 2-hour transcript, notices one acronym that matches an existing wiki page, and files ONLY that under the existing topic — ignoring the other 80% of the source. The wiki gets a thin footnote; the real value is lost.

**The fix is a two-pass read:**

**Pass 1 — COLD.** Read the raw file with ZERO reference to existing wiki pages. Do not grep. Do not think "where does this go?" Do not skim for familiar terms. Your only job: produce a flat list of 8-15 distinct idea clusters from the source itself, on its own terms. Each cluster gets:
- A short label (3-6 words)
- 1-2 sentence summary of what the source says about it
- Key quotes or timestamps if useful
- No wiki mapping yet

**Structured read rule** (for long sources — transcripts, papers, podcasts):
- First 20% — framing, premise, why the speaker thinks this matters
- Middle 20% sampled — the dense middle often has the most specific claims
- Last 20% — conclusions, revisions, what the speaker wishes they'd said
- Chapter headers / section breaks — each one is a candidate cluster
- Any paragraph with an unknown proper noun, acronym, or technical term — those are often the novel ideas

If you're reading a 23K-word transcript and came out with only 3 clusters, you read it wrong. Go back.

**Pass 2 — WARM.** Only after the flat list exists, compare each cluster to the existing wiki. For each cluster, classify:
- **extends-existing** — fold into an existing page as a new section
- **new-page** — warrants its own page (use the heuristic below to confirm)
- **contradicts-existing** — triggers [Contradiction Handling](#contradiction-handling--when-sources-disagree)
- **archive-only** — stays in raw/, not worth wiki space

The flat list from Pass 1 is the audit trail. If the user asks "what else was in that source?" you can show them the clusters you rejected and why.

### new-page-vs-new-section

**Default: extend an existing page with a new section.** Creating a new page is the exception, not the rule.

**The 3-question test for a new page:**
1. **Is the topic substantial enough to stand alone?** Could you write 300+ words of unique content that isn't just a restatement of an existing page? If not → section in existing page.
2. **Would another page naturally wikilink to this as a standalone concept?** If the only inbound links would be from the source page, it's not a wiki page — it's a section. If 3+ other pages would link to it → new page.
3. **Does it deserve its own slug in the graph?** The slug is the concept's identity. If you can't name the slug without awkwardness, the concept isn't crisp enough yet → section.

**The 2-hour-podcast rule.** A substantive source (>5K words) should produce:
- **0-3 new pages** (high-signal, standalone concepts)
- **4-8 section updates** to existing pages (the bulk of the yield)
- **1 person page** if the speaker is a new named source (see source-entity pattern below)
- **Possibly 1 raw-archive-only note** if some clusters are interesting but not load-bearing

If you're about to propose 5+ new pages from one source, you're creating bloat. Re-classify at least half as section updates.

### decide-vs-ask

**You decide structure. The user decides signal.** These are not the same thing and you must not conflate them.

| The agent DECIDES (do not ask) | The user DECIDES (must ask) |
|---|---|
| Which folder a page lives in (`topics/` vs `projects/` vs `people/`) | Whether a claim is worth keeping at all |
| The slug / filename | Whether a contradiction with existing knowledge should supersede or coexist |
| The scope (`public` / `project/<name>` / `personal`) | User preferences, working style, or personal facts about them |
| Whether a cluster becomes a new page or a section update | Project priorities and roadmap decisions |
| Which wikilinks to add inline | Whether a speculative connection is valid ("I inferred X — is that right?") |
| Whether to create a new subfolder | Anything that affects their workflow, their tools, or their identity |
| How to title a new page | Authoritative domain facts you don't have independent grounding for |
| Which source-entity `people/` page a quote attributes to | |

**The test:** if the question is about *where information lives*, you answer it yourself. If the question is about *what the information means or whether it matters*, ask the user.

**What a DECIDED plan looks like** (not open questions):

> *"Extracted the Amol interview to raw/videos/. Reading cold, I found 11 clusters. Proposed compile plan:*
>
> - *NEW: `topics/strategy/exponential-bet-sizing.md` (Tier 1, 4 inbound link candidates)*
> - *NEW: `topics/team-structure/engineers-as-mini-pms.md` (Tier 1, connects to [[autonomy-vision]] and [[plan-act-redesign]])*
> - *NEW: `people/amol-avisari.md` (public scope, source entity)*
> - *EXTEND: [[vision]] — add section on "growth as product" per Amol*
> - *EXTEND: [[autoresearch-jobs]] — add Amol's measurement-first example*
> - *EXTEND: [[compiled-knowledge-vs-rag]] — Amol's take on evals*
> - *EXTEND: [[ecosystem-gap]] — his "leaving money on the table" framing*
> - *ARCHIVE ONLY: 3 clusters (tactical hiring stuff, not relevant to our roadmap)*
>
> *Stop me if wrong or if any archive-only items should be kept."*

That's a decided plan. One statement of intent, one open tiebreaker (the archive-only filter), ready to execute. NOT: "Where should exponential bet sizing go? New page or existing? What folder?"

### Interactive vs automatic mode

**Interactive compile (default for substantive sources):** when the raw source is substantive — any source over 1K words, any podcast/video transcript, any opinionated article, any research paper, anything where reasonable people could disagree about what's worth keeping — you run the compile as a **conversation**:

1. **Read the raw file.** Actually read it. Not just the frontmatter.
2. **Identify candidates.** Tier the claims by signal:
   - **Tier 1** — directly connects to the user's active work, existing wiki pages, or unresolved questions. Probably warrants its own page.
   - **Tier 2** — useful but folds into existing pages rather than creating new ones.
   - **Tier 3** — background context that stays in raw/ as archive only.
3. **Propose to the user.** Surface the tiered candidates. Ask specific questions:
   - "Where should X go — new page in `topics/`, or fold into `[[existing-page]]`?"
   - "Is there enough here for a new folder, or use existing?"
   - "Which tier-3 items do you actually want kept?"
4. **Wait for answers.** Do not auto-proceed. The user's judgment about what matters is the whole point.
5. **Write the chosen pages** with proper grounding:
   - Extracted claims cite the raw source in provenance frontmatter
   - Inferred/synthesized claims get `^[inferred]` markers
   - Cross-references are **inline wikilinks**, not just a Related footer — see the Wikilinks section
6. **Run lint.** Confirm zero errors, zero scope violations, density warnings resolved.
7. **Report the final state** — which pages were written, which raw sources they drew from, what lint says.

**Automatic compile (ONLY for thin sources):** skip the conversation ONLY when:
- Raw source is **small (<1K words)**
- Content is **reference-like** (documentation, definitions, API docs, changelog entries)
- There's **no user-specific context** to discuss
- Only one or two obvious pages would come out

In that case:

```bash
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/compile.ts
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/rebuild-index.ts
```

And report what was written.

### When in doubt, choose interactive

Auto-compiling substantive sources produces slop. The wiki fills up with thin pages that nobody asked for, cross-references are wrong because the agent guessed wrong about the user's intent, and the quality gate exists only on paper. **Interactive is the default.** Automatic is the exception for genuinely trivial content.

### The script

```bash
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/compile.ts
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/compile.ts --agent <name>
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/compile.ts --dry-run
```

The script identifies uncompiled raw sources via a manifest (`.manifest.json` with SHA-256 hashes) and outputs the compilation context. **The script does not write wiki pages on its own** — it produces the context for *you* to read, propose pages, and write them after user input.

### After compilation

Always rebuild the index and re-run lint:
```bash
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/rebuild-index.ts
npx tsx ~/.daemion/skills/knowledge-wiki/scripts/lint.ts
```

### Common anti-patterns to avoid

- **"Ingested successfully"** — the user thinks this means compiled + in the wiki. If you stopped at raw/, you lied. Say "extracted to raw/, which of these candidates should I compile?"
- **Auto-compiling a podcast transcript** — the content is rarely as uniform as the script assumes. Interactive only.
- **Making pages without reading the source** — vibes-based compilation fills the wiki with hallucinations dressed up as facts. Read the raw file.
- **Skipping the `Related` chat** — the whole point is that the user directs the synthesis. An agent that auto-generates pages without asking is replacing the user, not assisting them.

## Page Format

Every wiki page has YAML frontmatter + markdown body. See `references/article-template.md` for the full template.

Required frontmatter:
- `title` — page title
- `scope` — `public`, `project/<name>`, or `personal`
- `summary` — max 200 chars, used in index and cheap retrieval

### Scope Rules

| Scope | What goes here | Who sees it | Can link to |
|-------|---------------|------------|-------------|
| `public` | Universal knowledge, no PII | Everyone | Only other public pages |
| `project/<name>` | Project-specific decisions, architecture | Agents in that project | Public + same-project |
| `personal` | Preferences, PII, self-observations | Only you | Everything |

**Public pages NEVER link to personal or project pages.** The lint script enforces this.

### Claim-Level Provenance

Mark trust levels inline:
- No marker = extracted (source says this explicitly)
- `^[inferred]` = your synthesis (connection, generalization)
- `^[ambiguous]` = sources disagree

This lets future readers (including yourself) know what's grounded vs what's guessed.

### Speaker Attribution Confidence Tiers

**For sources with multiple speakers (interviews, panels, conversations), attribution is inference, not ground truth.** YouTube auto-captions, podcast wall-of-text transcripts, and many article quote formats don't cleanly separate speakers. You're reading context cues (question-answer structure, self-reference, topic ownership, voice patterns) to guess who said what. That guess has a confidence level — mark it.

**Three tiers:**

| Tier | Marker | When to use |
|---|---|---|
| **High** | `per [[speaker-name]]` (no marker) | Speaker changes are explicitly marked (`>>`, named labels, etc.) AND the content has clear ownership cues. Long-form 1-on-1 Q&A interviews usually qualify. |
| **Medium** | `per [[speaker-name]] ^[inferred]` | No explicit marker but the topic/ownership/question-answer structure makes attribution obvious. Self-reference ("my team," "I kicked off X"), topic ownership (someone described their own project), or distinctive voice patterns. |
| **Low** | `per [[raw-file-slug]]` (attribute to the source file, NOT a person) | Could plausibly be either speaker. Happens in rapid back-and-forth, when one speaker quotes the other, when both use "we," or when auto-captions glue two turns into one paragraph. |

**The core rule: when in doubt, drop down a tier.** A claim wrongly attributed to the wrong person is worse than a claim attributed vaguely to "the source."

**Defaults by source type:**

- **Long-form 1-on-1 Q&A interviews** (Lenny's Podcast, Dwarkesh, Sean Carroll, etc.) — default to **high** because the structure carries strong signal
- **Panel discussions, roundtables, conversations with 3+ speakers** — default to **medium** at best, drop to **low** for any ambiguous passage
- **Single-speaker content** (blog posts, solo podcasts, talks) — tier doesn't apply; all attribution is to the single known author
- **Q&A transcripts without speaker markers at all** — default to **low** until you can verify

**The mechanical check you do before attributing:**

1. Is there an explicit speaker marker in the raw file (`>>`, "Amol:", "Lenny:")? If yes → high candidate. If no → medium at best.
2. Does the passage contain first-person statements about things only one speaker could own? ("I started CASH," "my team," "when I joined Anthropic") → strong high-confidence signal.
3. Is the passage a short reaction ("Yeah." "Right." "Exactly.") with no content cues? → always low.
4. Does the passage contain a quote-within-quote ("you said earlier that X") where the inner claim might be being attributed to the other speaker? → drop to low.
5. Are you feeling "I think this is Amol but I'm not sure"? → drop to low, attribute to source file.

**Do not paper over uncertainty.** If you genuinely can't tell, use the raw file slug as the attribution: `per [[2026-04-08-head-of-growth-anthropic-claude-is-growing-itself-at-this-po]]`. The reader can follow the link and read the context themselves. Ugly slug, honest provenance.

### Contradiction Handling — When Sources Disagree

**A wiki that silently overwrites old claims with new ones is worse than no wiki at all.** It produces confident-sounding lies. If a new source contradicts an existing page, the contradiction is itself knowledge — preserve it, attribute it, surface it.

**The absolute rules:**

1. **NEVER silently overwrite a claim.** If a new source says the opposite of what a page already says, you do not edit the old claim out. You record both.
2. **ALWAYS attribute both sides.** Every contradicting claim must cite its source inline: `per [[source-a]] (2026-01-15)` / `per [[source-b]] (2026-04-08)`. No dates, no attribution = no contradiction record.
3. **ALWAYS preserve history.** The old claim stays — either in the page (marked as superseded) or in the raw archive. Never erased.
4. **ALWAYS date both claims.** Contradictions without dates are un-resolvable — the reader can't tell which is newer or why the change happened.

**The four resolution patterns — pick one per contradiction:**

| Pattern | When to use | How it looks |
|---|---|---|
| **Both stand (`^[ambiguous]`)** | Sources disagree, neither is clearly authoritative, you can't resolve it yourself | `The gateway uses SQLite ^[ambiguous] — per [[amol-interview]] (2026-04-08) it was rewritten to Postgres, but per [[daemion-architecture]] (2026-03-30) SQLite is the source of truth. Unresolved.` |
| **Explicit supersession** | New source is authoritative (primary, recent, trusted) AND you're confident the old claim is now wrong | `Previously, jobs ran via cron chaining (per [[old-engine-design]], 2026-02-14). As of 2026-04-08 this was revised: agents now self-schedule via earned-trust signals (per [[amol-interview]]). The cron approach is deprecated.` |
| **Both-are-true / scoped** | The contradiction dissolves under scoping — both claims are correct in different contexts | `For [[public-scope]] pages, wikilinks resolve by basename (per [[wiki-spec]]). For [[personal-scope]] agent wikis, the resolver also checks the agent's local folder first (per [[per-agent-wiki-design]]).` |
| **Escalate to user** | Stakes are high (architecture, user preferences, project priorities) and you genuinely don't know | Stop. Ask. Do not pick a side on the user's behalf. |

**When to escalate instead of resolving yourself:**

- Architecture decisions that affect multiple extensions or substrates
- User preferences or working-style claims (you are not the authority on what Jordan wants)
- Project priorities or roadmap items
- Cross-agent claims (one agent says X about another agent)
- Any contradiction where picking the wrong side would cause real work to be redone

For low-stakes contradictions (terminology, historical details, non-load-bearing facts), use `^[ambiguous]` and keep moving.

**Within a single compile pass:**

If a single source contradicts itself (the speaker changed their mind mid-interview, the doc has two versions of the same fact), BOTH versions get documented with timestamps/chapter markers: `early in the interview [[amol-interview|Amol]] said X ([00:14]), then revised to Y ([01:32])`. That revision IS the knowledge — don't flatten it.

**Cross-scope contradictions:**

If a `personal` claim contradicts a `public` claim, the `personal` scope wins for that agent's view but the `public` page stays unchanged. Add a personal note: `Daemion's personal take: Y, which contradicts the public [[page-x]] claim that X. Reason: [context].` Do NOT edit the public page based on personal context.

**Integration with lint:**

The `possible-contradiction` lint check (info-level) flags keyword matches like "contradicts", "superseded by", "no longer true", "actually wrong", "disagrees with", "instead of what". When lint flags one:

1. Read the full surrounding context (not just the matched line)
2. Classify: is it a real contradiction, a historical note, or a false positive?
3. If real: ensure both claims are attributed and dated, pick a resolution pattern
4. If historical (something was true and isn't anymore): use explicit supersession
5. If false positive: leave a `^[note: not a contradiction, see context]` inline so future lint passes skip it

**What this protects against:**

- Agents confidently asserting stale facts because the wiki was silently overwritten
- Losing the "why we changed our mind" context that's often more valuable than the current answer
- Drift where the wiki slowly diverges from reality without anyone noticing
- Cross-agent confusion when agents with different experience histories edit the same page

**The test:** if you can't reconstruct "what did we believe on date X and why did we change our mind" from the wiki, your contradiction handling failed.

### Wikilinks — THE CORE OF THE WIKI

**Dense inline linking is non-negotiable.** A wiki page with 2-3 links at the bottom isn't a wiki page — it's an essay with a footer. The graph structure IS the knowledge. If you write "the autoresearch loop uses a fitness signal," both `autoresearch` and `fitness signal` should be wikilinks if they have (or could have) pages.

**Rules for writing a page:**

1. **5-15 inline links per page minimum.** Lint warns below 5. Aim for 10+ on substantive pages.
2. **Link in the body, not just Related.** The Related footer is a supplement for pages the body didn't naturally reach. If every Related link already appears inline, delete the footer.
3. **Link named concepts on first mention.** When a named concept (RLM, Pi SDK, edit-measure-keep-revert, gateway, cron trigger, etc.) appears in your prose, link it — even if the target doesn't exist yet.
4. **Broken links are encouraged as TODOs.** Lint treats them as info, not errors. A `[[concept-that-doesnt-exist-yet]]` is a note to write that page later. This is the Karpathy pattern: link forward, write backward.
5. **Pipe syntax for natural reading.** `[[vision|the autoresearch loop]]` keeps prose flowing while still linking. Use it when the slug is ugly in-text.
6. **Introspect while writing.** After every paragraph, ask: "What else in the wiki talks about this? Am I linking it?" That pause IS the deep-thinking step. If you skip it, you're transcribing, not synthesizing.
7. **Backwards-linking pass — MANDATORY before finishing a new page.** Dense *outbound* links (steps 1-6) are not enough on their own. A new page that only links outward to existing pages but has zero inbound links is an orphan — it joins the graph from one side but nothing in the graph points back to it. Lint flags this as `orphaned-page`. Before you consider a new page done, you do a backwards pass: for every existing page that's topically related, edit that page to add a link to the new one. This is what "the graph structure IS the knowledge" means in practice — graph edges are bidirectional or they're not edges. The extra 5 minutes to update 2-3 related existing pages is the difference between "a page I wrote" and "a page the wiki knows about."

**Bad — sparse:**
```markdown
Autoresearch applies the edit-measure-keep-revert loop to any system with a fitness signal. For Daemion, the editable asset is job prompts.

Related: [[vision]]
```

**Good — dense:**
```markdown
[[vision|Autoresearch]] applies the [[edit-measure-keep-revert]] loop to any system with a [[measurement-first|measurable fitness signal]]. For Daemion, the editable asset is [[autoresearch-jobs|job prompts]] — stored in the [[extension-system|extensions table]], rewritable at runtime by agents, and cycled through the [[job-scheduler|cron trigger]] on a schedule.
```

Four links in the dense version vs. one in the sparse. Every one of those links tells the reader where to go next.

### Wikilink mechanics

Use `[[page-slug]]` to link between pages. The slug is the **basename** of the file (filename without `.md`, no folder path). Links resolve by basename anywhere in the tree — moving a page between folders does NOT break links.

```markdown
From anywhere in the wiki:
  See [[gateway-architecture]] for the HTTP server layout.
  Jordan's take: [[feedback-patterns]].
  Background: [[karpathy-llm-wiki-pattern]].
```

**Slug uniqueness is required.** Two files can't share a basename even in different folders. If you need the same short name in two projects, disambiguate (e.g. `daemion-storage-schema` vs `pi-storage-schema`). Lint catches collisions.

### Where does a new page go?

Pick by what the page is *about*, not by scope:

| If the page is about... | Put it in... | Scope becomes |
|---|---|---|
| A collaborator you work with (Jordan, other internal agents, team members) — preferences, working style, PII | `people/<name>/` | `personal` |
| An **external source entity** — a public figure, author, podcast guest you're attributing claims to | `people/<name>/` | `public` |
| A specific project (architecture, decisions, components) | `projects/<name>/` | `project/<name>` |
| A general domain/concept (no person or project) | `topics/<domain>/` | `public` |

**The `people/` folder holds TWO scopes.** Collaborator pages are `personal` (Jordan's preferences should not leak into public pages). Source-entity pages are `public` so public topic pages can attribute claims to them without violating scope. The folder is the same; the scope frontmatter distinguishes them. Lint enforces — a public topic page linking to `[[jordan]]` (personal) is a scope violation; linking to `[[amol-avisari]]` (public source entity) is fine.

**Source-entity pages** are how external attribution works. When you compile a substantive source (podcast guest, paper author, conference speaker), create a thin `people/<name>.md` page with scope `public` containing:
- Who they are (role, affiliation, why you're citing them)
- What sources of theirs are in the wiki (wikilinks to compiled content)
- Key claims you've attributed to them
- Dates — when did they say it, in what context

Then public topic pages can inline-attribute: *"per [[amol-avasare|Amol]] on [[lennys-podcast-amol]], exponential bet sizing beats incremental optimization in zero-to-one."* The link IS the attribution.

**Template:** see `references/source-entity-template.md` for the full frontmatter + section structure.

### The hosts-count-too rule

**Every non-trivial human voice in a source gets their own `people/<name>.md` page — NOT just the primary speaker.** This includes:

- **The guest / author / speaker** (the person making the substantive claims)
- **The interviewer / host / moderator** (their framing questions are their own knowledge — "what does Lenny think about PM roles after 500 interviews?" can only be answered if Lenny has a page that accumulates across episodes)
- **Any person cited 2+ times across the wiki** (Dario, Ben Mann, Mike Krieger, Army Vora — if they come up repeatedly in compiled sources, they get an entity page)
- **Co-authors of papers and talks** — each named author gets a page

Why hosts count: the interviewer's framing questions reveal *their* lens shaped by their entire interview history. Attributing only to the guest loses that knowledge. Over time, the host's page becomes a meta-source — "what recurring themes has this person surfaced across guests?" — which is only reconstructable if the host has been a first-class entity from day one.

**For a typical podcast interview:** expect to create TWO source-entity pages on first compile (host + guest), not one.

### The three-instance rule for non-human entities

**Do NOT create pages for publications, orgs, podcasts, shows, newsletters, companies, or any other non-human entity prospectively.** You attribute to the humans who speak for them; you wikilink to the raw file if you need to reference the specific episode/article. Creating `lennys-podcast.md` after one ingestion is speculative folder overhead — the `people/lenny-rachitsky.md` page + the raw file already answer every query you'd ask.

**Exception — the three-instance trigger:** create a non-human entity page ONLY when BOTH of these are true:
1. The same non-human entity is cited on **3+ wiki pages**
2. You find yourself wanting to write a page *about the entity itself* (its history, its stance, its recurring themes) — not just link to it

When the trigger fires: put the page in `people/` (not a new folder), add `entity_type: publication` (or `org`, `show`, `newsletter`) to the frontmatter, scope `public`. The folder name becomes slightly imprecise but the cost of accepting that is far lower than maintaining a parallel `sources/` or `orgs/` taxonomy.

**This is a one-way door — once created, the page stays. So require a strong signal before opening it.**

New collaborator → `people/<name>.md`, scope `personal`. New external source entity (human) → `people/<name>.md`, scope `public`. New project → `projects/<name>/`. New domain → `topics/<domain>/`. Non-human entities → nothing, until the three-instance rule fires. The folder structure grows with what you learn.

## Working With Other Agents' Knowledge

You can search across all agents:
```
GET /knowledge/search?q=<query>  (searches shared + all agents)
```

You can read another agent's public pages. You CANNOT write to another agent's wiki. If you observe something about another agent worth recording:
- Write it to YOUR wiki: "Observed that Pulse tends to X in situation Y"
- Or propose it to shared wiki if it's universal: "Pattern: agents perform better when Z"

## Directory Layout Reference

```
~/.daemion/
  knowledge/
    raw/                          # Immutable sources
      sessions/claude-code/       # Claude Code session extracts
      sessions/daemion/           # Daemion thread summaries
      sessions/pi/                # Pi session extracts
      links/                      # URL extractions
      videos/                     # Video transcripts
      files/                      # PDFs, images, docs
      .manifest.json              # Delta tracking (hashes)
    wiki/                         # SHARED wiki
      index.md                    # Master catalog (grouped by folder)
      log.md                      # Operation log
      people/                     # People you collaborate with (personal scope)
        <name>/                   # e.g. jordan/
          working-style.md
          feedback-patterns.md
      projects/                   # Projects you work on (project scope)
        <name>/                   # e.g. daemion/
          gateway-architecture.md
          extension-system.md
      topics/                     # Evergreen domain knowledge (public scope)
        <domain>/                 # e.g. knowledge-systems/, embeddings/
          karpathy-llm-wiki-pattern.md
    schema.md                     # Compiler grammar
  agents/
    {agent-name}/
      knowledge/                  # AGENT-PRIVATE wiki (same layout)
        index.md
        log.md
        people/ projects/ topics/
      daemion.yaml
      soul.md
      system.md
```

**The folder structure IS the navigation.** `ls projects/daemion/` shows everything you know about Daemion. `ls people/` shows everyone you work with. Adding a new person, project, or domain is creating a directory — no schema change, no config file.

## Scripts Reference

| Script | Purpose | Gateway equivalent |
|--------|---------|-------------------|
| `scripts/compile.ts` | Process raw/ → wiki/ | `POST /knowledge/compile` |
| `scripts/ingest-url.ts` | Fetch URL → raw/links/ | `POST /knowledge/ingest` |
| `scripts/lint.ts` | Health checks | `POST /knowledge/lint` |
| `scripts/rebuild-index.ts` | Regenerate index.md | (part of compile) |
| `scripts/search.ts` | Keyword search (offline) | `GET /knowledge/search` |
