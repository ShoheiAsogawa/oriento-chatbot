import { japanDay, parseDailyLimit, readDailyUsage } from './cost-controls';
import {
  VISITOR_AGE_DECADES,
  VISITOR_GENDERS,
  type VisitorAgeDecade,
  type VisitorGender,
} from './visitor-profile';

export interface OverviewDailyPoint {
  day: string;
  conversations: number;
  visitors: number;
}

export interface OverviewPageCount {
  page: string;
  count: number;
}

export interface PropertyCatalogItem {
  sourceUrl: string;
  title: string;
  address: string;
  prefecture: string;
  category: 'properties_for_sale' | 'properties_for_rent';
}

export interface OverviewPrefectureCount {
  prefecture: string;
  total: number;
  sale: number;
  rent: number;
}

export interface OverviewPropertyView {
  title: string;
  address: string;
  sourceUrl: string;
  count: number;
}

export interface OverviewPolicyCount {
  action: string;
  count: number;
}

export interface OverviewIntentCount {
  intent: 'rent' | 'buy' | 'sell' | 'build' | 'other';
  count: number;
}

export interface OverviewHourCount {
  hour: number;
  count: number;
}

export interface OverviewGenderCount {
  gender: VisitorGender;
  count: number;
}

export interface OverviewAgeCount {
  ageDecade: VisitorAgeDecade;
  count: number;
}

export interface OverviewDemographicCount {
  gender: VisitorGender;
  ageDecade: VisitorAgeDecade;
  count: number;
}

export interface OverviewUsagePoint {
  day: string;
  sessions: number;
  aiRequests: number;
}

export interface OverviewData {
  conversations30d: number;
  conversationsToday: number;
  conversationsYesterday: number;
  visitors30d: number;
  questions30d: number;
  refused30d: number;
  consented30d: number;
  knowledgeItems: number;
  daily: OverviewDailyPoint[];
  topPages: OverviewPageCount[];
  propertyPrefectures: OverviewPrefectureCount[];
  topProperties: OverviewPropertyView[];
  policy: OverviewPolicyCount[];
  intents: OverviewIntentCount[];
  hours: OverviewHourCount[];
  genders: OverviewGenderCount[];
  ages: OverviewAgeCount[];
  demographics: OverviewDemographicCount[];
  usage: OverviewUsagePoint[];
  costGuard: {
    day: string;
    sessions: number;
    sessionLimit: number;
    aiRequests: number;
    aiRequestLimit: number;
  };
}

const SERIES_DAYS = 30;
const PREFECTURE_PATTERN = /^(北海道|東京都|京都府|大阪府|.{2,3}県)/u;
const PREFECTURE_CITIES: Array<[string, RegExp]> = [
  ['大阪府', /^(?:大阪市|堺市|岸和田市|豊中市|池田市|吹田市|泉大津市|高槻市|貝塚市|守口市|枚方市|茨木市|八尾市|泉佐野市|富田林市|寝屋川市|河内長野市|松原市|大東市|和泉市|箕面市|柏原市|羽曳野市|門真市|摂津市|高石市|藤井寺市|東大阪市|泉南市|四條畷市|交野市|大阪狭山市|阪南市|三島郡|豊能郡|泉北郡|泉南郡|南河内郡|日置荘)/u],
  ['兵庫県', /^(?:神戸市|姫路市|尼崎市|明石市|西宮市|洲本市|芦屋市|伊丹市|相生市|豊岡市|加古川市|赤穂市|西脇市|宝塚市|三木市|高砂市|川西市|小野市|三田市|加西市|丹波篠山市|養父市|丹波市|南あわじ市|朝来市|淡路市|宍粟市|加東市|たつの市|川辺郡|多可郡|加古郡|神崎郡|揖保郡|赤穂郡|佐用郡|美方郡)/u],
  ['和歌山県', /^(?:和歌山市|海南市|橋本市|有田市|御坊市|田辺市|新宮市|紀の川市|岩出市|海草郡|伊都郡|有田郡|日高郡|西牟婁郡|東牟婁郡)/u],
  ['奈良県', /^(?:奈良市|大和高田市|大和郡山市|天理市|橿原市|桜井市|五條市|御所市|生駒市|香芝市|葛城市|宇陀市|山辺郡|生駒郡|磯城郡|宇陀郡|高市郡|北葛城郡|吉野郡)/u],
  ['京都府', /^(?:京都市|福知山市|舞鶴市|綾部市|宇治市|宮津市|亀岡市|城陽市|向日市|長岡京市|八幡市|京田辺市|京丹後市|南丹市|木津川市|乙訓郡|久世郡|綴喜郡|相楽郡|船井郡|与謝郡)/u],
];

