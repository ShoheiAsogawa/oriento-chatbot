export interface KnowledgeItem {
  id: string;
  key: string;
  /** Human-readable item name. Property entries use the property name here. */
  title?: string;
  /** `properties_for_sale`, `properties_for_rent`, or a general knowledge category. */
  category?: string;
  /** The official source/detail page, when the entry represents a property. */
  source_url?: string;
  status: 'queued' | 'running' | 'completed' | 'error' | 'skipped' | 'outdated';
  chunks_count: number;
  file_size: number;
  created_at: string;
  last_seen_at: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type KnowledgeCategory = 'properties_for_sale' | 'properties_for_rent' | 'general';
export type KnowledgeSort = 'title_asc' | 'title_desc' | 'recent';

export interface KnowledgeListOptions {
  query?: string;
  category?: 'all' | KnowledgeCategory | 'other';
  sort?: KnowledgeSort;
  /** The management screen keeps its local 50-row pager, so it needs the full property set. */
  perPage?: number;
}

export interface KnowledgeUploadOptions {
  title: string;
  category: KnowledgeCategory;
  sourceUrl?: string;
}

/** A structured property entry that becomes one searchable knowledge item. */
export interface PropertyKnowledgeInput {
  title: string;
  category: Exclude<KnowledgeCategory, 'general'>;
  sourceUrl: string;
  address?: string;
  lineStation?: string;
  priceOrRent?: string;
  managementFee?: string;
  layout?: string;
  floorArea?: string;
  buildingType?: string;
  builtYear?: string;
  floor?: string;
  availability?: string;
  features: string[];
  notes?: string;
}

export interface PropertyKnowledgeSaveResult {
  id: string;
  key: string;
  title: string;
  category: string;
  source_url: string;
  replacedItemCount: number;
  reindexStarted: boolean;
}

export interface GeneralKnowledgeSaveResult {
  id: string;
  key: string;
  title: string;
  category: string;
  source_url: string;
  replacedItemCount: number;
  reindexStarted: boolean;
}

export interface GeneralKnowledgeUpdateInput {
  title: string;
  sourceUrl?: string;
  file?: File | null;
  /** Direct source replacement for Markdown/text general knowledge documents. */
  content?: string;
  contentRevision?: string;
}

export type OverviewGender = 'male' | 'female' | 'other';
export type OverviewAgeDecade = 'teens' | '20s' | '30s' | '40s' | '50s' | '60s_plus';

export interface ConversationSummary {
  id: string;
  updated_at: string;
  source_page: string;
  message_count: number;
  latest_message: string;
  has_refusal: number;
  marketing_consent: number;
  visitor_gender?: OverviewGender | null;
  visitor_age_decade?: OverviewAgeDecade | null;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content_redacted: string;
  model?: string | null;
  latency_ms?: number | null;
  policy_action: string;
  created_at: string;
  citations: string;
}

export interface MonthlyReport {
  month: string;
  generatedAt: string;
  status: 'in_progress' | 'final';
  conversations: number;
  questions: number;
  visitors: number;
  consentedConversations: number;
  policySummary: Array<{ action: string; count: number }>;
  questionTrends: Array<{ question: string; count: number }>;
  intents: MonthlyIntentCount[];
  intentsByDemographic: Array<{
    gender: OverviewGender;
    ageDecade: OverviewAgeDecade;
    intent: MonthlyIntentCount['intent'];
    count: number;
  }>;
  genders: OverviewGenderCount[];
  ages: OverviewAgeCount[];
  demographics: OverviewDemographicCount[];
  propertyInterests: MonthlyPropertyInterest[];
  funnel: { conversations?: number; consented_conversations?: number } | null;
  orinyanCommentary?: OrinyanCommentary | null;
}

export interface MonthlyIntentCount {
  intent: 'rent' | 'buy' | 'sell' | 'build' | 'other';
  count: number;
}

export interface MonthlyPropertyInterest {
  gender: OverviewGender;
  ageDecade: OverviewAgeDecade;
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

export interface OverviewDailyPoint {
  day: string;
  conversations: number;
  visitors: number;
}

export interface OverviewPageCount {
  page: string;
  count: number;
}

export interface CustomHomeInquiryIntake {
  landOwnership?: string;
  landLocation?: string;
  landSizeSqm?: number | string;
  landSizeNote?: string;
  desiredArea?: string;
  householdSize?: number | string;
  householdDescription?: string;
  layout?: string;
  budgetYen?: number | string;
  budgetNote?: string;
  timing?: string;
  priorities?: string;
}

export type InquiryKind = 'custom_home' | 'document_request' | 'phone' | 'viewing';

export interface CustomHomeInquiry {
  id: string;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  kind?: InquiryKind;
  name: string | null;
  phone: string | null;
  address?: string | null;
  preferredDatetime?: string | null;
  properties?: Array<{ title: string; url: string }>;
  intake: CustomHomeInquiryIntake;
  notificationStatus: 'collecting' | 'pending' | 'processing' | 'sent' | 'failed' | string;
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

const genderNoun: Record<OverviewGender, string> = {
  male: '男性',
  female: '女性',
  other: 'そのほか',
};
const ageNoun: Record<OverviewAgeDecade, string> = {
  teens: '10代',
  '20s': '20代',
  '30s': '30代',
  '40s': '40代',
  '50s': '50代',
  '60s_plus': '60代以上',
};

export function visitorDemographicLabel(
  gender?: OverviewGender | null,
  ageDecade?: OverviewAgeDecade | null,
) {
  const age = ageDecade ? ageNoun[ageDecade] : '';
  if (!gender) return age;
  if (gender === 'other') return age ? `${age}・そのほか` : 'そのほか';
  return age ? `${age}の${genderNoun[gender]}` : genderNoun[gender];
}

export interface OverviewGenderCount {
  gender: OverviewGender;
  count: number;
}

export interface OverviewAgeCount {
  ageDecade: OverviewAgeDecade;
  count: number;
}

export interface OverviewDemographicCount {
  gender: OverviewGender;
  ageDecade: OverviewAgeDecade;
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

export interface AdminIdentity {
  loginId: string;
  subject: string;
}

export interface AdminSessionResponse {
  authenticated: boolean;
  user: AdminIdentity | null;
}

export interface AdminLoginResponse {
  ok: boolean;
  user: AdminIdentity;
}

const mockKnowledge: KnowledgeItem[] = [
  { id: '1', key: 'サービス資料_2026.pdf', status: 'completed', chunks_count: 1248, file_size: 1820000, created_at: '2026-08-08T05:32:00Z', last_seen_at: '2026-08-08T05:35:00Z' },
  { id: '2', key: '物件情報_大阪市.xlsx', status: 'running', chunks_count: 0, file_size: 924000, created_at: '2026-08-09T08:12:00Z', last_seen_at: '2026-08-09T08:12:00Z' },
  { id: '3', key: 'よくある質問.docx', status: 'completed', chunks_count: 654, file_size: 342000, created_at: '2026-08-07T09:09:00Z', last_seen_at: '2026-08-07T09:10:00Z' },
  { id: '4', key: '店舗案内.pdf', status: 'error', chunks_count: 0, file_size: 5120000, created_at: '2026-08-06T00:41:00Z', last_seen_at: '2026-08-06T00:42:00Z' },
  { id: '5', key: 'プライバシーポリシー.txt', status: 'completed', chunks_count: 312, file_size: 48000, created_at: '2026-08-05T03:22:00Z', last_seen_at: '2026-08-05T03:23:00Z' },
  { id: '6', key: '用語集.csv', status: 'completed', chunks_count: 1102, file_size: 187000, created_at: '2026-08-04T01:07:00Z', last_seen_at: '2026-08-04T01:08:00Z' },
];

export const mockConversations: ConversationSummary[] = [
  { id: 'c-81f2', updated_at: '2026-08-09T09:24:00Z', source_page: '/property/osaka/1288', message_count: 8, latest_message: '見学予約はできますか？', has_refusal: 0, marketing_consent: 1 },
  { id: 'c-32aa', updated_at: '2026-08-09T08:47:00Z', source_page: '/order-house/', message_count: 5, latest_message: '値引きは可能ですか？', has_refusal: 1, marketing_consent: 0 },
  { id: 'c-11d0', updated_at: '2026-08-09T07:12:00Z', source_page: '/', message_count: 11, latest_message: '堺店の営業時間を教えてください', has_refusal: 0, marketing_consent: 0 },
  { id: 'c-8c90', updated_at: '2026-08-08T23:18:00Z', source_page: '/property/hyogo/', message_count: 4, latest_message: '資料請求をしたいです', has_refusal: 0, marketing_consent: 1 },
];

function addCalendarDays(isoDate: string, delta: number) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year || 0, (month || 1) - 1, (day || 1) + delta));
  return date.toISOString().slice(0, 10);
}

function mockOverviewData(today = '2026-08-13'): OverviewData {
  const daily = Array.from({ length: 30 }, (_, index) => {
    const day = addCalendarDays(today, index - 29);
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const conversations = Math.max(6, Math.round((weekend ? 18 : 44) + Math.sin(index / 2.4) * 11 + index * 0.35));
    return { day, conversations, visitors: Math.max(4, Math.round(conversations * 0.73)) };
  });
  const hours = Array.from({ length: 24 }, (_, hour) => {
    const lunch = hour === 12 || hour === 13 ? 18 : 0;
    const evening = hour === 19 || hour === 20 ? 22 : 0;
    const daytime = hour >= 9 && hour <= 18 ? 10 : 2;
    return { hour, count: hour < 7 ? 1 : daytime + lunch + evening };
  });
  const usage = daily.map((point) => ({
    day: point.day,
    sessions: point.conversations,
    aiRequests: Math.round(point.conversations * 2.4),
  }));
  const last = daily.at(-1);
  return {
    conversations30d: daily.reduce((sum, point) => sum + point.conversations, 0),
    conversationsToday: last?.conversations || 0,
    conversationsYesterday: daily.at(-2)?.conversations || 0,
    visitors30d: daily.reduce((sum, point) => sum + point.visitors, 0),
    questions30d: 3482,
    refused30d: 39,
    consented30d: 86,
    knowledgeItems: 28,
    daily,
    topPages: [
      { page: 'https://orijyu.com/property/osaka/', count: 286 },
      { page: 'https://orijyu.com/', count: 214 },
      { page: 'https://orijyu.com/order-house/', count: 163 },
      { page: 'https://orijyu.com/property/hyogo/', count: 121 },
      { page: 'https://orijyu.com/reception.html', count: 74 },
      { page: 'https://orijyu.com/company/', count: 41 },
    ],
    propertyPrefectures: [
      { prefecture: '大阪府', total: 391, sale: 370, rent: 21 },
      { prefecture: '和歌山県', total: 76, sale: 74, rent: 2 },
      { prefecture: '兵庫県', total: 58, sale: 57, rent: 1 },
      { prefecture: '奈良県', total: 23, sale: 22, rent: 1 },
      { prefecture: '京都府', total: 14, sale: 14, rent: 0 },
    ],
    topProperties: [
      { title: 'OrientCity 七道', address: '堺市堺区北旅籠町西1丁', sourceUrl: 'https://orijyu.com/buy/post-128562.html', count: 86 },
      { title: 'OrientCity みさき公園', address: '泉南郡岬町淡輪', sourceUrl: 'https://orijyu.com/buy/post-112045.html', count: 71 },
      { title: 'プリッ2 少林寺町西 201号室', address: '堺市堺区少林寺町西4丁', sourceUrl: 'https://orijyu.com/rent/post-126095.html', count: 48 },
      { title: 'OrientCity 仁川町', address: '西宮市仁川町6丁目', sourceUrl: 'https://orijyu.com/buy/post-90580.html', count: 37 },
      { title: 'OrientCity 下松', address: '岸和田市尾生町2丁目', sourceUrl: 'https://orijyu.com/buy/post-115485.html', count: 29 },
    ],
    policy: [
      { action: 'allow', count: 1180 },
      { action: 'out_of_scope', count: 22 },
      { action: 'price_negotiation', count: 11 },
      { action: 'no_grounding', count: 6 },
    ],
    intents: [
      { intent: 'rent', count: 214 },
      { intent: 'buy', count: 142 },
      { intent: 'sell', count: 61 },
      { intent: 'build', count: 31 },
      { intent: 'other', count: 14 },
    ],
    hours,
    genders: [
      { gender: 'male', count: 38 },
      { gender: 'female', count: 42 },
      { gender: 'other', count: 4 },
    ],
    ages: [
      { ageDecade: 'teens', count: 4 },
      { ageDecade: '20s', count: 21 },
      { ageDecade: '30s', count: 28 },
      { ageDecade: '40s', count: 18 },
      { ageDecade: '50s', count: 9 },
      { ageDecade: '60s_plus', count: 4 },
    ],
    demographics: [
      { gender: 'male', ageDecade: 'teens', count: 1 },
      { gender: 'female', ageDecade: 'teens', count: 3 },
      { gender: 'male', ageDecade: '20s', count: 8 },
      { gender: 'female', ageDecade: '20s', count: 12 },
      { gender: 'other', ageDecade: '20s', count: 1 },
      { gender: 'male', ageDecade: '30s', count: 12 },
      { gender: 'female', ageDecade: '30s', count: 14 },
      { gender: 'other', ageDecade: '30s', count: 2 },
      { gender: 'male', ageDecade: '40s', count: 10 },
      { gender: 'female', ageDecade: '40s', count: 7 },
      { gender: 'other', ageDecade: '40s', count: 1 },
      { gender: 'male', ageDecade: '50s', count: 5 },
      { gender: 'female', ageDecade: '50s', count: 4 },
      { gender: 'male', ageDecade: '60s_plus', count: 2 },
      { gender: 'female', ageDecade: '60s_plus', count: 2 },
    ],
    usage,
    costGuard: {
      day: today,
      sessions: last?.conversations || 84,
      sessionLimit: 500,
      aiRequests: 312,
      aiRequestLimit: 500,
    },
  };
}

function mockMonthlyReport(month = '2026-08'): MonthlyReport {
  const inProgress = month === '2026-08';
  return {
    month,
    generatedAt: inProgress ? '2026-08-20T08:10:00Z' : '2026-08-01T18:27:00Z',
    status: inProgress ? 'in_progress' : 'final',
    conversations: inProgress ? 84 : 486,
    questions: inProgress ? 191 : 980,
    visitors: inProgress ? 61 : 352,
    consentedConversations: inProgress ? 4 : 18,
    policySummary: [{ action: 'allow', count: 170 }],
    questionTrends: [
      { question: '堺市の賃貸を探しています', count: 28 },
      { question: '店舗の営業時間を教えてください', count: 17 },
      { question: '資料請求をしたいです', count: 15 },
    ],
    intents: [
      { intent: 'rent', count: 46 },
      { intent: 'buy', count: 21 },
      { intent: 'sell', count: 7 },
      { intent: 'build', count: 4 },
      { intent: 'other', count: 6 },
    ],
    intentsByDemographic: [
      { gender: 'female', ageDecade: '20s', intent: 'rent', count: 13 },
      { gender: 'male', ageDecade: '30s', intent: 'buy', count: 9 },
    ],
    genders: [
      { gender: 'male', count: 38 },
      { gender: 'female', count: 42 },
      { gender: 'other', count: 4 },
    ],
    ages: [
      { ageDecade: 'teens', count: 4 },
      { ageDecade: '20s', count: 21 },
      { ageDecade: '30s', count: 28 },
      { ageDecade: '40s', count: 18 },
      { ageDecade: '50s', count: 9 },
      { ageDecade: '60s_plus', count: 4 },
    ],
    demographics: [
      { gender: 'female', ageDecade: '20s', count: 13 },
      { gender: 'male', ageDecade: '30s', count: 12 },
      { gender: 'female', ageDecade: '30s', count: 14 },
    ],
    propertyInterests: [
      { gender: 'female', ageDecade: '20s', title: '堺市のワンルーム', sourceUrl: 'https://orijyu.com/rent/post-12.html', category: 'properties_for_rent', count: 8 },
      { gender: 'male', ageDecade: '30s', title: '和泉市の中古戸建', sourceUrl: 'https://orijyu.com/buy/post-88.html', category: 'properties_for_sale', count: 5 },
    ],
    funnel: { conversations: inProgress ? 84 : 486, consented_conversations: inProgress ? 4 : 18 },
    orinyanCommentary: inProgress ? null : {
      text: '7月は30代の相談が多かったにゃん。男性は購入、女性は賃貸をよく聞いていたにゃん。\n\n専門家じゃないから市場全体までは言い切れないけど、20代の女性には賃貸のワンルームを先に見せると話が早いにゃん。',
      generatedAt: '2026-08-01T18:40:00Z',
      model: 'gpt-5.4-nano',
    },
  };
}

const demoMode = ['localhost', '127.0.0.1'].includes(window.location.hostname);
export const ADMIN_SESSION_EXPIRED_EVENT = 'orient-admin-session-expired';

function adminHeaders(initial?: HeadersInit) {
  const headers = new Headers(initial);
  if (demoMode) headers.set('x-dev-admin', 'local-admin@orient.test');
  return headers;
}

async function request<T>(path: string, init?: RequestInit, fallback?: T): Promise<T> {
  try {
    const response = await fetch(path, { ...init, headers: adminHeaders(init?.headers), credentials: 'same-origin' });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (response.status === 401 && path.startsWith('/api/admin/')) {
        window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
      }
      throw new Error(payload?.error || `API ${response.status}`);
    }
    return await response.json() as T;
  } catch (error) {
    if (demoMode && fallback !== undefined) return fallback;
    throw error;
  }
}

