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
  if (!url) return undefined;
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const markerIndex = lines.findIndex((line) => line.includes(urlMatch?.[1] || ''));
  const nearby = markerIndex >= 0 ? lines.slice(markerIndex + 1, markerIndex + 14) : lines.slice(0, 12);
  const title = nearby.find((line) =>
    line.length <= 140
    && !/^(?:更新日|Copyright|お問い合わせ|ページトップ|大阪・堺の新築)/u.test(line)
    && /(?:\d.*(?:号棟|号地|丁目)|(?:新築|中古|賃貸).*(?:戸建|マンション|土地)|物件)/u.test(line),
  ) || '';
  return { title, url };
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

function questionTitleScore(question: string, title: string) {
  const normalizedTitle = title.replace(/[\s　・|｜「」『』（）()【】\[\]]+/gu, '');
  const tokens = question
    .split(/[\s　、。,.!?！？「」『』（）()【】\[\]]+/gu)
    .map((token) => token.replace(/(?:について|を教えて|の価格|と間取り|詳細|ください|ですか)$/gu, ''))
    .filter((token) => token.length >= 2);
  return tokens.reduce((score, token) => score + (normalizedTitle.includes(token) ? token.length : 0), 0);
}

export function selectAnswerSources(answer: string, chunks: SearchChunk[], limit = 2, question = '') {
  const cited = Array.from(answer.matchAll(/\[(\d+)\]/gu), (match) => Number(match[1]) - 1)
    .filter((index, position, all) => index >= 0 && index < chunks.length && all.indexOf(index) === position);
  const candidates = [...cited, ...chunks.map((_, index) => index)]
    .filter((index, position, all) => all.indexOf(index) === position);
  const ranked = candidates.map((index, order) => {
    const chunk = chunks[index];
    if (!chunk) return undefined;
    const source = sourceFromChunk(chunk, index);
    return { source, order, relevance: questionTitleScore(question, source.title) };
  }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const bestRelevance = Math.max(0, ...ranked.map((entry) => entry.relevance));
  ranked.sort((left, right) => right.relevance - left.relevance || left.order - right.order);

  const seen = new Set<string>();
  const selected: AnswerSource[] = [];
  for (const entry of ranked) {
    const { source, relevance } = entry;
    if (bestRelevance > 0 && relevance === 0) continue;
    if (!source.url || seen.has(source.url)) continue;
    seen.add(source.url);
    selected.push(source);
    if (selected.length >= limit) break;
  }
  return selected;
}
