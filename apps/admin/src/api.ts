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

export interface ConversationSummary {
  id: string;
  updated_at: string;
  source_page: string;
  message_count: number;
  latest_message: string;
  has_refusal: number;
  marketing_consent: number;
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
  questionTrends: Array<{ question: string; count: number }>;
  funnel: { conversations?: number } | null;
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
  policy: OverviewPolicyCount[];
  intents: OverviewIntentCount[];
  hours: OverviewHourCount[];
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

const demoMode = ['localhost', '127.0.0.1'].includes(window.location.hostname);

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
      throw new Error(payload?.error || `API ${response.status}`);
    }
    return await response.json() as T;
  } catch (error) {
    if (demoMode && fallback !== undefined) return fallback;
    throw error;
  }
}

export const api = {
  authSession: () => request<AdminSessionResponse>('/api/auth/admin/session'),
  login: (loginId: string, password: string) => request<AdminLoginResponse>('/api/auth/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loginId, password }) }),
  logout: () => request<{ ok: boolean }>('/api/auth/admin/logout', { method: 'POST' }),
  overview: () => request<OverviewData>('/api/admin/overview', undefined, mockOverviewData()),
  bootstrapKnowledge: () => request('/api/admin/knowledge/bootstrap', { method: 'POST' }),
  seedKnowledge: () => request<{ ok: boolean; accepted: Array<{ file: string; id: string }>; skipped: string[] }>('/api/admin/knowledge/seed', { method: 'POST' }, { ok: true, accepted: [], skipped: [] }),
  knowledge: (options: KnowledgeListOptions = {}) => {
    const params = new URLSearchParams();
    if (options.query) params.set('q', options.query);
    if (options.category && options.category !== 'all') params.set('category', options.category);
    if (options.sort) params.set('sort', options.sort);
    params.set('perPage', String(options.perPage ?? 1000));
    return request<{ result: KnowledgeItem[]; result_info: Record<string, number> }>(`/api/admin/knowledge?${params.toString()}`, undefined, { result: mockKnowledge, result_info: { total_count: 28, page: 1, per_page: 20 } });
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
  deleteKnowledge: (id: string) => request(`/api/admin/knowledge/${id}`, { method: 'DELETE' }, { ok: true }),
  reindexKnowledge: (id: string) => request(`/api/admin/knowledge/${id}/reindex`, { method: 'POST' }, { ok: true }),
  conversations: () => request('/api/admin/conversations', undefined, { result: mockConversations, page: 1, perPage: 30 }),
  conversation: (id: string) => request<{ conversation: Record<string, unknown>; messages: ConversationMessage[] }>(`/api/admin/conversations/${id}`, undefined, {
    conversation: { id },
    messages: [
      { id: `${id}-u`, role: 'user', content_redacted: mockConversations.find((row) => row.id === id)?.latest_message || '物件を探す方法を教えてください', policy_action: 'allow', created_at: '2026-08-09T09:23:00Z', citations: '[]' },
      { id: `${id}-a`, role: 'assistant', content_redacted: mockConversations.find((row) => row.id === id)?.has_refusal ? '価格交渉や個別の値引き判断はチャットではお答えできません。' : '公式サイトの登録情報をもとにご案内します。', policy_action: mockConversations.find((row) => row.id === id)?.has_refusal ? 'price_negotiation' : 'allow', created_at: '2026-08-09T09:23:02Z', citations: '[]' },
    ],
  }),
  monthlyReport: () => request<{ availableMonths: string[]; report: MonthlyReport | null }>('/api/admin/reports/monthly', undefined, {
    availableMonths: ['2026-07'],
    report: {
      month: '2026-07',
      generatedAt: '2026-08-01T18:27:00Z',
      questionTrends: [{ question: '物件を探す方法を教えてください', count: 28 }, { question: '店舗の営業時間を教えてください', count: 17 }, { question: '資料請求をしたいです', count: 15 }],
      funnel: { conversations: 486 },
    },
  }),
  downloadConversations: async () => {
    const response = await fetch('/api/admin/conversations/export.csv', { headers: adminHeaders(), credentials: 'same-origin' });
    if (!response.ok) throw new Error(`CSV export ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `orient-conversations-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  settings: () => request('/api/admin/settings', undefined, {
    answer_policy: { domain: '不動産・住まい・物件・家づくり・店舗案内・問い合わせ方法', min_retrieval_score: 0.48, refuse_price_negotiation: true, refuse_legal_judgment: true, refuse_important_matters: true },
    retention: { conversation_days: 365, customer_days: 1095 },
    appearance: { primary: '#ff680b', ink: '#29293a', muted: '#74757f' },
    escalation: { line_url: '', contact_url: 'https://orijyu.com/reception.html' },
  }),
  saveSetting: (key: string, value: unknown) => request(`/api/admin/settings/${key}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) }, { ok: true }),
};
