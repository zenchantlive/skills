#!/usr/bin/env npx tsx
/**
 * URL Ingestion Script
 *
 * Fetches a URL, extracts readable content, writes to raw/links/.
 * The calling agent handles the interactive propose step — this script
 * just does the fetch and extraction.
 *
 * Usage:
 *   npx tsx ingest-url.ts <url> [--confidence high|medium|low]
 *
 * Output: JSON with extracted content and metadata.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const RAW_DIR = join(homedir(), '.daemion', 'knowledge', 'raw', 'links');

async function fetchAndExtract(url: string): Promise<{ title: string; content: string; url: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DaemionBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml,text/plain,text/markdown',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  // If it's already markdown or plain text, use as-is
  if (contentType.includes('text/plain') || contentType.includes('text/markdown')) {
    return { title: new URL(url).hostname, content: text, url };
  }

  // For HTML, do basic extraction: strip tags, keep text
  const title = extractTitle(text) ?? new URL(url).hostname;
  const body = stripHtml(text);

  return { title, content: body, url };
}

function extractTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? match[1]!.trim().replace(/\s+/g, ' ') : null;
}

function stripHtml(html: string): string {
  return html
    // Remove script/style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    // Convert some tags to markdown
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_m, level, text) => '#'.repeat(Number(level)) + ' ' + text.trim() + '\n\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Clean up entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith('--'));
  const confIdx = args.indexOf('--confidence');
  const confidence = (confIdx !== -1 ? args[confIdx + 1] : 'medium') as 'high' | 'medium' | 'low';

  if (!url) {
    console.error('Usage: npx tsx ingest-url.ts <url> [--confidence high|medium|low]');
    process.exit(1);
  }

  try {
    const extracted = await fetchAndExtract(url);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const hash = createHash('sha256').update(extracted.content).digest('hex').slice(0, 8);
    const slug = extracted.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);
    const filename = `${date}-${slug}.md`;

    if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR, { recursive: true });

    const filepath = join(RAW_DIR, filename);
    const frontmatter = [
      '---',
      'source: url',
      `ref: ${url}`,
      `captured: ${now.toISOString()}`,
      `source_hash: ${hash}`,
      `confidence: ${confidence}`,
      `title: "${extracted.title.replace(/"/g, '\\"')}"`,
      '---',
      '',
      `# ${extracted.title}`,
      '',
      `> Source: ${url}`,
      '',
      extracted.content,
    ].join('\n');

    writeFileSync(filepath, frontmatter, 'utf-8');

    console.log(JSON.stringify({
      status: 'ingested',
      filename,
      title: extracted.title,
      url,
      contentLength: extracted.content.length,
      hash,
      confidence,
    }));
  } catch (err) {
    console.error(JSON.stringify({
      status: 'error',
      url,
      error: err instanceof Error ? err.message : String(err),
    }));
    process.exit(1);
  }
}

main();
