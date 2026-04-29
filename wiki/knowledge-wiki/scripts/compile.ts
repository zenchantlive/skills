#!/usr/bin/env npx tsx
/**
 * Knowledge Wiki Compiler
 *
 * Processes raw sources into wiki pages. This is the expensive LLM operation.
 * Reads unprocessed raw/ files, extracts knowledge, creates/updates wiki pages,
 * updates index.md and log.md.
 *
 * Usage:
 *   npx tsx compile.ts                      # Compile shared wiki from raw/
 *   npx tsx compile.ts --agent daemion      # Compile agent's wiki
 *   npx tsx compile.ts --dry-run            # Show what would be compiled without writing
 *
 * This script is meant to be called by the gateway (POST /knowledge/compile)
 * or manually. It does NOT call the LLM directly — it prepares the compilation
 * context and outputs instructions for the calling agent to execute.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const DAEMION_DIR = join(homedir(), '.daemion');
const KNOWLEDGE_DIR = join(DAEMION_DIR, 'knowledge');
const RAW_DIR = join(KNOWLEDGE_DIR, 'raw');
const MANIFEST_PATH = join(RAW_DIR, '.manifest.json');

interface ManifestEntry {
  file: string;
  hash: string;
  compiledAt: string | null;
  wikiPages: string[];
}

interface Manifest {
  entries: Record<string, ManifestEntry>;
  lastCompile: string | null;
}

function loadManifest(): Manifest {
  if (existsSync(MANIFEST_PATH)) {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as Manifest;
  }
  return { entries: {}, lastCompile: null };
}

function saveManifest(manifest: Manifest): void {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
}

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path, 'utf-8')).digest('hex').slice(0, 12);
}

function collectRawFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectRawFiles(full));
    } else if (entry.name.endsWith('.md') && entry.name !== '.manifest.json') {
      results.push(full);
    }
  }
  return results;
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const agentIdx = args.indexOf('--agent');
  const agentId = agentIdx !== -1 ? args[agentIdx + 1] : null;

  const wikiDir = agentId
    ? join(DAEMION_DIR, 'agents', agentId, 'knowledge')
    : join(KNOWLEDGE_DIR, 'wiki');

  if (!existsSync(wikiDir)) {
    mkdirSync(wikiDir, { recursive: true });
  }

  const manifest = loadManifest();
  const rawFiles = collectRawFiles(RAW_DIR);

  // Find new or changed raw files
  const pending: Array<{ file: string; relativePath: string; hash: string; content: string }> = [];

  for (const file of rawFiles) {
    const relativePath = file.replace(RAW_DIR + '/', '');
    const hash = hashFile(file);
    const existing = manifest.entries[relativePath];

    if (existing && existing.hash === hash && existing.compiledAt) {
      continue; // Already compiled, unchanged
    }

    pending.push({
      file,
      relativePath,
      hash,
      content: readFileSync(file, 'utf-8'),
    });
  }

  if (pending.length === 0) {
    console.log(JSON.stringify({ status: 'nothing_to_compile', pending: 0 }));
    return;
  }

  if (dryRun) {
    console.log(JSON.stringify({
      status: 'dry_run',
      pending: pending.length,
      files: pending.map((p) => p.relativePath),
    }, null, 2));
    return;
  }

  // Output the compilation context for the calling agent to process
  // The agent reads this, runs the 4-stage pipeline (extract → resolve → write), then
  // calls this script again with --mark-compiled to update the manifest
  const indexPath = join(wikiDir, 'index.md');
  const indexContent = existsSync(indexPath) ? readFileSync(indexPath, 'utf-8') : '(empty)';

  console.log(JSON.stringify({
    status: 'ready_to_compile',
    pending: pending.length,
    wikiDir,
    agentId: agentId ?? 'shared',
    currentIndex: indexContent,
    sources: pending.map((p) => ({
      relativePath: p.relativePath,
      hash: p.hash,
      content: p.content,
    })),
  }, null, 2));

  // Update manifest with pending entries (compiledAt stays null until agent confirms)
  for (const p of pending) {
    manifest.entries[p.relativePath] = {
      file: p.relativePath,
      hash: p.hash,
      compiledAt: null,
      wikiPages: [],
    };
  }
  saveManifest(manifest);
}

// --mark-compiled <relativePath> <wikiPages...>
// Called after the agent finishes compiling a source
if (process.argv.includes('--mark-compiled')) {
  const idx = process.argv.indexOf('--mark-compiled');
  const relativePath = process.argv[idx + 1];
  const wikiPages = process.argv.slice(idx + 2);

  if (relativePath) {
    const manifest = loadManifest();
    const entry = manifest.entries[relativePath];
    if (entry) {
      entry.compiledAt = new Date().toISOString();
      entry.wikiPages = wikiPages;
      manifest.lastCompile = new Date().toISOString();
      saveManifest(manifest);
      console.log(JSON.stringify({ status: 'marked', relativePath, wikiPages }));
    }
  }
} else {
  main();
}
