import type { SearchChunk } from './types';

const OFFICIAL_SOURCE_HOSTS = new Set([
  'orijyu.com',
  'www.orijyu.com',
  'cn.orijyu.com',
  'orichin.com',
  'www.orichin.com',
  'origumi.jp',
  'www.origumi.jp',
  'oriho.com',
  'www.oriho.com',
]);

export interface AnswerSource {
  index: number;
  title: string;
  url?: string;
  key: string;
  score: number;
}

export function safeSourceUrl(value: unknown) {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const url = new URL(value.trim().replace(/[)>。、]+$/u, ''));
    if (url.protocol !== 'https:' || !OFFICIAL_SOURCE_HOSTS.has(url.hostname.toLowerCase())) return undefined;
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

function embeddedPageReference(text: string) {
  const matches = text.matchAll(
    /(?:^|\n)#{2,4}\s+([^\n]+)\n(?:公式ページ|物件詳細ページ|URL):\s*(https:\/\/[^\s]+)/gu,
  );
  for (const match of matches) {
    const title = match[1];
    const url = safeSourceUrl(match[2]);
    if (title && url) return { title: title.replace(/（続き\s*\d+）$/u, '').trim(), url };
  }

  const urlMatch = text.match(/(?:公式ページ|物件詳細ページ|URL):\s*(https:\/\/[^\s]+)/u);
  const url = safeSourceUrl(urlMatch?.[1]);
  return url ? { title: '', url } : undefined;
}

export function sourceFromChunk(chunk: SearchChunk, index: number): AnswerSource {
  const metadata = chunk.item.metadata || {};
  const embedded = embeddedPageReference(chunk.text || '');
  const metadataUrl = safeSourceUrl(metadata.source_url);
  const fallbackUrl = metadataUrl && new URL(metadataUrl).pathname !== '/' ? metadataUrl : undefined;
  return {
    index: index + 1,
    title: embedded?.title || String(metadata.title || metadata.filename || chunk.item.key.split('/').pop() || `資料 ${index + 1}`),
    url: embedded?.url || fallbackUrl,
    key: chunk.item.key,
    score: chunk.score,
  };
}

export function selectAnswerSources(answer: string, chunks: SearchChunk[], limit = 2) {
  const cited = Array.from(answer.matchAll(/\[(\d+)\]/gu), (match) => Number(match[1]) - 1)
    .filter((index, position, all) => index >= 0 && index < chunks.length && all.indexOf(index) === position);
  const candidates = [...cited, ...chunks.map((_, index) => index)]
    .filter((index, position, all) => all.indexOf(index) === position);
  const seen = new Set<string>();
  const selected: AnswerSource[] = [];

  for (const index of candidates) {
    const chunk = chunks[index];
    if (!chunk) continue;
    const source = sourceFromChunk(chunk, index);
    if (!source.url || seen.has(source.url)) continue;
    seen.add(source.url);
    selected.push(source);
    if (selected.length >= limit) break;
  }
  return selected;
}
