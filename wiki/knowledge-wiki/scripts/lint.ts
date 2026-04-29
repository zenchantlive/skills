#!/usr/bin/env npx tsx
/**
 * Knowledge Wiki Lint
 *
 * Health checks for the wiki. Two tiers:
 * - Auto-fix: structural issues (broken links, index inconsistencies)
 * - Report-only: semantic issues (contradictions, staleness, orphans)
 *
 * Usage:
 *   npx tsx lint.ts                     # Lint shared wiki
 *   npx tsx lint.ts --agent daemion     # Lint agent's wiki
 *   npx tsx lint.ts --fix               # Auto-fix structural issues
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, basename, dirname } from 'path';
import { homedir } from 'os';
import { spawnSync } from 'child_process';

const DAEMION_DIR = join(homedir(), '.daemion');

function resolveGatewayToken(): string {
  if (process.env.DAEMION_TOKEN?.trim()) return process.env.DAEMION_TOKEN.trim();

  const homeTokenPath = join(homedir(), '.daemion', '.gateway-token');
  try {
    const token = readFileSync(homeTokenPath, 'utf-8').trim();
    if (token) return token;
  } catch {
    /* continue */
  }

  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    const candidate = join(dir, '.gateway-token');
    try {
      const token = readFileSync(candidate, 'utf-8').trim();
      if (token) return token;
    } catch {
      /* continue walking upward */
    }
    dir = dirname(dir);
  }

  return '';
}

interface LintIssue {
  severity: 'error' | 'warning' | 'info';
  type: string;
  page: string;
  message: string;
  autoFixable: boolean;
}

function resolveWikiDir(agentId?: string | null): string {
  if (!agentId) return join(DAEMION_DIR, 'knowledge', 'wiki');
  return join(DAEMION_DIR, 'agents', agentId, 'knowledge');
}

function collectMdFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full));
    } else if (
      entry.name.endsWith('.md') &&
      entry.name !== 'index.md' &&
      entry.name !== 'log.md' &&
      entry.name !== 'AGENTS.md' // folder-local operating contract, not a wiki page
    ) {
      results.push(full);
    }
  }
  return results;
}

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(content);
  if (!match) return { meta: {}, body: content };
  const meta: Record<string, string> = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val) meta[key] = val;
  }
  return { meta, body: match[2] ?? '' };
}

function extractWikilinks(text: string): string[] {
  const links: string[] = [];
  const pattern = /\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = pattern.exec(text)) !== null) links.push(m[1]!);
  return links;
}

// --- Semantic check helpers ---

// Concept glossary: terms that should link to specific slugs when mentioned in prose.
// Kept intentionally small and high-precision — only unambiguous aliases.
const CONCEPT_GLOSSARY: Record<string, string[]> = {
  'karpathy-llm-wiki-pattern': ['LLM Wiki', 'wiki pattern'],
  'compiled-knowledge-vs-rag': ['compiled knowledge'],
  'tiered-retrieval': ['tiered retrieval', 'retrieval ladder'],
  'claim-level-provenance': ['claim-level provenance', 'provenance drift'],
  'knowledge-substrate': ['knowledge substrate', 'knowledge wiki'],
  'gateway-architecture': ['gateway server', 'Daemion gateway'],
  'extension-system': ['extensions table', 'extensions-as-data'],
  'rlm-chat-substrate': ['RLM', 'Recursive LM'],
  'utcp-endpoint': ['/utcp endpoint'],
  'utcp-mechanics': ['UTCP manifest', 'anti-wrapper'],
  'landscape-2026': ['agent protocol landscape'],
  'orchestrator-worker': ['orchestrator-worker'],
  'vision': ['edit-measure-keep-revert', 'autoresearch loop'],
  'measurement-first': ['measurement problem'],
  'ecosystem-gap': ['close the feedback loop'],
  'substrate-taxonomy': ['kernel substrates', 'substrate doctrine'],
  'autoresearch-jobs': ['autoresearch jobs', 'autoresearch job'],
};

function scopeCompatible(fromScope: string, toScope: string): boolean {
  if (fromScope === 'public') return toScope === 'public';
  if (fromScope.startsWith('project/')) return toScope === 'public' || toScope === fromScope;
  return true;
}

// Contradiction heuristic: look for conflict keywords near a linked concept.
// Flags pages whose body contains phrases that suggest they disagree with another page.
const CONTRADICTION_KEYWORDS = ['contradicts', 'disagrees with', 'actually wrong', 'no longer true', 'superseded by', 'instead of what'];