export function inferPropertyPrefecture(address: string) {
  const normalized = address.replace(/\s+/gu, '');
  const explicit = normalized.match(PREFECTURE_PATTERN)?.[1];
  if (explicit) return explicit;
  return PREFECTURE_CITIES.find(([, pattern]) => pattern.test(normalized))?.[0] || 'その他';
}

export function normalizeTrackedPropertyUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./u, '');
    if (url.protocol !== 'https:' || hostname !== 'orijyu.com') return undefined;
    if (!/^\/(?:[^/]+\/)?post-\d+(?:-\d+)?\.html$/u.test(url.pathname)) return undefined;
    url.hostname = 'orijyu.com';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

export function buildPropertyAnalytics(
  initialCatalog: PropertyCatalogItem[],
  managedRows: Array<{ source_url: string; title: string; address: string; category: PropertyCatalogItem['category'] }>,
  excludedUrls: string[],
  viewRows: Array<{ source_url: string; count: number | string | null }>,
) {
  const excluded = new Set(excludedUrls.map(normalizeTrackedPropertyUrl).filter((url): url is string => Boolean(url)));
  const catalog = new Map<string, PropertyCatalogItem>();
  for (const item of initialCatalog) {
    const sourceUrl = normalizeTrackedPropertyUrl(item.sourceUrl);
    if (!sourceUrl || excluded.has(sourceUrl)) continue;
    catalog.set(sourceUrl, { ...item, sourceUrl, prefecture: item.prefecture || inferPropertyPrefecture(item.address) });
  }
  for (const row of managedRows) {
    const sourceUrl = normalizeTrackedPropertyUrl(row.source_url);
    if (!sourceUrl || excluded.has(sourceUrl)) continue;
    catalog.set(sourceUrl, {
      sourceUrl,
      title: row.title,
      address: row.address,
      prefecture: inferPropertyPrefecture(row.address),
      category: row.category,
    });
  }

  const prefectures = new Map<string, OverviewPrefectureCount>();
  for (const item of catalog.values()) {
    const prefecture = item.prefecture || 'その他';
    const current = prefectures.get(prefecture) || { prefecture, total: 0, sale: 0, rent: 0 };
    current.total += 1;
    if (item.category === 'properties_for_rent') current.rent += 1;
    else current.sale += 1;
    prefectures.set(prefecture, current);
  }

  const topProperties = viewRows.flatMap((row) => {
    const sourceUrl = normalizeTrackedPropertyUrl(row.source_url);
    const item = sourceUrl ? catalog.get(sourceUrl) : undefined;
    return item ? [{ title: item.title, address: item.address, sourceUrl: item.sourceUrl, count: asCount(row.count) }] : [];
  });
  return {
    propertyPrefectures: [...prefectures.values()].sort((left, right) => right.total - left.total || left.prefecture.localeCompare(right.prefecture, 'ja')),
    topProperties,
  };
}

export function addCalendarDays(isoDate: string, delta: number) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year || 0, (month || 1) - 1, (day || 1) + delta));
  return date.toISOString().slice(0, 10);
}

