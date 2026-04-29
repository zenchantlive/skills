#!/usr/bin/env npx tsx
/**
 * Knowledge Wiki Search (CLI)
 *
 * Searches wiki pages using simple keyword matching.
 * For FTS5 search via SQLite, use the gateway API: GET /knowledge/search?q=...
 *
 * This is a standalone fallback that works without the gateway running.
 *
 * Usage:
 *   npx tsx search.ts "query terms"
 *   npx tsx search.ts "query terms" --agent daemion
 *   npx tsx search.ts "query terms" --limit 10
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const DAEMION_DIR = join(homedir(), '.daemion');

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
    } else if (entry.name.endsWith('.md') && entry.name !== 'index.md' && entry.name !== 'log.md') {
      results.push(full);
    }
  }
  return results;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) return {};
  const meta: Record<string, string> = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val) meta[key] = val;
  }
  return meta;
}

interface SearchResult {
  slug: string;
  title: string;
  scope: string;
  summary: string;
  score: number;
}

function search(query: string, wikiDir: string, limit: number): SearchResult[] {
  const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (keywords.length === 0) return [];

  const files = collectMdFiles(wikiDir);
  const results: SearchResult[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const meta = parseFrontmatter(content);
    const searchText = `${meta.title ?? ''} ${meta.summary ?? ''} ${content}`.toLowerCase();

    let score = 0;
    for (const kw of keywords) {
      if (searchText.includes(kw)) score++;
    }

    if (score > 0) {
      results.push({
        slug: basename(file, '.md'),
        title: meta.title ?? basename(file, '.md'),
        scope: meta.scope ?? 'personal',
        summary: meta.summary ?? '',
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

function listAgentIds(): string[] {
  const agentsDir = join(DAEMION_DIR, 'agents');
  if (!existsSync(agentsDir)) return [];
  return readdirSync(agentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
}

function main(): void {
  const args = process.argv.slice(2);
  const query = args.find((a) => !a.startsWith('--'));
  const agentIdx = args.indexOf('--agent');
  const agentId = agentIdx !== -1 ? (args[agentIdx + 1] ?? null) : null;
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? '5', 10) : 5;

  if (!query) {
    console.error('Usage: npx tsx search.ts "query" [--agent name|*] [--limit N]');
    process.exit(1);
  }

  // Resolve which wikis to search
  const wikisToSearch: Array<{ id: string; dir: string }> = [];
  const warnings: string[] = [];

  if (agentId === '*') {
    // Search shared + every agent wiki
    wikisToSearch.push({ id: 'shared', dir: resolveWikiDir(null) });
    for (const id of listAgentIds()) {
      const dir = resolveWikiDir(id);
      if (existsSync(dir)) wikisToSearch.push({ id, dir });
    }
  } else if (agentId) {
    // Search specific agent wiki + shared
    const agentDir = resolveWikiDir(agentId);
    if (!existsSync(agentDir)) {
      warnings.push(`agent wiki '${agentId}' does not exist — only searching shared wiki`);
    } else {
      wikisToSearch.push({ id: agentId, dir: agentDir });
    }
    wikisToSearch.push({ id: 'shared', dir: resolveWikiDir(null) });
  } else {
    // Shared only
    wikisToSearch.push({ id: 'shared', dir: resolveWikiDir(null) });
  }

  // Search each wiki and merge
  const seen = new Set<string>();
  const merged: Array<SearchResult & { source: string }> = [];
  for (const { id, dir } of wikisToSearch) {
    for (const r of search(query, dir, limit)) {
      if (!seen.has(r.slug)) {
        seen.add(r.slug);
        merged.push({ ...r, source: id });
      }
    }
  }
  merged.sort((a, b) => b.score - a.score);

  console.log(JSON.stringify({
    query,
    agentId: agentId ?? 'shared',
    wikisSearched: wikisToSearch.map((w) => w.id),
    warnings: warnings.length > 0 ? warnings : undefined,
    results: merged.slice(0, limit),
    count: merged.length,
  }, null, 2));
}

main();