function lint(wikiDir: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const files = collectMdFiles(wikiDir);
  const slugs = new Set(files.map((f) => basename(f, '.md')));
  const inboundLinks = new Map<string, string[]>();

  // Initialize inbound link tracking
  for (const slug of slugs) inboundLinks.set(slug, []);

  // Build a slug → scope map for cross-reference scope filtering
  const scopeMap = new Map<string, string>();
  for (const f of files) {
    const content = readFileSync(f, 'utf-8');
    const { meta } = parseFrontmatter(content);
    scopeMap.set(basename(f, '.md'), meta.scope ?? 'personal');
  }

  for (const file of files) {
    const slug = basename(file, '.md');
    const content = readFileSync(file, 'utf-8');
    const { meta, body } = parseFrontmatter(content);

    // Check: missing frontmatter fields
    if (!meta.title) {
      issues.push({ severity: 'warning', type: 'missing-title', page: slug, message: 'Missing title in frontmatter', autoFixable: false });
    }
    if (!meta.scope) {
      issues.push({ severity: 'warning', type: 'missing-scope', page: slug, message: 'Missing scope in frontmatter', autoFixable: false });
    }
    if (!meta.summary) {
      issues.push({ severity: 'warning', type: 'missing-summary', page: slug, message: 'Missing summary in frontmatter (needed for index)', autoFixable: false });
    }

    // Word count up front — used by both sparse-content and sparse-linking checks
    const wordCount = body.split(/\s+/).filter((w) => w.length > 0).length;

    // Check: sparse content
    if (wordCount < 30) {
      issues.push({ severity: 'info', type: 'sparse-content', page: slug, message: `Only ${wordCount} words — consider expanding or merging`, autoFixable: false });
    }

    // Check: wikilinks — broken links become info-level TODOs (Karpathy pattern: write forward)
    const rawLinks = extractWikilinks(body);
    const targetSlugs = rawLinks.map((l) => l.split('|')[0]!.trim());
    const bodyLinkCount = targetSlugs.length;

    for (const targetSlug of targetSlugs) {
      if (!slugs.has(targetSlug)) {
        issues.push({ severity: 'info', type: 'todo-link', page: slug, message: `TODO: [[${targetSlug}]] — target page does not exist yet (forward link encouraged)`, autoFixable: false });
      } else {
        const existing = inboundLinks.get(targetSlug) ?? [];
        existing.push(slug);
        inboundLinks.set(targetSlug, existing);
      }
    }

    // Check: sparse linking (< 5 body wikilinks) — Karpathy pattern needs density
    if (bodyLinkCount < 5 && wordCount >= 100) {
      issues.push({
        severity: 'warning',
        type: 'sparse-linking',
        page: slug,
        message: `Only ${bodyLinkCount} body wikilinks — aim for 5-15 inline links per page. The graph structure IS the knowledge.`,
        autoFixable: false,
      });
    }

    // Check: scope violations (public linking to non-public) — use resolved targetSlugs
    if (meta.scope === 'public') {
      for (const targetSlug of targetSlugs) {
        const targetFile = files.find((f) => basename(f, '.md') === targetSlug);
        if (targetFile) {
          const targetMeta = parseFrontmatter(readFileSync(targetFile, 'utf-8')).meta;
          if (targetMeta.scope && targetMeta.scope !== 'public') {
            issues.push({ severity: 'error', type: 'scope-violation', page: slug, message: `Public page links to ${targetMeta.scope} page: [[${targetSlug}]]`, autoFixable: false });
          }
        }
      }
    }

    // Check: provenance drift (inferred content >60%)
    const lines = body.split('\n').filter((l) => l.trim().length > 0);
    const inferredLines = lines.filter((l) => l.includes('^[inferred]') || l.includes('^[ambiguous]'));
    if (lines.length > 5 && inferredLines.length / lines.length > 0.6) {
      issues.push({ severity: 'warning', type: 'provenance-drift', page: slug, message: `${Math.round(inferredLines.length / lines.length * 100)}% inferred/ambiguous content — needs more source grounding`, autoFixable: false });
    }

    // Check: staleness — provenance captured-date older than 180 days + body claims current state
    const capturedMatch = content.match(/captured:\s*(\d{4}-\d{2}-\d{2})/);
    if (capturedMatch) {
      const capturedDate = new Date(capturedMatch[1]!);
      const ageDays = (Date.now() - capturedDate.getTime()) / (1000 * 60 * 60 * 24);
      const claimsCurrent = /\b(currently|today|at the time of|as of|right now|presently)\b/i.test(body);
      if (ageDays > 180 && claimsCurrent) {
        issues.push({
          severity: 'warning',
          type: 'stale-claim',
          page: slug,
          message: `Source captured ${Math.round(ageDays)}d ago but body claims current state — verify still accurate`,
          autoFixable: false,
        });
      }
    }

    // Check: cross-reference gaps — glossary terms mentioned in prose without wikilink
    const linkedSet = new Set(targetSlugs);
    for (const [targetSlug, phrases] of Object.entries(CONCEPT_GLOSSARY)) {
      if (targetSlug === slug) continue;
      if (linkedSet.has(targetSlug)) continue;
      if (!slugs.has(targetSlug)) continue;
      const targetScope = scopeMap.get(targetSlug) ?? 'personal';
      if (!scopeCompatible(meta.scope ?? 'personal', targetScope)) continue;
      for (const phrase of phrases) {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
        if (pattern.test(body)) {
          issues.push({
            severity: 'info',
            type: 'missing-cross-reference',
            page: slug,
            message: `Mentions "${phrase}" in prose but doesn't link to [[${targetSlug}]]`,
            autoFixable: false,
          });
          break; // one flag per target slug
        }
      }
    }

    // Check: contradiction heuristic — conflict keywords near a wikilink suggest disagreement
    for (const keyword of CONTRADICTION_KEYWORDS) {
      const idx = body.toLowerCase().indexOf(keyword);
      if (idx === -1) continue;
      // Look for a wikilink within 80 chars before or after
      const window = body.slice(Math.max(0, idx - 80), Math.min(body.length, idx + 80 + keyword.length));
      const linkMatch = /\[\[([^\]]+)\]\]/.exec(window);
      if (linkMatch) {
        issues.push({
          severity: 'info',
          type: 'possible-contradiction',
          page: slug,
          message: `"${keyword}" near [[${linkMatch[1]!.split('|')[0]}]] — possible contradiction, review`,
          autoFixable: false,
        });
        break; // one per page
      }
    }
  }

  // Check: orphaned pages (no inbound links)
  for (const [slug, sources] of inboundLinks) {
    if (sources.length === 0) {
      issues.push({ severity: 'info', type: 'orphaned-page', page: slug, message: 'No inbound wikilinks — page is disconnected', autoFixable: false });
    }
  }

  // Check: index consistency
  const indexPath = join(wikiDir, 'index.md');
  if (existsSync(indexPath)) {
    const indexContent = readFileSync(indexPath, 'utf-8');
    const indexedSlugs = new Set(extractWikilinks(indexContent));

    for (const slug of slugs) {
      if (!indexedSlugs.has(slug)) {
        issues.push({ severity: 'warning', type: 'missing-from-index', page: slug, message: 'Page exists but not listed in index.md', autoFixable: true });
      }
    }
    for (const slug of indexedSlugs) {
      if (!slugs.has(slug)) {
        issues.push({ severity: 'warning', type: 'index-ghost', page: slug, message: 'Listed in index.md but page does not exist', autoFixable: true });
      }
    }
  }

  return issues;
}