export function fillDailySeries(
  today: string,
  rows: Array<{ day: string; conversations?: number | string | null; visitors?: number | string | null }>,
  length = SERIES_DAYS,
): OverviewDailyPoint[] {
  const counts = new Map(rows.map((row) => [row.day, {
    conversations: Number(row.conversations || 0),
    visitors: Number(row.visitors || 0),
  }]));
  return Array.from({ length }, (_, index) => {
    const day = addCalendarDays(today, index - (length - 1));
    const point = counts.get(day);
    return {
      day,
      conversations: point?.conversations || 0,
      visitors: point?.visitors || 0,
    };
  });
}

export function fillHourlySeries(
  rows: Array<{ hour: number | string; count?: number | string | null }>,
): OverviewHourCount[] {
  const counts = new Map(rows.map((row) => [Number(row.hour), Number(row.count || 0)]));
  return Array.from({ length: 24 }, (_, hour) => ({ hour, count: counts.get(hour) || 0 }));
}

export function fillGenderSeries(
  rows: Array<{ gender?: string | null; count?: number | string | null }>,
): OverviewGenderCount[] {
  const counts = new Map(rows.map((row) => [row.gender || '', Number(row.count || 0)]));
  return VISITOR_GENDERS.map((gender) => ({ gender, count: counts.get(gender) || 0 }));
}

export function fillAgeSeries(
  rows: Array<{ ageDecade?: string | null; count?: number | string | null }>,
): OverviewAgeCount[] {
  const counts = new Map(rows.map((row) => [row.ageDecade || '', Number(row.count || 0)]));
  return VISITOR_AGE_DECADES.map((ageDecade) => ({ ageDecade, count: counts.get(ageDecade) || 0 }));
}

export function fillDemographicSeries(
  rows: Array<{ gender?: string | null; ageDecade?: string | null; count?: number | string | null }>,
): OverviewDemographicCount[] {
  const counts = new Map(rows.map((row) => [`${row.gender}:${row.ageDecade}`, Number(row.count || 0)]));
  return VISITOR_GENDERS.flatMap((gender) => VISITOR_AGE_DECADES.map((ageDecade) => ({
    gender,
    ageDecade,
    count: counts.get(`${gender}:${ageDecade}`) || 0,
  })));
}

export function fillUsageSeries(
  today: string,
  rows: Array<{ day: string; metric: string; count?: number | string | null }>,
  length = SERIES_DAYS,
): OverviewUsagePoint[] {
  const byDay = new Map<string, OverviewUsagePoint>();
  for (const row of rows) {
    const current = byDay.get(row.day) || { day: row.day, sessions: 0, aiRequests: 0 };
    const count = Number(row.count || 0);
    if (row.metric === 'chat_sessions') current.sessions = count;
    if (row.metric === 'ai_requests') current.aiRequests = count;
    byDay.set(row.day, current);
  }
  return Array.from({ length }, (_, index) => {
    const day = addCalendarDays(today, index - (length - 1));
    return byDay.get(day) || { day, sessions: 0, aiRequests: 0 };
  });
}

function asCount(value: number | string | null | undefined) {
  return Number(value || 0);
}

