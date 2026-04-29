#!/usr/bin/env npx tsx
/**
 * Content Ingestion — Main Entry Point
 *
 * Takes a URL, YouTube link, or local file path and writes it to
 * ~/.daemion/knowledge/raw/ as a markdown file with frontmatter.
 *
 * Idempotent via source_hash (SHA-256 of content, first 8 chars).
 * Hand-off to ~/.daemion/skills/knowledge-wiki/ for compilation.
 *
 * Usage:
 *   ingest.ts <url-or-path>
 *   ingest.ts --file batch.txt
 *   ingest.ts --dry-run <url>
 *   ingest.ts --category videos <url>
 *   ingest.ts --confidence high <url>
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const DAEMION = join(homedir(), '.daemion');
const RAW = join(DAEMION, 'knowledge', 'raw');
const SCRIPTS = dirname(new URL(import.meta.url).pathname);

type Confidence = 'high' | 'medium' | 'low';
type Category = 'links' | 'videos' | 'files' | 'sessions/claude-code' | 'sessions/daemion' | 'sessions/pi';

interface Args {
  sources: string[];
  batchFile: string | null;
  dryRun: boolean;
  category: Category | null;
  confidence: Confidence;
}

interface ExtractionResult {
  title: string;
  url: string;
  content: string;
  metadata: Record<string, unknown>;
  source: 'url' | 'video' | 'file' | 'manual';
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    sources: [],
    batchFile: null,
    dryRun: false,
    category: null,
    confidence: 'medium',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--file') args.batchFile = argv[++i] ?? null;
    else if (a === '--category') args.category = (argv[++i] ?? null) as Category | null;
    else if (a === '--confidence') args.confidence = (argv[++i] as Confidence) ?? 'medium';
    else if (a.startsWith('--')) throw new Error(`Unknown flag: ${a}`);
    else args.sources.push(a);
  }
  return args;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

function detectSourceType(input: string): 'file' | 'video' | 'url' {
  const stripped = input.replace(/^file:\/\//, '');
  if (existsSync(resolve(stripped.replace(/^~/, homedir())))) return 'file';
  if (/youtube\.com|youtu\.be/.test(input)) return 'video';
  return 'url';
}

function detectCategory(type: 'file' | 'video' | 'url', override: Category | null): Category {
  if (override) return override;
  if (type === 'file') return 'files';
  if (type === 'video') return 'videos';
  return 'links';
}

function runExtractor(script: string, target: string): ExtractionResult {
  const scriptPath = join(SCRIPTS, script);
  const res = spawnSync('bash', [scriptPath, target], { encoding: 'utf-8' });
  if (res.status !== 0) {
    throw new Error(`Extractor ${script} failed: ${res.stderr}`);
  }
  const json = JSON.parse(res.stdout) as ExtractionResult;
  if (!json.content || json.content.trim().length === 0) {
    throw new Error(`Extractor ${script} returned empty content`);
  }
  return json;
}

function alreadyIngested(hash: string): string | null {
  if (!existsSync(RAW)) return null;
  const queue: string[] = [RAW];
  while (queue.length > 0) {
    const dir = queue.shift()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
      } else if (entry.name.endsWith('.md')) {
        const body = readFileSync(full, 'utf-8');
        if (body.includes(`source_hash: ${hash}`)) return full;
      }
    }
  }
  return null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildFrontmatter(
  result: ExtractionResult,
  confidence: Confidence,
  hash: string,
  capturedAt: string,
): string {
  const meta = result.metadata ?? {};
  const lines = [
    '---',
    `source: ${result.source}`,
    `ref: ${result.url}`,
    `title: ${JSON.stringify(result.title)}`,
    `captured: ${capturedAt}`,
    `source_hash: ${hash}`,
    `confidence: ${confidence}`,
  ];
  for (const [k, v] of Object.entries(meta)) {
    if (v == null || v === '') continue;
    lines.push(`${k}: ${JSON.stringify(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function writeRaw(
  category: Category,
  slug: string,
  frontmatter: string,
  content: string,
  dryRun: boolean,
): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const filename = `${date}-${slug}.md`;
  const dir = join(RAW, category);
  const path = join(dir, filename);

  if (dryRun) {
    return `[dry-run] would write ${path} (${content.length} chars)`;
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(path, frontmatter + content, 'utf-8');
  return path;
}

interface IngestResult {
  source: string;
  status: 'written' | 'skipped' | 'failed';
  path?: string;
  reason?: string;
}

function ingestOne(target: string, args: Args): IngestResult {
  try {
    const type = detectSourceType(target);
    const script =
      type === 'file' ? 'extract-file.sh'
      : type === 'video' ? 'extract-youtube.sh'
      : 'extract-url.sh';

    const extraction = runExtractor(script, target);
    const hash = hashContent(extraction.content);

    const existing = alreadyIngested(hash);
    if (existing) {
      return {
        source: target,
        status: 'skipped',
        reason: `already ingested at ${existing}`,
      };
    }

    const category = detectCategory(type, args.category);
    const slug = slugify(extraction.title || basename(target));
    const capturedAt = new Date().toISOString();
    const frontmatter = buildFrontmatter(extraction, args.confidence, hash, capturedAt);

    const path = writeRaw(category, slug, frontmatter, extraction.content, args.dryRun);
    return { source: target, status: 'written', path };
  } catch (err) {
    return {
      source: target,
      status: 'failed',
      reason: (err as Error).message,
    };
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  let sources: string[] = args.sources;
  if (args.batchFile) {
    const lines = readFileSync(args.batchFile, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    sources = [...sources, ...lines];
  }

  if (sources.length === 0) {
    console.error('Usage: ingest.ts <url-or-path> [...]');
    console.error('       ingest.ts --file batch.txt');
    console.error('Flags: --dry-run, --category <cat>, --confidence high|medium|low');
    process.exit(1);
  }

  const results: IngestResult[] = [];
  for (const source of sources) {
    console.error(`→ ${source}`);
    const result = ingestOne(source, args);
    results.push(result);
    const icon = result.status === 'written' ? '✓' : result.status === 'skipped' ? '—' : '✗';
    console.error(`  ${icon} ${result.status}${result.reason ? `: ${result.reason}` : ''}${result.path ? ` (${result.path})` : ''}`);
  }

  const written = results.filter((r) => r.status === 'written').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  const writtenPaths = results
    .filter((r) => r.status === 'written' && r.path && !r.path.startsWith('[dry-run]'))
    .map((r) => r.path!);

  console.log(JSON.stringify({
    total: results.length,
    written,
    skipped,
    failed,
    results,
  }, null, 2));

  if (writtenPaths.length > 0) {
    console.log('');
    console.log('================================================================');
    console.log('⚠️  EXTRACTION COMPLETE — YOU ARE NOT DONE');
    console.log('================================================================');
    console.log('Writing to raw/ is step 1 of 2. The content is NOT in the wiki.');
    console.log('You MUST now do the following before reporting success:');
    console.log('');
    console.log('  1. READ COLD — read each raw file with NO reference to existing');
    console.log('     wiki pages. Extract 8-15 distinct clusters per substantive');
    console.log('     source. Do NOT keyword-filter against existing topics.');
    console.log('');
    for (const p of writtenPaths) {
      console.log(`     cat "${p}"`);
    }
    console.log('');
    console.log('  2. MAP WARM — only after reading cold, check existing wiki for');
    console.log('     overlaps. Decide: new page, extend existing, or archive only.');
    console.log('     DEFAULT to extending existing pages. A 2-hour podcast should');
    console.log('     produce AT MOST 3 new pages + updates to existing.');
    console.log('');
    console.log('  3. DECIDE placement yourself — do NOT ask the user "where should');
    console.log('     this go?" You are the librarian. The user decides SIGNAL');
    console.log('     (what matters). You decide STRUCTURE (where it lives).');
    console.log('');
    console.log('  4. PROPOSE a DECIDED plan to the user — not open questions.');
    console.log('     "Here is what I will write: [list]. Stop me if wrong."');
    console.log('');
    console.log('  5. WRITE the pages with inline attribution to named sources');
    console.log('     and provenance frontmatter pointing at the raw file.');
    console.log('');
    console.log('  6. LINT after every write:');
    console.log('     npx tsx ~/.daemion/skills/knowledge-wiki/scripts/lint.ts');
    console.log('');
    console.log('Reporting "ingested successfully" or "added to the wiki" after');
    console.log('extraction alone is a SKILL VIOLATION. The content lives in raw/,');
    console.log('not in the wiki. Your task continues until compile is complete.');
    console.log('================================================================');
  }

  if (failed > 0 && written === 0 && skipped === 0) process.exit(1);
}

main();