export const api = {
  authSession: () => request<AdminSessionResponse>('/api/auth/admin/session', undefined, {
    authenticated: true,
    user: { loginId: 'local-admin', subject: 'local-admin' },
  }),
  login: (loginId: string, password: string) => request<AdminLoginResponse>('/api/auth/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loginId, password }) }),
  logout: () => request<{ ok: boolean }>('/api/auth/admin/logout', { method: 'POST' }),
  overview: () => request<OverviewData>('/api/admin/overview', undefined, mockOverviewData()),
  bootstrapKnowledge: () => request('/api/admin/knowledge/bootstrap', { method: 'POST' }),
  seedKnowledge: (prune = true) => request<{
    ok: boolean;
    accepted: Array<{ file: string; id: string; status: string }>;
    skipped: string[];
    incomplete: Array<{ file: string; id: string; status: string }>;
    deleted: string[];
    pruneRequested: boolean;
    pruneApplied: boolean;
    pruneBlockedReason: string | null;
    excluded: number;
    coveredByManualItem: number;
  }>('/api/admin/knowledge/seed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prune }),
  }, {
    ok: true,
    accepted: [],
    skipped: [],
    incomplete: [],
    deleted: [],
    pruneRequested: prune,
    pruneApplied: prune,
    pruneBlockedReason: null,
    excluded: 0,
    coveredByManualItem: 0,
  }),
  knowledge: async (options: KnowledgeListOptions = {}) => {
    const perPage = Math.min(1000, Math.max(1, options.perPage ?? 1000));
    const result: KnowledgeItem[] = [];
    const seen = new Set<string>();
    let page = 1;
    let totalCount = Number.POSITIVE_INFINITY;

    while (page <= 100 && result.length < totalCount) {
      const params = new URLSearchParams();
      if (options.query) params.set('q', options.query);
      if (options.category && options.category !== 'all') params.set('category', options.category);
      if (options.sort) params.set('sort', options.sort);
      params.set('page', String(page));
      params.set('perPage', String(perPage));
      const fallback = page === 1
        ? { result: mockKnowledge, result_info: { total_count: mockKnowledge.length, page: 1, per_page: perPage } }
        : undefined;
      const data = await request<{ result: KnowledgeItem[]; result_info: Record<string, number> }>(
        `/api/admin/knowledge?${params.toString()}`,
        undefined,
        fallback,
      );
      const before = result.length;
      for (const item of data.result) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        result.push(item);
      }
      const reportedTotal = Number(data.result_info.total_count);
      totalCount = Number.isFinite(reportedTotal) && reportedTotal >= 0 ? reportedTotal : result.length;
      if (data.result.length < perPage || result.length === before) break;
      page += 1;
    }

    return {
      result,
      result_info: {
        count: result.length,
        page: 1,
        per_page: perPage,
        total_count: Number.isFinite(totalCount) ? totalCount : result.length,
      },
    };
  },
  uploadKnowledge: (file: File, options: KnowledgeUploadOptions) => {
    const form = new FormData();
    form.set('file', file);
    form.set('title', options.title || file.name);
    form.set('category', options.category);
    if (options.sourceUrl?.trim()) form.set('sourceUrl', options.sourceUrl.trim());
    return request('/api/admin/knowledge', { method: 'POST', body: form });
  },
  createPropertyKnowledge: (input: PropertyKnowledgeInput) => request<PropertyKnowledgeSaveResult>(
    '/api/admin/knowledge/property',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
    { id: '', key: '', title: input.title, category: input.category, source_url: input.sourceUrl, replacedItemCount: 0, reindexStarted: true },
  ),
  propertyKnowledge: (id: string) => request<{ item: KnowledgeItem; property: PropertyKnowledgeInput | null }>(`/api/admin/knowledge/${id}`),
  updatePropertyKnowledge: (id: string, input: PropertyKnowledgeInput) => request<PropertyKnowledgeSaveResult>(
    `/api/admin/knowledge/${id}/property`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
    { id, key: '', title: input.title, category: input.category, source_url: input.sourceUrl, replacedItemCount: 0, reindexStarted: true },
  ),
  updateGeneralKnowledge: (id: string, input: GeneralKnowledgeUpdateInput) => {
    const form = new FormData();
    form.set('title', input.title);
    form.set('sourceUrl', input.sourceUrl?.trim() || '');
    if (input.file) form.set('file', input.file);
    if (input.content !== undefined) form.set('content', input.content);
    if (input.contentRevision) form.set('contentRevision', input.contentRevision);
    return request<GeneralKnowledgeSaveResult>(
      `/api/admin/knowledge/${id}`,
      { method: 'PUT', body: form },
      {
        id,
        key: '',
        title: input.title,
        category: 'general',
        source_url: input.sourceUrl || '',
        replacedItemCount: 0,
        reindexStarted: true,
      },
    );
  },
  generalKnowledgeContent: (id: string) => request<{ content: string; revision: string }>(
    `/api/admin/knowledge/${id}/content`,
    undefined,
    { content: '# 編集可能な資料\n\nここに Markdown / テキスト本文を入力してください。', revision: 'local-demo' },
  ),
  deleteKnowledge: (id: string) => request(`/api/admin/knowledge/${id}`, { method: 'DELETE' }, { ok: true }),
  reindexKnowledge: (id: string) => request<KnowledgeItem>(`/api/admin/knowledge/${id}/reindex`, { method: 'POST' }),
  conversations: (search = '') => {
    const params = new URLSearchParams({ page: '1', perPage: '100' });
    if (search.trim()) params.set('search', search.trim());
    return request<{ result: ConversationSummary[]; page: number; perPage: number }>(
      `/api/admin/conversations?${params.toString()}`,
      undefined,
      { result: mockConversations.filter((row) => !search.trim() || row.latest_message.includes(search.trim())), page: 1, perPage: 100 },
    );
  },
  inquiries: (page = 1, perPage = 50) => {
    const params = new URLSearchParams({ page: String(Math.max(1, page)), perPage: String(Math.min(100, Math.max(1, perPage))) });
    return request<{ result: CustomHomeInquiry[]; page: number; perPage: number; total: number }>(
      `/api/admin/inquiries?${params.toString()}`,
      undefined,
      { result: [], page: 1, perPage, total: 0 },
    );
  },
  conversation: (id: string) => request<{ conversation: Record<string, unknown>; messages: ConversationMessage[] }>(`/api/admin/conversations/${id}`, undefined, {
    conversation: { id },
    messages: [
      { id: `${id}-u`, role: 'user', content_redacted: mockConversations.find((row) => row.id === id)?.latest_message || '物件を探す方法を教えてください', policy_action: 'allow', created_at: '2026-08-09T09:23:00Z', citations: '[]' },
      { id: `${id}-a`, role: 'assistant', content_redacted: mockConversations.find((row) => row.id === id)?.has_refusal ? '価格交渉や個別の値引き判断はチャットではお答えできません。' : '公式サイトの登録情報をもとにご案内します。', policy_action: mockConversations.find((row) => row.id === id)?.has_refusal ? 'price_negotiation' : 'allow', created_at: '2026-08-09T09:23:02Z', citations: '[]' },
    ],
  }),
  monthlyReport: (month?: string) => request<{ availableMonths: string[]; report: MonthlyReport | null }>(`/api/admin/reports/monthly${month ? `?month=${encodeURIComponent(month)}` : ''}`, undefined, {
    availableMonths: ['2026-08', '2026-07'],
    report: mockMonthlyReport(month || '2026-08'),
  }),
  orinyanCommentary: (month: string) => request<{ availableMonths: string[]; report: MonthlyReport | null }>(
    '/api/admin/reports/monthly/commentary',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ month }) },
    {
      availableMonths: ['2026-08', '2026-07'],
      report: {
        ...mockMonthlyReport(month),
        orinyanCommentary: {
          text: 'いまのところ20代の女性が賃貸をよく見ているにゃん。堺市のワンルームが特に反応いいにゃん。\n\n専門家じゃないから断定はできないけど、この層には家賃の目安と駅徒歩を先に出すと会話が続きやすいにゃん。30代の男性は購入相談が多めだから、中古戸建をトップ付近に置いてみるにゃん。\n\nまだ月の途中だから、数字はこれから変わるにゃん。気になる層が来たら公式LINEへつなぐ準備をしておくとにゃん。',
          generatedAt: '2026-08-20T08:12:00Z',
          model: 'gpt-5.4-nano',
        },
      },
    },
  ),
  downloadConversations: async () => {
    const response = await fetch('/api/admin/conversations/export.csv', { headers: adminHeaders(), credentials: 'same-origin' });
    if (response.status === 401) window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
    if (!response.ok) throw new Error(`CSV export ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `orient-conversations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  settings: () => request('/api/admin/settings', undefined, {
    answer_policy: { domain: '不動産・住まい・物件・家づくり・店舗案内・問い合わせ方法', min_retrieval_score: 0.48, refuse_price_negotiation: true, refuse_legal_judgment: true, refuse_important_matters: true },
    retention: { conversation_days: 365, customer_days: 1095 },
    appearance: { primary: '#ff680b', ink: '#29293a', muted: '#74757f' },
    escalation: { line_url: '', contact_url: 'https://orijyu.com/reception.html' },
  }),
  saveSetting: (key: string, value: unknown) => request(`/api/admin/settings/${key}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) }, { ok: true }),
};