export async function loadOverview(
  db: D1Database,
  options: {
    knowledgeItems: number;
    sessionLimit?: string;
    aiRequestLimit?: string;
    propertyCatalog?: PropertyCatalogItem[];
    now?: Date;
  },
): Promise<OverviewData> {
  const now = options.now || new Date();
  const today = japanDay(now);
  const usageFrom = addCalendarDays(today, 1 - SERIES_DAYS);
  const [
    summary,
    unanswered,
    questions,
    dailyRows,
    pageRows,
    policyRows,
    intentRows,
    hourRows,
    genderRows,
    ageRows,
    demographicRows,
    usageRows,
    propertyViewRows,
    managedPropertyRows,
    excludedPropertyRows,
    dailyUsage,
  ] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS conversations30d,
        COUNT(DISTINCT visitor_hash) AS visitors30d,
        SUM(CASE WHEN date(created_at, '+9 hours') = date('now', '+9 hours') THEN 1 ELSE 0 END) AS conversationsToday,
        SUM(CASE WHEN date(created_at, '+9 hours') = date('now', '+9 hours', '-1 day') THEN 1 ELSE 0 END) AS conversationsYesterday,
        SUM(CASE WHEN marketing_consent = 1 THEN 1 ELSE 0 END) AS consented30d
       FROM conversations
       WHERE created_at >= datetime('now', '-30 days') -- overview.summary`,
    ).first<{
      conversations30d: number;
      visitors30d: number;
      conversationsToday: number | null;
      conversationsYesterday: number | null;
      consented30d: number | null;
    }>(),
    db.prepare(
      `SELECT COUNT(*) AS count FROM messages
       WHERE role = 'assistant' AND policy_action != 'allow'
         AND created_at >= datetime('now', '-30 days') -- overview.refused`,
    ).first<{ count: number }>(),
    db.prepare(
      `SELECT COUNT(*) AS count FROM messages
       WHERE role = 'user' AND created_at >= datetime('now', '-30 days') -- overview.questions`,
    ).first<{ count: number }>(),
    db.prepare(
      `SELECT date(created_at, '+9 hours') AS day,
        COUNT(*) AS conversations,
        COUNT(DISTINCT visitor_hash) AS visitors
       FROM conversations
       WHERE created_at >= datetime('now', '-30 days') -- overview.daily
       GROUP BY date(created_at, '+9 hours')
       ORDER BY day`,
    ).all<{ day: string; conversations: number; visitors: number }>(),
    db.prepare(
      `SELECT CASE
          WHEN source_page IS NULL OR trim(source_page) = '' THEN '/'
          ELSE source_page
        END AS page,
        COUNT(*) AS count
       FROM conversations
       WHERE created_at >= datetime('now', '-30 days') -- overview.pages
       GROUP BY page
       ORDER BY count DESC
       LIMIT 8`,
    ).all<{ page: string; count: number }>(),
    db.prepare(
      `SELECT policy_action AS action, COUNT(*) AS count
       FROM messages
       WHERE role = 'assistant' AND created_at >= datetime('now', '-30 days') -- overview.policy
       GROUP BY policy_action
       ORDER BY count DESC`,
    ).all<{ action: string; count: number }>(),
    db.prepare(
      `WITH conversation_text AS (
         SELECT c.id, group_concat(m.content_redacted, ' ') AS body
         FROM conversations c
         JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'
         WHERE c.created_at >= datetime('now', '-30 days')
         GROUP BY c.id
       ), classified AS (
         SELECT CASE
           WHEN body LIKE '%売却%' OR body LIKE '%査定%' OR body LIKE '%売りたい%' THEN 'sell'
           WHEN body LIKE '%注文住宅%' OR body LIKE '%建てたい%' OR body LIKE '%リフォーム%' OR body LIKE '%リノベーション%' THEN 'build'
           WHEN body LIKE '%賃貸%' OR body LIKE '%家賃%' OR body LIKE '%部屋探し%' OR body LIKE '%一人暮らし%' OR body LIKE '%入居%' THEN 'rent'
           WHEN body LIKE '%購入%' OR body LIKE '%買いたい%' OR body LIKE '%住宅ローン%' OR body LIKE '%新築%' OR body LIKE '%中古%' THEN 'buy'
           ELSE 'other'
         END AS intent
         FROM conversation_text
       )
       SELECT intent, COUNT(*) AS count
       FROM classified
       GROUP BY intent
       ORDER BY count DESC -- overview.intents`,
    ).all<{ intent: OverviewIntentCount['intent']; count: number }>(),
    db.prepare(
      `SELECT CAST(strftime('%H', datetime(created_at, '+9 hours')) AS INTEGER) AS hour,
        COUNT(*) AS count
       FROM conversations
       WHERE created_at >= datetime('now', '-30 days') -- overview.hours
       GROUP BY hour
       ORDER BY hour`,
    ).all<{ hour: number; count: number }>(),
    db.prepare(
      `SELECT visitor_gender AS gender, COUNT(*) AS count
       FROM conversations
       WHERE created_at >= datetime('now', '-30 days')
         AND visitor_gender IS NOT NULL -- overview.genders
       GROUP BY visitor_gender`,
    ).all<{ gender: VisitorGender; count: number }>(),
    db.prepare(
      `SELECT visitor_age_decade AS ageDecade, COUNT(*) AS count
       FROM conversations
       WHERE created_at >= datetime('now', '-30 days')
         AND visitor_age_decade IS NOT NULL -- overview.age_decades
       GROUP BY visitor_age_decade`,
    ).all<{ ageDecade: VisitorAgeDecade; count: number }>(),
    db.prepare(
      `SELECT visitor_gender AS gender, visitor_age_decade AS ageDecade, COUNT(*) AS count
       FROM conversations
       WHERE created_at >= datetime('now', '-30 days')
         AND visitor_gender IS NOT NULL AND visitor_age_decade IS NOT NULL -- overview.demographic_matrix
       GROUP BY visitor_gender, visitor_age_decade`,
    ).all<{ gender: VisitorGender; ageDecade: VisitorAgeDecade; count: number }>(),
    db.prepare(
      `SELECT day, metric, count FROM usage_counters
       WHERE day >= ? -- overview.usage
       ORDER BY day`,
    ).bind(usageFrom).all<{ day: string; metric: string; count: number }>(),
    db.prepare(
      `SELECT source_url, COUNT(*) AS count
       FROM property_page_views
       WHERE day >= ? -- overview.property_views
       GROUP BY source_url
       ORDER BY count DESC
       LIMIT 8`,
    ).bind(usageFrom).all<{ source_url: string; count: number }>(),
    db.prepare(
      `SELECT source_url, title, address, category
       FROM managed_property_inventory -- overview.managed_properties`,
    ).all<{ source_url: string; title: string; address: string; category: PropertyCatalogItem['category'] }>(),
    db.prepare(
      `SELECT source_url FROM knowledge_source_exclusions -- overview.property_exclusions`,
    ).all<{ source_url: string }>(),
    readDailyUsage(db, now),
  ]);

  const propertyAnalytics = buildPropertyAnalytics(
    options.propertyCatalog || [],
    managedPropertyRows.results || [],
    (excludedPropertyRows.results || []).map((row) => row.source_url),
    propertyViewRows.results || [],
  );

  return {
    conversations30d: asCount(summary?.conversations30d),
    conversationsToday: asCount(summary?.conversationsToday),
    conversationsYesterday: asCount(summary?.conversationsYesterday),
    visitors30d: asCount(summary?.visitors30d),
    questions30d: asCount(questions?.count),
    refused30d: asCount(unanswered?.count),
    consented30d: asCount(summary?.consented30d),
    knowledgeItems: asCount(options.knowledgeItems),
    daily: fillDailySeries(today, dailyRows.results || []),
    topPages: (pageRows.results || []).map((row) => ({
      page: row.page || '/',
      count: asCount(row.count),
    })),
    ...propertyAnalytics,
    policy: (policyRows.results || []).map((row) => ({
      action: row.action || 'allow',
      count: asCount(row.count),
    })),
    intents: (intentRows.results || []).map((row) => ({
      intent: row.intent || 'other',
      count: asCount(row.count),
    })),
    hours: fillHourlySeries(hourRows.results || []),
    genders: fillGenderSeries(genderRows.results || []),
    ages: fillAgeSeries(ageRows.results || []),
    demographics: fillDemographicSeries(demographicRows.results || []),
    usage: fillUsageSeries(today, usageRows.results || []),
    costGuard: {
      day: dailyUsage.day,
      sessions: asCount(dailyUsage.counts.chat_sessions),
      sessionLimit: parseDailyLimit(options.sessionLimit, 1000),
      aiRequests: asCount(dailyUsage.counts.ai_requests),
      aiRequestLimit: parseDailyLimit(options.aiRequestLimit, 1000),
    },
  };
}
