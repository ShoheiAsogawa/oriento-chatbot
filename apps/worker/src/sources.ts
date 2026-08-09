import type { SearchChunk } from './types';

const OFFICIAL_SOURCE_HOSTS = new Set([
  'orijyu.com',
  'www.orijyu.com',
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

function sourceEntityKey(title: string) {
  return (title.split(/\s+-\s+|\s+\|/u)[0] || title)
    .replace(/[\s　・,，.。()（）\-_ー]/gu, '')
    .toLowerCase();
}

function propertyUnitNumbers(value: string) {
  return new Set(Array.from(value.matchAll(/(\d+)\s*号棟/gu), (match) => match[1]));
}

function hasPropertyDetails(value: string) {
  return /(?:号棟|号地|販売価格|間取り|物件価格)/u.test(value);
}

export function filterAnswerableChunks(chunks: SearchChunk[], question: string) {
  const requestedUnits = propertyUnitNumbers(question);
  return chunks.filter((chunk, index) => {
    if (!hasPropertyDetails(chunk.text || '')) return true;
    const source = sourceFromChunk(chunk, index);
    if (!source.url) return false;
    const sourceUnits = propertyUnitNumbers(source.title);
    return requestedUnits.size === 0
      || sourceUnits.size === 0
      || [...sourceUnits].some((unit) => requestedUnits.has(unit));
  });
}

export function selectAnswerSources(answer: string, chunks: SearchChunk[], limit = 2, question = '') {
  const cited = Array.from(answer.matchAll(/(?:\[(\d+)\]|【(\d+)】)/gu), (match) => Number(match[1] || match[2]) - 1)
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
  const seenEntities = new Set<string>();
  const requestedUnits = propertyUnitNumbers(question);
  const selected: AnswerSource[] = [];
  for (const entry of ranked) {
    const { source, relevance } = entry;
    if (bestRelevance > 0 && relevance === 0) continue;
    const sourceUnits = propertyUnitNumbers(source.title);
    if (requestedUnits.size > 0 && sourceUnits.size > 0 && ![...sourceUnits].some((unit) => requestedUnits.has(unit))) continue;
    const entityKey = sourceEntityKey(source.title);
    if (!source.url || seen.has(source.url) || (entityKey.length >= 4 && seenEntities.has(entityKey))) continue;
    seen.add(source.url);
    if (entityKey.length >= 4) seenEntities.add(entityKey);
    selected.push(source);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function attachMissingSourceMarkers(answer: string, sources: AnswerSource[]) {
  const missing = sources.filter((source) => {
    return !new RegExp(`(?:\\[${source.index}\\]|【${source.index}】)`, 'u').test(answer);
  });
  if (missing.length === 0) return answer;

  const detailLines = Array.from(answer.matchAll(/^.*(?:間取り|間取|販売価格|価格|所在地).*$/gmu));
  const fallbackPosition = detailLines.at(-1)?.index != null
    ? detailLines.at(-1)!.index! + detailLines.at(-1)![0].length
    : answer.length;
  const markersByPosition = new Map<number, string[]>();

  for (const [sourcePosition, source] of missing.entries()) {
    const shortTitle = source.title.split(/\s+-\s+|\s+\|/u)[0]?.trim() || source.title;
    const titlePosition = shortTitle.length >= 4 ? answer.indexOf(shortTitle) : -1;
    const distributedDetail = detailLines.length > 0
      ? detailLines[Math.min(
        detailLines.length - 1,
        Math.ceil(((sourcePosition + 1) * detailLines.length) / missing.length) - 1,
      )]
      : undefined;
    let position = distributedDetail?.index != null
      ? distributedDetail.index + distributedDetail[0].length
      : fallbackPosition;
    if (titlePosition >= 0) {
      const following = answer.slice(titlePosition);
      const followingDetail = Array.from(following.matchAll(/^.*(?:間取り|間取|販売価格|価格|所在地).*$/gmu)).at(-1);
      if (followingDetail?.index != null) position = titlePosition + followingDetail.index + followingDetail[0].length;
    }
    const markers = markersByPosition.get(position) || [];
    markers.push(`[${source.index}]`);
    markersByPosition.set(position, markers);
  }

  let linkedAnswer = answer;
  for (const [position, markers] of [...markersByPosition.entries()].sort((left, right) => right[0] - left[0])) {
    linkedAnswer = `${linkedAnswer.slice(0, position)} ${markers.join('')}${linkedAnswer.slice(position)}`;
  }
  return linkedAnswer;
}
