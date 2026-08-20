import {
  fillAgeSeries,
  fillDemographicSeries,
  fillGenderSeries,
  normalizeTrackedPropertyUrl,
} from './overview';
import {
  VISITOR_AGE_LABELS,
  VISITOR_GENDER_LABELS,
  type VisitorAgeDecade,
  type VisitorGender,
} from './visitor-profile';

const MONTH_PATTERN = /^\d{4}-\d{2}$/u;
const AVAILABLE_MONTH_COUNT = 12;
const INTENT_CASE = `CASE
  WHEN body LIKE '%売却%' OR body LIKE '%査定%' OR body LIKE '%売りたい%' THEN 'sell'
  WHEN body LIKE '%注文住宅%' OR body LIKE '%建てたい%' OR body LIKE '%リフォーム%' OR body LIKE '%リノベーション%' THEN 'build'
  WHEN body LIKE '%賃貸%' OR body LIKE '%家賃%' OR body LIKE '%部屋探し%' OR body LIKE '%一人暮らし%' OR body LIKE '%入居%' THEN 'rent'
  WHEN body LIKE '%購入%' OR body LIKE '%買いたい%' OR body LIKE '%住宅ローン%' OR body LIKE '%新築%' OR body LIKE '%中古%' THEN 'buy'
  ELSE 'other'
END`;

export type MonthlyReportStatus = 'in_progress' | 'final';
export type MonthlyIntent = 'rent' | 'buy' | 'sell' | 'build' | 'other';

export interface MonthlyQuestionTrend {
  question: string;
  count: number;
}

export interface MonthlyPolicyCount {
  action: string;
  count: number;
}

export interface MonthlyIntentCount {
  intent: MonthlyIntent;
  count: number;
}

export interface MonthlyIntentByDemographic {
  gender: VisitorGender;
  ageDecade: VisitorAgeDecade;
  intent: MonthlyIntent;
  count: number;
}

export interface MonthlyPropertyInterest {
  gender: VisitorGender;
  ageDecade: VisitorAgeDecade;
  title: string;
  sourceUrl?: string;
  category?: 'properties_for_sale' | 'properties_for_rent';
  count: number;
}

export interface OrinyanCommentary {
  text: string;
  generatedAt: string;
  model: string;
}

export interface MonthlyReport {
  month: string;
  generatedAt: string;
  status: MonthlyReportStatus;
  conversations: number;
  questions: number;
  visitors: number;
  consentedConversations: number;
  policySummary: MonthlyPolicyCount[];
  questionTrends: MonthlyQuestionTrend[];
  intents: MonthlyIntentCount[];
  intentsByDemographic: MonthlyIntentByDemographic[];
  genders: Array<{ gender: VisitorGender; count: number }>;
  ages: Array<{ ageDecade: VisitorAgeDecade; count: number }>;
  demographics: Array<{ gender: VisitorGender; ageDecade: VisitorAgeDecade; count: number }>;
  propertyInterests: MonthlyPropertyInterest[];
  funnel: { conversations: number; consented_conversations: number };
  orinyanCommentary?: OrinyanCommentary | null;
}