/**
 * Sync the wiki's index.md and FTS5 index after any content change.
 *
 * Two sub-ops:
 *   1. Rebuild index.md via rebuild-index.ts (always runs, pure-TS, no gateway)
 *   2. Sync FTS5 via POST /knowledge/compile (only if the gateway is up)
 *
 * Returns a status object describing what ran. Stale FTS5 is reported as a
 * warning rather than a failure — the wiki files themselves are still valid.
 *
 * This runs at the END of lint so that "run lint after any write" is the one
 * rule an agent needs to remember. The lint pass validates content; this sync
 * step makes the index/search layer reflect those contents.
 */
function syncAfterLint(skipSync: boolean): {
  indexRebuilt: boolean;
  indexPages: number | null;
  fts: 'synced' | 'skipped' | 'gateway_down' | 'token_missing' | 'auth_failed' | 'error';
  ftsStats?: unknown;
  warning?: string;
} {
  if (skipSync) {
    return { indexRebuilt: false, indexPages: null, fts: 'skipped' };
  }

  // 1. Rebuild index.md via the existing script. Always runs.
  const scriptsDir = join(homedir(), '.daemion', 'skills', 'knowledge-wiki', 'scripts');
  const rebuildScript = join(scriptsDir, 'rebuild-index.ts');
  let indexRebuilt = false;
  let indexPages: number | null = null;
  try {
    const result = spawnSync('npx', ['tsx', rebuildScript], { encoding: 'utf-8' });
    if (result.status === 0 && result.stdout) {
      indexRebuilt = true;
      const parsed = JSON.parse(result.stdout.trim()) as { pages?: number };
      indexPages = parsed.pages ?? null;
    }
  } catch {
    // Silent — rebuild-index is best effort.
  }

  // 2. Sync FTS5 via gateway /knowledge/compile. Only runs if gateway is up.
  const gatewayUrl = process.env.DAEMION_GATEWAY_URL ?? 'http://localhost:3001';
  const token = resolveGatewayToken();

  // Probe gateway with a short-timeout health check first.
  const health = spawnSync('curl', ['-s', '-m', '1', '--fail', `${gatewayUrl}/health`], {
    encoding: 'utf-8',
  });
  if (health.status !== 0) {
    return {
      indexRebuilt,
      indexPages,
      fts: 'gateway_down',
      warning:
        'Gateway is not running — FTS5 index was NOT synced. Wiki files are valid but knowledge_search may return stale results. Start the gateway (`npm run gateway` in the Daemion repo) and re-run lint to sync.',
    };
  }

  if (!token) {
    return {
      indexRebuilt,
      indexPages,
      fts: 'token_missing',
      warning:
        'Gateway is up, but no auth token was found. Check `DAEMION_TOKEN` or restore `~/.daemion/.gateway-token`. If the gateway is already running but the file is gone, restart it to recreate the companion auth files before re-running lint.',
    };
  }

  // Gateway is up — POST to /knowledge/compile with the token.
  const compile = spawnSync(
    'curl',
    [
      '-s',
      '-m',
      '5',
      '-X',
      'POST',
      '-H',
      `Authorization: Bearer ${token}`,
      `${gatewayUrl}/knowledge/compile`,
    ],
    { encoding: 'utf-8' },
  );

  if (compile.status !== 0 || !compile.stdout) {
    return {
      indexRebuilt,
      indexPages,
      fts: 'error',
      warning: 'Gateway compile call failed — FTS5 may be stale.',
    };
  }

  try {
    const parsed = JSON.parse(compile.stdout) as {
      error?: string;
      sync?: unknown;
      scopeViolations?: unknown[];
    };
    if (parsed.error === 'unauthorized') {
      return {
        indexRebuilt,
        indexPages,
        fts: 'auth_failed',
        warning:
          'Gateway rejected the auth token — FTS5 NOT synced. Check ~/.daemion/.gateway-token matches the running gateway.',
      };
    }
    return { indexRebuilt, indexPages, fts: 'synced', ftsStats: parsed.sync };
  } catch {
    return { indexRebuilt, indexPages, fts: 'error', warning: 'Gateway returned invalid JSON.' };
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const agentIdx = args.indexOf('--agent');
  const agentId = agentIdx !== -1 ? args[agentIdx + 1] : null;
  const fix = args.includes('--fix');
  // --no-sync skips the index rebuild + FTS5 sync at the end. Use only when
  // you want a pure validation pass without touching the index layer.
  const skipSync = args.includes('--no-sync');

  const wikiDir = resolveWikiDir(agentId);

  if (!existsSync(wikiDir)) {
    console.log(JSON.stringify({ status: 'no_wiki', agentId, issues: [] }));
    return;
  }

  const issues = lint(wikiDir);

  // Run index rebuild + FTS sync AFTER lint validation. This is the whole
  // point: "run lint after every write" is the one rule agents need to remember,
  // and this step makes sure the index/search layer reflects the write.
  // Only runs for the shared wiki (agent wikis each have their own FTS namespace
  // but the gateway /knowledge/compile endpoint is shared-wiki scoped for now).
  const syncResult = !agentId ? syncAfterLint(skipSync) : { indexRebuilt: false, indexPages: null, fts: 'skipped' as const };

  if (fix) {
    const autoFixable = issues.filter((i) => i.autoFixable);
    // For now, report what would be fixed — actual auto-fix is a future enhancement
    console.log(JSON.stringify({
      status: 'lint_complete',
      agentId: agentId ?? 'shared',
      total: issues.length,
      autoFixable: autoFixable.length,
      reportOnly: issues.length - autoFixable.length,
      issues,
      sync: syncResult,
    }, null, 2));
  } else {
    console.log(JSON.stringify({
      status: 'lint_complete',
      agentId: agentId ?? 'shared',
      total: issues.length,
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
      info: issues.filter((i) => i.severity === 'info').length,
      issues,
      sync: syncResult,
    }, null, 2));
  }

  // If the FTS sync failed (gateway down, auth, etc.) print the warning to
  // stderr so it's visible even if the JSON gets piped elsewhere. Non-blocking.
  if (syncResult.warning) {
    console.error(`\n⚠️  ${syncResult.warning}`);
  }
}

main();
