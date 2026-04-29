---
purpose: Template for people/<name>.md source-entity pages
applies_to: Both collaborator pages (scope personal) and external source entities (scope public)
---

# Source-entity page template

Copy this structure when creating a new `people/<name>.md` page. The template supports three kinds of entity:

1. **Collaborator** — a human you work with (scope: `personal`)
2. **External source entity** — a public figure whose claims you attribute (scope: `public`)
3. **Non-human entity** — publication, org, podcast, show. Only when the three-instance rule fires. (scope: `public`, `entity_type: <kind>`)

---

## Frontmatter

```yaml
---
title: <Full name or canonical name>
scope: public              # or personal for collaborators
summary: "<Max 200 chars. Who they are, why they're cited, domain they speak to.>"
entity_type: person        # or: publication, org, show, newsletter — ONLY when the non-human three-instance rule fires
role: <Role or affiliation>
first_cited: 2026-04-08    # Date of first wiki citation
---
```

**Notes:**
- `entity_type: person` is the default and can be omitted for collaborators and external humans
- `entity_type: publication | org | show | newsletter` ONLY appears when a non-human gets promoted via the three-instance rule
- `first_cited` helps you tell "this page is new" from "this page has been around" — useful for lint's stale-claim check

---

## Body structure

```markdown
# <Name>

<One-line identity: role + affiliation + why they appear in this wiki.>

## Role and context

<2-4 sentences: background, current position, relevant history. Link to their primary affiliation org/project if that entity has a wiki page.>

## Sources in this wiki

<Wikilinks to every raw file that cites this person, plus date. This list grows with every new ingestion.>

- [[2026-04-08-head-of-growth-anthropic-claude-is-growing-itself-at-this-po]] — Lenny's Podcast interview, 2026-04-05
- (future entries go here as more sources are compiled)

## Recurring themes

<Topics this person speaks to repeatedly. Each theme links to the topic page where their views are captured. This section is the "what does X think about Y" index — starts empty on first compile, grows with subsequent sources.>

- **Growth under exponential product value** — see [[vision]], [[leaving-money-on-the-table]]
- **Role shifts under AI acceleration** — see [[engineers-as-mini-pms]]
- **Compiled org knowledge for agents** — see [[notebook-channels]]

## Notable claims and quotes

<Direct attributions, grouped by topic. Each claim cites its source file via wikilink. Use this section for claims that deserve preservation even if they never make it into a topic page.>

- *"70% of what I spend my time on is success disasters"* — [[2026-04-08-head-of-growth-anthropic-claude-is-growing-itself-at-this-po]] (Lenny's Podcast, 2026-04-05)
- *"Leave money on the table — that's actually the thing that's going to drive more growth long term"* — same source

## Related people

<Other entity pages connected to this one. Interviewers, co-authors, collaborators, people they frequently reference.>

- Interviewed by [[lenny-rachitsky]]
- Colleague of [[ben-mann]] (Anthropic co-founder)
- Mentions [[dario-amodei]]'s strategic framings repeatedly

---
```

## Rules for writing these pages

1. **Thin is fine.** A first-ingestion entity page may have only the frontmatter + role + one source cited. That's correct — it grows over time. Do NOT pad with speculation.

2. **No synthesis claims on the entity page.** The entity page aggregates what the person SAID; it doesn't synthesize what you THINK about them. Synthesis goes on topic pages with `^[inferred]` markers.

3. **Attribution to raw files, not to topic pages.** The "Sources in this wiki" section lists raw/ files, not wiki pages. The topic pages are where their claims show up — but the source of truth is raw/.

4. **Scope matters for linkability.**
   - Collaborator pages (`scope: personal`) CANNOT be linked from public topic pages without a scope violation
   - External-figure pages (`scope: public`) CAN be linked from public topic pages — this is the whole reason for the split
   - If you're attributing claims from an external figure on a public topic page, their entity page MUST be `scope: public`

5. **Update the page on every re-ingestion.** When a new source by or about this person is compiled, you MUST add it to "Sources in this wiki" and update "Recurring themes" if applicable. The page is a living index, not a one-shot document.

6. **For hosts/interviewers specifically**: the "Recurring themes" section should capture *their framing lenses*, not just claims they make. "What does Lenny consistently probe guests about across episodes?" is the unique value of a host entity page.

7. **Delete if the person never comes up again.** If you create an entity page and 6 months later it has exactly one inbound link and no meta-value, it's orphaned slop. Lint flags it; delete or archive.

## When to create one

See the "hosts-count-too rule" in `SKILL.md`. Every non-trivial human voice in a compiled source gets a page:
- Every named guest, author, speaker
- Every host, interviewer, moderator
- Every named co-author of a paper
- Every person cited 2+ times across existing wiki pages

For a typical podcast interview: expect to create TWO entity pages on first compile (guest + host), not one.

## When NOT to create one

- **Publications** (podcasts, newsletters, blogs) — never prospectively. Three-instance rule only.
- **Orgs** (companies, labs) — attribute to the humans who speak for them. Three-instance rule for the org page itself.
- **Shows/franchises** — same as publications.
- **Unnamed sources** ("an Anthropic spokesperson," "a senior engineer") — no entity page. Attribute to the raw file directly.
