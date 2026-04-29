#!/usr/bin/env npx tsx
/**
 * Rebuild index.md from wiki files
 *
 * Scans wiki directory, reads frontmatter from each page,
 * regenerates index.md with categorized entries.
 *
 * Usage:
 *   npx tsx rebuild-index.ts                   # Rebuild shared wiki index
 *   npx tsx rebuild-index.ts --agent daemion   # Rebuild agent's wiki index
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, basename, relative, dirname } from 'path';
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

interface PageEntry {
  slug: string;
  title: string;
  scope: string;
  summary: string;
  folder: string; // top-level folder (people/projects/topics) or '' for root
  subfolder: string; // e.g. 'jordan', 'daemion', 'knowledge-systems', or ''
}

function main(): void {
  const args = process.argv.slice(2);
  const agentIdx = args.indexOf('--agent');
  const agentId = agentIdx !== -1 ? args[agentIdx + 1] : null;

  const wikiDir = resolveWikiDir(agentId);
  if (!existsSync(wikiDir)) {
    console.error(`Wiki directory not found: ${wikiDir}`);
    process.exit(1);
  }

  const files = collectMdFiles(wikiDir);
  const pages: PageEntry[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const meta = parseFrontmatter(content);
    const slug = basename(file, '.md');
    const rel = relative(wikiDir, dirname(file)); // '' | 'people/jordan' | 'projects/daemion' | 'topics/knowledge-systems'
    const parts = rel ? rel.split(/[/\\]/) : [];
    const folder = parts[0] ?? '';
    const subfolder = parts.slice(1).join('/') || '';
    pages.push({
      slug,
      title: meta.title ?? slug,
      scope: meta.scope ?? 'personal',
      summary: meta.summary ?? '',
      folder,
      subfolder,
    });
  }

  // Group by folder → subfolder (e.g. people/jordan, projects/daemion, topics/knowledge-systems)
  // Root-level pages (no folder) go under "misc".
  const grouped = new Map<string, Map<string, PageEntry[]>>();
  for (const page of pages) {
    const top = page.folder || 'misc';
    if (!grouped.has(top)) grouped.set(top, new Map());
    const sub = page.subfolder || '_';
    const subMap = grouped.get(top)!;
    if (!subMap.has(sub)) subMap.set(sub, []);
    subMap.get(sub)!.push(page);
  }

  // Stable top-level order: people → projects → topics → misc
  const topOrder = ['people', 'projects', 'topics', 'misc'];
  const sortedTops = [...grouped.keys()].sort((a, b) => {
    const ai = topOrder.indexOf(a);
    const bi = topOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  // Build index
  const label = agentId ? `${agentId} Knowledge Index` : 'Knowledge Index';
  const lines: string[] = [`# ${label} (${pages.length} articles)`, ''];

  for (const top of sortedTops) {
    const subMap = grouped.get(top)!;
    const topCount = [...subMap.values()].reduce((n, arr) => n + arr.length, 0);
    lines.push(`## ${top} (${topCount})`);
    lines.push('');

    const sortedSubs = [...subMap.keys()].sort();
    for (const sub of sortedSubs) {
      const subPages = subMap.get(sub)!;
      if (sub !== '_') {
        lines.push(`### ${sub}`);
      }
      for (const page of subPages.sort((a, b) => a.title.localeCompare(b.title))) {
        const summary = page.summary ? ` — ${page.summary}` : '';
        lines.push(`- [[${page.slug}]]${summary}`);
      }
      lines.push('');
    }
  }

  const indexPath = join(wikiDir, 'index.md');
  writeFileSync(indexPath, lines.join('\n'), 'utf-8');
  console.log(JSON.stringify({ status: 'rebuilt', pages: pages.length, path: indexPath }));
}

main();