export function isReportMonth(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

export function japanMonth(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

export function shiftJapanMonth(month: string, delta: number) {
  if (!isReportMonth(month)) throw new Error('Invalid month');
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, (monthNumber || 1) - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function japanMonthBounds(month: string) {
  if (!isReportMonth(month)) throw new Error('Invalid month');
  const nextMonth = shiftJapanMonth(month, 1);
  const start = new Date(`${month}-01T00:00:00+09:00`);
  const end = new Date(`${nextMonth}-01T00:00:00+09:00`);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startSql: toSqliteUtc(start),
    endSql: toSqliteUtc(end),
  };
}

export function listAvailableReportMonths(now = new Date(), storedMonths: string[] = []) {
  const current = japanMonth(now);
  const recent = Array.from({ length: AVAILABLE_MONTH_COUNT }, (_, index) => shiftJapanMonth(current, -index));
  const extra = storedMonths.filter((month) => isReportMonth(month) && !recent.includes(month));
  return [...recent, ...extra].sort((left, right) => right.localeCompare(left));
}

export function reportStatusForMonth(month: string, now = new Date()): MonthlyReportStatus {
  return month === japanMonth(now) ? 'in_progress' : 'final';
}

function toSqliteUtc(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function asCount(value: number | string | null | undefined) {
  const count = Number(value || 0);
  return Number.isFinite(count) ? count : 0;
}

const INTENT_ORDER: MonthlyIntent[] = ['rent', 'buy', 'sell', 'build', 'other'];

function fillIntentSeries(rows: Array<{ intent?: string | null; count?: number | string | null }>): MonthlyIntentCount[] {
  const counts = new Map(rows.map((row) => [row.intent || 'other', asCount(row.count)]));
  return INTENT_ORDER.map((intent) => ({ intent, count: counts.get(intent) || 0 }));
}

export function mergePropertyInterests(
  sourcePages: Array<{ gender?: string | null; ageDecade?: string | null; sourcePage?: string | null; count?: number | string | null }>,
  citations: Array<{
    gender?: string | null;
    ageDecade?: string | null;
    title?: string | null;
    sourceUrl?: string | null;
    count?: number | string | null;
  }>,
  inventory: Array<{ source_url: string; title: string; category: 'properties_for_sale' | 'properties_for_rent' }>,
): MonthlyPropertyInterest[] {
  const catalog = new Map(
    inventory.flatMap((item) => {
      const sourceUrl = normalizeTrackedPropertyUrl(item.source_url) || item.source_url;
      return sourceUrl ? [[sourceUrl, item] as const] : [];
    }),
  );
  const merged = new Map<string, MonthlyPropertyInterest>();

  const add = (
    gender: string | null | undefined,
    ageDecade: string | null | undefined,
    title: string,
    sourceUrl: string | undefined,
    count: number,
  ) => {
    if (!gender || !ageDecade || !title || count <= 0) return;
    if (!(gender in VISITOR_GENDER_LABELS) || !(ageDecade in VISITOR_AGE_LABELS)) return;
    const property = sourceUrl ? catalog.get(sourceUrl) : undefined;
    const key = `${gender}:${ageDecade}:${property?.source_url || sourceUrl || title}`;
    const current = merged.get(key);
    if (current) {
      current.count += count;
      return;
    }
    merged.set(key, {
      gender: gender as VisitorGender,
      ageDecade: ageDecade as VisitorAgeDecade,
      title: property?.title || title,
      sourceUrl: property?.source_url || sourceUrl,
      category: property?.category,
      count,
    });
  };

  for (const row of sourcePages) {
    const sourceUrl = row.sourcePage ? normalizeTrackedPropertyUrl(row.sourcePage) : undefined;
    if (!sourceUrl) continue;
    const property = catalog.get(sourceUrl);
    add(row.gender, row.ageDecade, property?.title || sourceUrl, sourceUrl, asCount(row.count));
  }
  for (const row of citations) {
    const sourceUrl = row.sourceUrl ? normalizeTrackedPropertyUrl(row.sourceUrl) || row.sourceUrl : undefined;
    add(row.gender, row.ageDecade, row.title || sourceUrl || '', sourceUrl, asCount(row.count));
  }

  return [...merged.values()].sort((left, right) => right.count - left.count || left.title.localeCompare(right.title, 'ja')).slice(0, 40);
}

export function commentaryPromptPayload(report: MonthlyReport) {
  const topDemographics = report.demographics
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 8)
    .map((item) => ({
      label: `${VISITOR_AGE_LABELS[item.ageDecade]}の${VISITOR_GENDER_LABELS[item.gender]}`,
      count: item.count,
    }));
  const intentByGroup = new Map<string, Array<{ intent: MonthlyIntent; count: number }>>();
  for (const row of report.intentsByDemographic) {
    if (!row.count) continue;
    const key = `${VISITOR_AGE_LABELS[row.ageDecade]}の${VISITOR_GENDER_LABELS[row.gender]}`;
    const current = intentByGroup.get(key) || [];
    current.push({ intent: row.intent, count: row.count });
    intentByGroup.set(key, current);
  }
  const propertyByGroup = new Map<string, Array<{ title: string; category?: string; count: number }>>();
  for (const row of report.propertyInterests.slice(0, 20)) {
    const key = `${VISITOR_AGE_LABELS[row.ageDecade]}の${VISITOR_GENDER_LABELS[row.gender]}`;
    const current = propertyByGroup.get(key) || [];
    current.push({ title: row.title, category: row.category, count: row.count });
    propertyByGroup.set(key, current);
  }

  return {
    month: report.month,
    status: report.status,
    conversations: report.conversations,
    questions: report.questions,
    visitors: report.visitors,
    consentedConversations: report.consentedConversations,
    genders: report.genders.filter((item) => item.count > 0).map((item) => ({
      label: VISITOR_GENDER_LABELS[item.gender],
      count: item.count,
    })),
    ages: report.ages.filter((item) => item.count > 0).map((item) => ({
      label: VISITOR_AGE_LABELS[item.ageDecade],
      count: item.count,
    })),
    topDemographics,
    intents: report.intents.filter((item) => item.count > 0),
    intentsByDemographic: [...intentByGroup.entries()].map(([group, intents]) => ({ group, intents })),
    popularPropertiesByDemographic: [...propertyByGroup.entries()].map(([group, properties]) => ({ group, properties })),
    questionTrends: report.questionTrends.slice(0, 12),
  };
}

export async function loadMonthlyReport(
  db: D1Database,
  month: string,
  now = new Date(),
): Promise<MonthlyReport> {
  if (!isReportMonth(month)) throw new Error('Invalid month');
  const bounds = japanMonthBounds(month);
  const [
    funnel,
    questions,
    policyRows,
    questionRows,
    genderRows,
    ageRows,
    demographicRows,
    intentRows,
    intentDemographicRows,
    sourcePageRows,
    citationRows,
    inventoryRows,
  ] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS conversations,
        COUNT(DISTINCT visitor_hash) AS visitors,
        SUM(CASE WHEN marketing_consent = 1 THEN 1 ELSE 0 END) AS consented
       FROM conversations
       WHERE created_at >= ? AND created_at < ? -- monthly.funnel`,
    ).bind(bounds.startSql, bounds.endSql).first<{ conversations: number; visitors: number; consented: number | null }>(),
    db.prepare(
      `SELECT COUNT(*) AS count FROM messages
       WHERE role = 'user' AND created_at >= ? AND created_at < ? -- monthly.question_count`,
    ).bind(bounds.startSql, bounds.endSql).first<{ count: number }>(),
    db.prepare(
      `SELECT policy_action AS action, COUNT(*) AS count FROM messages
       WHERE role = 'assistant' AND created_at >= ? AND created_at < ?
       GROUP BY policy_action ORDER BY count DESC -- monthly.policy`,
    ).bind(bounds.startSql, bounds.endSql).all<{ action: string; count: number }>(),
    db.prepare(
      `SELECT substr(content_redacted, 1, 120) AS question, COUNT(*) AS count
       FROM messages
       WHERE role = 'user' AND created_at >= ? AND created_at < ?
         AND length(trim(content_redacted)) >= 2
       GROUP BY substr(content_redacted, 1, 120)
       ORDER BY count DESC LIMIT 50 -- monthly.question_trends`,
    ).bind(bounds.startSql, bounds.endSql).all<{ question: string; count: number }>(),
    db.prepare(
      `SELECT visitor_gender AS gender, COUNT(*) AS count
       FROM conversations
       WHERE created_at >= ? AND created_at < ? AND visitor_gender IS NOT NULL
       GROUP BY visitor_gender -- monthly.genders`,
    ).bind(bounds.startSql, bounds.endSql).all<{ gender: VisitorGender; count: number }>(),
    db.prepare(
      `SELECT visitor_age_decade AS ageDecade, COUNT(*) AS count
       FROM conversations
       WHERE created_at >= ? AND created_at < ? AND visitor_age_decade IS NOT NULL
       GROUP BY visitor_age_decade -- monthly.ages`,
    ).bind(bounds.startSql, bounds.endSql).all<{ ageDecade: VisitorAgeDecade; count: number }>(),
    db.prepare(
      `SELECT visitor_gender AS gender, visitor_age_decade AS ageDecade, COUNT(*) AS count
       FROM conversations
       WHERE created_at >= ? AND created_at < ?
         AND visitor_gender IS NOT NULL AND visitor_age_decade IS NOT NULL
       GROUP BY visitor_gender, visitor_age_decade -- monthly.demographics`,
    ).bind(bounds.startSql, bounds.endSql).all<{ gender: VisitorGender; ageDecade: VisitorAgeDecade; count: number }>(),
    db.prepare(
      `WITH conversation_text AS (
         SELECT c.id, group_concat(m.content_redacted, ' ') AS body
         FROM conversations c
         JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'
         WHERE c.created_at >= ? AND c.created_at < ?
         GROUP BY c.id
       ), classified AS (
         SELECT ${INTENT_CASE} AS intent FROM conversation_text
       )
       SELECT intent, COUNT(*) AS count FROM classified GROUP BY intent -- monthly.intent_totals`,
    ).bind(bounds.startSql, bounds.endSql).all<{ intent: MonthlyIntent; count: number }>(),
    db.prepare(
      `WITH conversation_text AS (
         SELECT c.id, c.visitor_gender AS gender, c.visitor_age_decade AS ageDecade,
           group_concat(m.content_redacted, ' ') AS body
         FROM conversations c
         JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'
         WHERE c.created_at >= ? AND c.created_at < ?
           AND c.visitor_gender IS NOT NULL AND c.visitor_age_decade IS NOT NULL
         GROUP BY c.id
       ), classified AS (
         SELECT gender, ageDecade, ${INTENT_CASE} AS intent FROM conversation_text
       )
       SELECT gender, ageDecade, intent, COUNT(*) AS count
       FROM classified GROUP BY gender, ageDecade, intent -- monthly.intents_by_demographic`,
    ).bind(bounds.startSql, bounds.endSql).all<MonthlyIntentByDemographic>(),
    db.prepare(
      `SELECT visitor_gender AS gender, visitor_age_decade AS ageDecade, source_page AS sourcePage, COUNT(*) AS count
       FROM conversations
       WHERE created_at >= ? AND created_at < ?
         AND visitor_gender IS NOT NULL AND visitor_age_decade IS NOT NULL
         AND source_page IS NOT NULL
       GROUP BY visitor_gender, visitor_age_decade, source_page -- monthly.source_pages`,
    ).bind(bounds.startSql, bounds.endSql).all<{ gender: VisitorGender; ageDecade: VisitorAgeDecade; sourcePage: string; count: number }>(),
    db.prepare(
      `SELECT c.visitor_gender AS gender, c.visitor_age_decade AS ageDecade,
        cit.source_title AS title, cit.source_url AS sourceUrl, COUNT(DISTINCT c.id) AS count
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id AND m.role = 'assistant'
       JOIN citations cit ON cit.message_id = m.id
       WHERE c.created_at >= ? AND c.created_at < ?
         AND c.visitor_gender IS NOT NULL AND c.visitor_age_decade IS NOT NULL
         AND cit.source_url IS NOT NULL AND trim(cit.source_url) != ''
       GROUP BY c.visitor_gender, c.visitor_age_decade, cit.source_url -- monthly.citations`,
    ).bind(bounds.startSql, bounds.endSql).all<{ gender: VisitorGender; ageDecade: VisitorAgeDecade; title: string | null; sourceUrl: string; count: number }>(),
    db.prepare(
      `SELECT source_url, title, category FROM managed_property_inventory -- monthly.inventory`,
    ).all<{ source_url: string; title: string; category: 'properties_for_sale' | 'properties_for_rent' }>(),
  ]);

  const conversations = asCount(funnel?.conversations);
  const consented = asCount(funnel?.consented);
  return {
    month,
    generatedAt: now.toISOString(),
    status: reportStatusForMonth(month, now),
    conversations,
    questions: asCount(questions?.count),
    visitors: asCount(funnel?.visitors),
    consentedConversations: consented,
    policySummary: (policyRows.results || []).map((row) => ({ action: row.action || 'allow', count: asCount(row.count) })),
    questionTrends: (questionRows.results || [])
      .map((row) => ({ question: (row.question || '').trim(), count: asCount(row.count) }))
      .filter((row) => row.question),
    intents: fillIntentSeries(intentRows.results || []),
    intentsByDemographic: (intentDemographicRows.results || []).filter((row) => row.gender && row.ageDecade && row.intent),
    genders: fillGenderSeries(genderRows.results || []),
    ages: fillAgeSeries(ageRows.results || []),
    demographics: fillDemographicSeries(demographicRows.results || []),
    propertyInterests: mergePropertyInterests(sourcePageRows.results || [], citationRows.results || [], inventoryRows.results || []),
    funnel: { conversations, consented_conversations: consented },
    orinyanCommentary: null,
  };
}

export function attachOrinyanCommentary(report: MonthlyReport, commentary: OrinyanCommentary | null | undefined): MonthlyReport {
  return { ...report, orinyanCommentary: commentary || null };
}

export function readStoredCommentary(value: unknown): OrinyanCommentary | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const commentary = record.orinyanCommentary && typeof record.orinyanCommentary === 'object'
    ? record.orinyanCommentary as Record<string, unknown>
    : record;
  const text = typeof commentary.text === 'string' ? commentary.text.trim() : '';
  const generatedAt = typeof commentary.generatedAt === 'string' ? commentary.generatedAt : '';
  const model = typeof commentary.model === 'string' ? commentary.model : '';
  if (!text || !generatedAt) return null;
  return { text, generatedAt, model: model || 'unknown' };
}

export function monthlyReportObjectKey(month: string) {
  return `reports/${month}.json`;
}

export async function readStoredMonthlyCommentary(bucket: R2Bucket, month: string) {
  const object = await bucket.get(monthlyReportObjectKey(month));
  if (!object) return null;
  return readStoredCommentary(await object.json().catch(() => null));
}

export async function saveMonthlyReportSnapshot(bucket: R2Bucket, report: MonthlyReport) {
  await bucket.put(monthlyReportObjectKey(report.month), JSON.stringify(report, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function listStoredReportMonths(bucket: R2Bucket) {
  const listed = await bucket.list({ prefix: 'reports/', limit: 24 });
  return listed.objects
    .map((object) => object.key.match(/^reports\/(\d{4}-\d{2})\.json$/u)?.[1] || '')
    .filter(isReportMonth)
    .sort((left, right) => right.localeCompare(left));
}
