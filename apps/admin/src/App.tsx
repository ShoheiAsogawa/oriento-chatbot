import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Archive, BookOpen, Bot, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleAlert, Database, EllipsisVertical, Eye, File, FileCheck2, FileSpreadsheet,
  FileText, Gauge, History, Home, Link2, Menu, MessageSquareText, Paintbrush, Plus,
  RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, Trash2, UploadCloud,
  UserRound, UsersRound, X, Pencil,
} from 'lucide-react';
import {
  api,
  type AuditEvent,
  type AuditVerification,
  type ConversationMessage,
  type ConversationSummary,
  type Customer,
  type KnowledgeItem,
  type MonthlyReport,
  type OverviewData,
  type PropertyKnowledgeInput,
  mockAudit,
  mockConversations,
  mockCustomers,
} from './api';

type PageKey = 'overview' | 'reports' | 'knowledge' | 'conversations' | 'customers' | 'policy' | 'appearance' | 'audit';

const navItems: Array<{ key: PageKey; label: string; icon: typeof Home }> = [
  { key: 'overview', label: '概要', icon: Home },
  { key: 'reports', label: '月次レポート', icon: Gauge },
  { key: 'knowledge', label: 'ナレッジ', icon: BookOpen },
  { key: 'conversations', label: '会話ログ', icon: MessageSquareText },
  { key: 'customers', label: '顧客', icon: UsersRound },
  { key: 'policy', label: '応答設定', icon: SlidersHorizontal },
  { key: 'appearance', label: '外観', icon: Paintbrush },
  { key: 'audit', label: '監査', icon: ShieldCheck },
];

const orinyanSpriteStyle = { backgroundImage: "url('/assets/orinyan-states.png')" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(value / 1000)} KB`;
}

function parseTags(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function Status({ value }: { value: KnowledgeItem['status'] }) {
  const map = {
    completed: ['反映済み', 'success'], running: ['処理中', 'processing'], queued: ['待機中', 'processing'],
    error: ['エラー', 'error'], skipped: ['対象外', 'muted'], outdated: ['要更新', 'warning'],
  } as const;
  const [label, className] = map[value];
  return <span className={`status ${className}`}>{label}</span>;
}

function FileIcon({ name }: { name: string }) {
  if (/\.xlsx?$/i.test(name)) return <FileSpreadsheet className="file-icon sheet" />;
  if (/\.pdf$/i.test(name)) return <FileText className="file-icon pdf" />;
  if (/\.(docx?|txt|md)$/i.test(name)) return <FileText className="file-icon doc" />;
  return <File className="file-icon" />;
}

const KNOWLEDGE_PAGE_SIZE = 50;
const propertyNameCollator = new Intl.Collator('ja-JP', { numeric: true, sensitivity: 'base' });

type KnowledgeFilter = 'all' | 'properties_for_sale' | 'properties_for_rent' | 'other';
type KnowledgeSortOrder = 'title_asc' | 'title_desc' | 'recent';
type KnowledgeAddMode = 'property' | 'document';
type PropertyTextField = Exclude<keyof PropertyKnowledgeInput, 'category' | 'features'>;

function createEmptyPropertyKnowledge(): PropertyKnowledgeInput {
  return {
    title: '',
    category: 'properties_for_sale',
    sourceUrl: '',
    address: '',
    lineStation: '',
    priceOrRent: '',
    managementFee: '',
    layout: '',
    floorArea: '',
    buildingType: '',
    builtYear: '',
    floor: '',
    availability: '',
    features: [],
    notes: '',
  };
}

function propertyCategoryLabel(category: PropertyKnowledgeInput['category']) {
  return category === 'properties_for_sale' ? '売買物件' : '賃貸物件';
}

function parsePropertyFeatures(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[・•*-]\s*/, '').trim())
    .filter(Boolean);
}

function propertyKnowledgePreview(input: PropertyKnowledgeInput) {
  const fieldLines = [
    ['所在地', input.address],
    ['沿線・駅', input.lineStation],
    ['価格・賃料', input.priceOrRent],
    ['管理費', input.managementFee],
    ['間取り', input.layout],
    ['専有面積', input.floorArea],
    ['建物種別', input.buildingType],
    ['築年', input.builtYear],
    ['階数', input.floor],
    ['入居・引渡し時期', input.availability],
  ].flatMap(([label, value]) => value?.trim() ? [`- ${label}: ${value.trim()}`] : []);

  const features = input.features.filter(Boolean);
  return [
    `# ${input.title.trim() || '物件名（入力中）'}`,
    '',
    `- 種別: ${propertyCategoryLabel(input.category)}`,
    `- 公式詳細ページ: ${input.sourceUrl.trim() || '未入力'}`,
    ...fieldLines,
    ...(features.length ? ['', '## 特徴', ...features.map((feature) => `- ${feature}`)] : []),
    ...(input.notes?.trim() ? ['', '## 備考', input.notes.trim()] : []),
  ].join('\n');
}

function knowledgeValue(item: KnowledgeItem, field: 'title' | 'category' | 'source_url') {
  const direct = item[field];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const metadataValue = item.metadata?.[field];
  return typeof metadataValue === 'string' ? metadataValue.trim() : '';
}

function knowledgeTitle(item: KnowledgeItem) {
  return knowledgeValue(item, 'title') || item.key;
}

function knowledgeCategory(item: KnowledgeItem) {
  const category = knowledgeValue(item, 'category');
  if (category === 'sale') return 'properties_for_sale';
  if (category === 'rent') return 'properties_for_rent';
  return category || 'general';
}

function knowledgeCategoryLabel(item: KnowledgeItem) {
  switch (knowledgeCategory(item)) {
    case 'properties_for_sale': return '売買物件';
    case 'properties_for_rent': return '賃貸物件';
    default: return '一般資料';
  }
}

function knowledgeSourceUrl(item: KnowledgeItem) {
  return knowledgeValue(item, 'source_url');
}

function isPropertyKnowledge(item: KnowledgeItem) {
  const category = knowledgeCategory(item);
  return category === 'properties_for_sale' || category === 'properties_for_rent';
}

function Sidebar({ page, onPage, collapsed, onToggle }: { page: PageKey; onPage: (page: PageKey) => void; collapsed: boolean; onToggle: () => void }) {
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
    <nav aria-label="管理メニュー">
      {navItems.map(({ key, label, icon: Icon }) => (
        <button key={key} className={page === key ? 'active' : ''} onClick={() => onPage(key)} title={collapsed ? label : undefined}>
          <Icon /><span>{label}</span>
        </button>
      ))}
    </nav>
    <button className="sidebar-toggle" onClick={onToggle} aria-label={collapsed ? 'メニューを開く' : 'メニューを折りたたむ'}>
      <ChevronLeft /><span>メニューを折りたたむ</span>
    </button>
  </aside>;
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

function OverviewPage() {
  const [data, setData] = useState<OverviewData>({
    conversations30d: 0,
    customers: 0,
    refused30d: 0,
    knowledgeItems: 0,
    costGuard: { day: '', sessions: 0, sessionLimit: 500, aiRequests: 0, aiRequestLimit: 2000 },
  });
  const [recent, setRecent] = useState<ConversationSummary[]>(mockConversations);
  const [auditHealthy, setAuditHealthy] = useState<boolean | null>(null);
  useEffect(() => {
    void api.overview().then(setData);
    void api.conversations().then((result) => setRecent(result.result.slice(0, 4)));
    void api.verifyAudit().then((result) => setAuditHealthy(result.verified && !result.truncated));
  }, []);
  const metrics = [
    ['過去30日の会話', data.conversations30d.toLocaleString(), MessageSquareText, '直近30日を集計'],
    ['同意済み顧客', data.customers.toLocaleString(), UsersRound, '営業同意済みのみ'],
    ['回答を控えた質問', data.refused30d.toLocaleString(), CircleAlert, '担当確認の候補'],
    ['ナレッジ資料', data.knowledgeItems.toLocaleString(), Database, 'AI Search登録数'],
  ] as const;
  return <>
    <PageHeader title="概要" description="チャットボットの稼働状況と、対応が必要な項目を確認します。" />
    <section className="metric-strip">
      {metrics.map(([label, value, Icon, note]) => <div className="metric" key={label}><Icon /><p>{label}</p><strong>{value}</strong><small>{note}</small></div>)}
    </section>
    <div className="overview-grid">
      <section className="surface activity-list">
        <div className="section-heading"><div><h2>最近の会話</h2><p>直近の質問と回答状態</p></div><button className="text-button">すべて見る <ChevronRight /></button></div>
        {recent.map((item) => <button className="activity-row" key={item.id}>
          <span className={`activity-icon ${item.has_refusal ? 'warn' : ''}`}>{item.has_refusal ? <CircleAlert /> : <MessageSquareText />}</span>
          <span><strong>{item.latest_message}</strong><small>{item.source_page}</small></span>
          <time>{formatDate(item.updated_at)}</time><ChevronRight />
        </button>)}
      </section>
      <section className="surface attention-list">
        <div className="section-heading"><div><h2>確認が必要</h2><p>運用担当者向けの通知</p></div></div>
        <div className="attention"><span className="warning-dot"></span><div><strong>回答を控えた質問</strong><p>過去30日で{data.refused30d.toLocaleString()}件あります。会話ログから確認できます。</p></div><ChevronRight /></div>
        <div className="attention"><span className="info-dot"></span><div><strong>ナレッジの登録状況</strong><p>{data.knowledgeItems.toLocaleString()}件の資料が管理対象です。</p></div><ChevronRight /></div>
        <div className="attention"><span className={data.costGuard.aiRequests / data.costGuard.aiRequestLimit >= .8 ? 'warning-dot' : 'success-dot'}></span><div><strong>日次コストガード</strong><p>AI回答 {data.costGuard.aiRequests.toLocaleString()} / {data.costGuard.aiRequestLimit.toLocaleString()}件、セッション {data.costGuard.sessions.toLocaleString()} / {data.costGuard.sessionLimit.toLocaleString()}件</p></div><Gauge /></div>
        <div className="attention"><span className={auditHealthy ? 'success-dot' : 'warning-dot'}></span><div><strong>{auditHealthy === null ? '監査台帳を確認中' : auditHealthy ? '監査台帳は正常です' : '監査台帳を確認してください'}</strong><p>月次ハッシュチェーンの検証結果です。</p></div>{auditHealthy ? <Check /> : <ChevronRight />}</div>
      </section>
    </div>
  </>;
}

function ReportsPage() {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  useEffect(() => { void api.monthlyReport().then((data) => { setReport(data.report); setMonths(data.availableMonths); }); }, []);
  if (!report) return <><PageHeader title="月次レポート" description="質問傾向、回答判定、顧客化状況を月ごとに確認します。" /><div className="surface report-empty"><Gauge /><p>最初の月次集計後にレポートが表示されます。</p></div></>;
  const totalAnswers = report.policySummary.reduce((sum, item) => sum + Number(item.count), 0);
  const conversations = Number(report.funnel?.conversations || 0);
  const consented = Number(report.funnel?.consented_conversations || 0);
  const consentRate = conversations ? ((consented / conversations) * 100).toFixed(1) : '0.0';
  const maxQuestionCount = Math.max(1, ...report.questionTrends.map((item) => Number(item.count)));
  return <><PageHeader title="月次レポート" description="質問傾向、回答判定、顧客化状況を月ごとに確認します。" action={<button className="select-button">{report.month} <ChevronDown /></button>} />
    <section className="metric-strip report-metrics"><div className="metric"><MessageSquareText /><p>会話</p><strong>{conversations.toLocaleString()}</strong><small>対象月の開始数</small></div><div className="metric"><Bot /><p>回答判定</p><strong>{totalAnswers.toLocaleString()}</strong><small>AI・拒否判定を含む</small></div><div className="metric"><UsersRound /><p>顧客同意</p><strong>{consented.toLocaleString()}</strong><small>会話比 {consentRate}%</small></div><div className="metric"><History /><p>保存月</p><strong>{months.length}</strong><small>R2月次JSON</small></div></section>
    <div className="report-grid"><section className="surface"><div className="section-heading"><div><h2>よくある質問</h2><p>PIIマスク後の質問文を集計</p></div></div><div className="trend-list">{report.questionTrends.slice(0, 10).map((item, index) => <div key={`${item.question}-${index}`}><span>{index + 1}</span><p>{item.question}</p><i style={{ width: `${Math.max(8, (Number(item.count) / maxQuestionCount) * 100)}%` }} /><strong>{Number(item.count).toLocaleString()}件</strong></div>)}</div></section><section className="surface"><div className="section-heading"><div><h2>回答ポリシー</h2><p>回答・拒否理由ごとの件数</p></div></div><div className="policy-summary-list">{report.policySummary.map((item) => <div key={item.policy_action}><code>{item.policy_action}</code><strong>{Number(item.count).toLocaleString()}件</strong><span>{totalAnswers ? `${((Number(item.count) / totalAnswers) * 100).toFixed(1)}%` : '0%'}</span></div>)}</div></section></div>
    <p className="report-generated">生成日時: {formatDate(report.generatedAt)} / 保存先: R2 reports/{report.month}.json</p>
  </>;
}

function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<KnowledgeItem | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filter, setFilter] = useState<KnowledgeFilter>('all');
  const [sort, setSort] = useState<KnowledgeSortOrder>('title_asc');
  const [page, setPage] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<KnowledgeAddMode>('property');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [propertyForm, setPropertyForm] = useState<PropertyKnowledgeInput>(createEmptyPropertyKnowledge);
  const [featureText, setFeatureText] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentSourceUrl, setDocumentSourceUrl] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const generatedPropertyKnowledge = useMemo(() => propertyKnowledgePreview(propertyForm), [propertyForm]);

  const load = useCallback(async (preferredId?: string) => {
    setLoading(true);
    try {
      const data = await api.knowledge({ perPage: 1000 });
      setItems(data.result);
      setTotal(Number(data.result_info.total_count || data.result.length));
      setSelected((current) => {
        const selectedId = preferredId || current?.id;
        if (!selectedId) return data.result[0] || null;
        return data.result.find((item) => item.id === selectedId) || data.result[0] || null;
      });
    } catch (error) {
      setNotice(error instanceof Error ? `ナレッジを読み込めませんでした: ${error.message}` : 'ナレッジを読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase('ja-JP');
    const rows = items.filter((item) => {
      const itemCategory = knowledgeCategory(item);
      const categoryMatches = filter === 'all'
        || (filter === 'other' ? !isPropertyKnowledge(item) : itemCategory === filter);
      if (!categoryMatches) return false;
      if (!query) return true;
      return [knowledgeTitle(item), item.key, knowledgeSourceUrl(item)]
        .some((value) => value.toLocaleLowerCase('ja-JP').includes(query));
    });

    return rows.sort((left, right) => {
      if (sort === 'recent') {
        const recentFirst = Date.parse(right.last_seen_at) - Date.parse(left.last_seen_at);
        return recentFirst || propertyNameCollator.compare(knowledgeTitle(left), knowledgeTitle(right));
      }
      const compared = propertyNameCollator.compare(knowledgeTitle(left), knowledgeTitle(right));
      return sort === 'title_desc' ? -compared : compared;
    });
  }, [deferredSearch, filter, items, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / KNOWLEDGE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => filteredItems.slice((currentPage - 1) * KNOWLEDGE_PAGE_SIZE, currentPage * KNOWLEDGE_PAGE_SIZE),
    [currentPage, filteredItems],
  );
  const firstItem = filteredItems.length ? (currentPage - 1) * KNOWLEDGE_PAGE_SIZE + 1 : 0;
  const lastItem = Math.min(currentPage * KNOWLEDGE_PAGE_SIZE, filteredItems.length);

  const updateFilter = (next: KnowledgeFilter) => { setFilter(next); setPage(1); setSelected(null); };
  const updateSort = (next: KnowledgeSortOrder) => { setSort(next); setPage(1); };
  const updateSearch = (next: string) => { setSearch(next); setPage(1); setSelected(null); };

  const updatePropertyText = (field: PropertyTextField, value: string) => {
    setPropertyForm((current) => ({ ...current, [field]: value }));
  };

  const updatePropertyFeatures = (value: string) => {
    setFeatureText(value);
    setPropertyForm((current) => ({ ...current, features: parsePropertyFeatures(value) }));
  };

  const resetAddForm = () => {
    setAddMode('property');
    setEditingId(null);
    setPropertyForm(createEmptyPropertyKnowledge());
    setFeatureText('');
    setDocumentTitle('');
    setDocumentSourceUrl('');
    setDragging(false);
  };

  const openAddForm = () => {
    resetAddForm();
    setAddOpen(true);
    setNotice(null);
  };

  const closeAddForm = () => {
    setAddOpen(false);
    setDragging(false);
  };

  const openEditForm = async () => {
    if (!selected || !isPropertyKnowledge(selected)) return;
    setBusy(true);
    setNotice(null);
    try {
      const data = await api.propertyKnowledge(selected.id);
      if (!data.property) throw new Error('物件情報を取得できませんでした');
      setPropertyForm(data.property);
      setFeatureText(data.property.features.join('\n'));
      setEditingId(selected.id);
      setAddMode('property');
      setAddOpen(true);
    } catch (error) {
      setNotice(error instanceof Error ? `編集内容を読み込めませんでした: ${error.message}` : '編集内容を読み込めませんでした');
    } finally {
      setBusy(false);
    }
  };

  const uploadDocument = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setNotice(null);
    try {
      const title = documentTitle.trim() || file.name;
      await api.uploadKnowledge(file, { title, category: 'general', sourceUrl: documentSourceUrl.trim() });
      closeAddForm();
      setDocumentTitle('');
      setDocumentSourceUrl('');
      setNotice(`「${title}」を登録しました。インデックス作成後に回答へ反映されます。`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? `登録できませんでした: ${error.message}` : '登録できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const saveProperty = async () => {
    const input: PropertyKnowledgeInput = {
      ...propertyForm,
      title: propertyForm.title.trim(),
      sourceUrl: propertyForm.sourceUrl.trim(),
      features: propertyForm.features.filter(Boolean),
    };
    if (!input.title || !input.sourceUrl) {
      setNotice('物件名と公式詳細ページURLを入力してください。');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = editingId
        ? await api.updatePropertyKnowledge(editingId, input)
        : await api.createPropertyKnowledge(input);
      closeAddForm();
      resetAddForm();
      setNotice(`「${input.title}」を保存しました。再インデックスを自動開始し、完了後に回答へ反映します。`);
      await load(result.id || undefined);
    } catch (error) {
      setNotice(error instanceof Error ? `物件ナレッジを保存できませんでした: ${error.message}` : '物件ナレッジを保存できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!window.confirm(`「${knowledgeTitle(selected)}」を削除します。成約済みとしてチャットの候補から外す場合に実行してください。`)) return;
    setBusy(true);
    setNotice(null);
    try {
      await api.deleteKnowledge(selected.id);
      setItems((current) => current.filter((item) => item.id !== selected.id));
      setTotal((current) => Math.max(0, current - 1));
      setSelected(null);
      setNotice(`「${knowledgeTitle(selected)}」を削除しました。`);
    } catch (error) {
      setNotice(error instanceof Error ? `削除できませんでした: ${error.message}` : '削除できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const reindex = async () => {
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    try {
      await api.reindexKnowledge(selected.id);
      setNotice(`「${knowledgeTitle(selected)}」の再インデックスを開始しました。`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? `再インデックスを開始できませんでした: ${error.message}` : '再インデックスを開始できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const seed = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await api.seedKnowledge();
      setSeeded(true);
      setNotice('初期ナレッジの同期を開始しました。');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? `同期を開始できませんでした: ${error.message}` : '同期を開始できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const selectedSourceUrl = selected ? knowledgeSourceUrl(selected) : '';

  return <div className="split-page knowledge-page">
    <main className="split-main">
      <PageHeader
        title="物件ナレッジ"
        description="物件は1件ごとに管理します。成約済みになった物件だけを削除し、必要な物件だけを追加できます。"
        action={<div className="page-actions">
          <button className="secondary-button" onClick={() => void seed()} disabled={busy}><Database />{seeded ? '初期ナレッジ同期済み' : '初期ナレッジを同期'}</button>
          <button className="primary-button" onClick={openAddForm} disabled={busy}><Plus />物件・資料を追加</button>
        </div>}
      />
      <input
        ref={fileInput}
        type="file"
        hidden
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.webp"
        onChange={(event) => {
          void uploadDocument(event.target.files);
          event.target.value = '';
        }}
      />

      {addOpen ? <section className="knowledge-add surface" aria-label={editingId ? '物件ナレッジを編集' : '物件・資料を1件追加'}>
        <div className="section-heading"><div><h2>{editingId ? '物件ナレッジを編集' : '物件・資料を1件追加'}</h2><p>{editingId ? '保存すると既存のナレッジを更新し、再インデックスを自動開始します。' : '物件は定型フォームだけで登録できます。資料は従来どおりファイルをアップロードします。'}</p></div><button className="square-button" type="button" onClick={closeAddForm} aria-label="フォームを閉じる"><X /></button></div>
        <div className="knowledge-add-mode" role="tablist" aria-label="登録方法">
          <button type="button" role="tab" aria-selected={addMode === 'property'} className={addMode === 'property' ? 'active' : ''} onClick={() => setAddMode('property')}><Home />物件を定型登録</button>
          <button type="button" role="tab" aria-selected={addMode === 'document'} className={addMode === 'document' ? 'active' : ''} onClick={() => setAddMode('document')} disabled={Boolean(editingId)}><UploadCloud />一般資料をアップロード</button>
        </div>
        {addMode === 'property' ? <form className="knowledge-add-body property-knowledge-form" onSubmit={(event) => { event.preventDefault(); void saveProperty(); }}>
          <div className="property-form-fields">
            <label className="knowledge-field"><span>取引種別 <em>必須</em></span><select value={propertyForm.category} onChange={(event) => setPropertyForm((current) => ({ ...current, category: event.target.value as PropertyKnowledgeInput['category'] }))} required><option value="properties_for_sale">売買</option><option value="properties_for_rent">賃貸</option></select></label>
            <label className="knowledge-field"><span>物件名 <em>必須</em></span><input value={propertyForm.title} onChange={(event) => updatePropertyText('title', event.target.value)} placeholder="例：オリエント梅田レジデンス 502号室" autoComplete="off" required /></label>
            <label className="knowledge-field knowledge-field-wide"><span>公式詳細ページURL <em>必須</em></span><input value={propertyForm.sourceUrl} onChange={(event) => updatePropertyText('sourceUrl', event.target.value)} type="url" placeholder="https://orijyu.com/..." inputMode="url" autoComplete="url" required /><small>チャットに表示する「詳細を見る」リンクに使います。</small></label>
            <label className="knowledge-field"><span>所在地</span><input value={propertyForm.address} onChange={(event) => updatePropertyText('address', event.target.value)} placeholder="例：大阪府大阪市北区…" autoComplete="street-address" /></label>
            <label className="knowledge-field"><span>沿線・駅</span><input value={propertyForm.lineStation} onChange={(event) => updatePropertyText('lineStation', event.target.value)} placeholder="例：JR大阪環状線 大阪駅 徒歩8分" /></label>
            <label className="knowledge-field"><span>価格・賃料</span><input value={propertyForm.priceOrRent} onChange={(event) => updatePropertyText('priceOrRent', event.target.value)} placeholder="例：3,980万円 / 8.5万円" inputMode="decimal" /></label>
            <label className="knowledge-field"><span>管理費</span><input value={propertyForm.managementFee} onChange={(event) => updatePropertyText('managementFee', event.target.value)} placeholder="例：8,000円" inputMode="decimal" /></label>
            <label className="knowledge-field"><span>間取り</span><input value={propertyForm.layout} onChange={(event) => updatePropertyText('layout', event.target.value)} placeholder="例：2LDK" /></label>
            <label className="knowledge-field"><span>専有面積</span><input value={propertyForm.floorArea} onChange={(event) => updatePropertyText('floorArea', event.target.value)} placeholder="例：58.42㎡" inputMode="decimal" /></label>
            <label className="knowledge-field"><span>建物種別</span><input value={propertyForm.buildingType} onChange={(event) => updatePropertyText('buildingType', event.target.value)} placeholder="例：中古マンション" /></label>
            <label className="knowledge-field"><span>築年</span><input value={propertyForm.builtYear} onChange={(event) => updatePropertyText('builtYear', event.target.value)} placeholder="例：2018年3月" /></label>
            <label className="knowledge-field"><span>階数</span><input value={propertyForm.floor} onChange={(event) => updatePropertyText('floor', event.target.value)} placeholder="例：5階 / 15階建" /></label>
            <label className="knowledge-field knowledge-field-wide"><span>入居・引渡し時期</span><input value={propertyForm.availability} onChange={(event) => updatePropertyText('availability', event.target.value)} placeholder="例：即入居可 / 2026年10月上旬引渡し予定" /></label>
            <label className="knowledge-field knowledge-field-wide"><span>特徴</span><textarea value={featureText} onChange={(event) => updatePropertyFeatures(event.target.value)} rows={4} placeholder={'1行につき1項目で入力\n例：\n・南向き\n・ペット相談可\n・オートロック'} /><small>箇条書きで入力すると、回答で探しやすい特徴として登録されます。</small></label>
            <label className="knowledge-field knowledge-field-wide"><span>備考</span><textarea value={propertyForm.notes} onChange={(event) => updatePropertyText('notes', event.target.value)} rows={3} placeholder="例：内覧は事前予約制です。" /></label>
          </div>
          <section className="property-knowledge-preview" aria-labelledby="property-knowledge-preview-title">
            <div className="property-preview-heading"><div><h3 id="property-knowledge-preview-title">生成されるナレッジのプレビュー</h3><p>この形式で1物件ずつAI検索に登録されます。</p></div><Eye /></div>
            <pre aria-live="polite">{generatedPropertyKnowledge}</pre>
          </section>
          <div className="property-form-actions"><p><em>必須</em> の項目を入力すると{editingId ? '保存できます。保存後は再インデックスされます。' : '登録できます。'}</p><button type="submit" className="primary-button" disabled={busy}>{busy ? '保存しています…' : editingId ? '変更を保存' : '物件ナレッジを登録'}</button></div>
        </form> : <div className="knowledge-add-body document-knowledge-form">
          <label className="knowledge-field"><span>資料名（任意）</span><input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="未入力の場合はファイル名を使います" autoComplete="off" /></label>
          <label className="knowledge-field"><span>関連ページURL（任意）</span><input value={documentSourceUrl} onChange={(event) => setDocumentSourceUrl(event.target.value)} type="url" placeholder="https://orijyu.com/..." inputMode="url" autoComplete="url" /></label>
          <button
            type="button"
            className={`dropzone knowledge-dropzone ${dragging ? 'dragging' : ''}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); void uploadDocument(event.dataTransfer.files); }}
            disabled={busy}
          >
            <UploadCloud /><span><strong>{busy ? '処理しています…' : 'ファイルを選択して登録'}</strong><small>PDF、DOCX、XLSX、CSV、画像（最大4MB / 1ファイル）</small></span>
          </button>
        </div>}
      </section> : null}

      {notice ? <p className="knowledge-notice" role="status">{notice}</p> : null}

      <div className="table-tools knowledge-tools">
        <label className="search-field"><Search /><input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="物件名・資料名で検索" /></label>
        <label className="knowledge-select"><span>分類</span><select value={filter} onChange={(event) => updateFilter(event.target.value as KnowledgeFilter)}><option value="all">すべて</option><option value="properties_for_sale">売買物件</option><option value="properties_for_rent">賃貸物件</option><option value="other">一般資料</option></select></label>
        <label className="knowledge-select"><span>並び順</span><select value={sort} onChange={(event) => updateSort(event.target.value as KnowledgeSortOrder)}><option value="title_asc">物件名（昇順）</option><option value="title_desc">物件名（降順）</option><option value="recent">更新日時（新しい順）</option></select></label>
        <button className="square-button" onClick={() => void load()} aria-label="再読み込み" disabled={loading || busy}><RefreshCw /></button>
      </div>

      <div className="knowledge-result-summary"><strong>{filteredItems.length.toLocaleString()}件</strong><span>全{total.toLocaleString()}件のナレッジから表示</span></div>
      <div className="data-table knowledge-table" role="table" aria-label="物件ナレッジ一覧">
        <div className="table-head" role="row"><span>物件名・資料名</span><span>分類</span><span>状態</span><span>更新日</span><span>チャンク</span><span>操作</span></div>
        {pageItems.map((item) => <button className={`table-row ${selected?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setSelected(item)} role="row">
          <span className="file-cell"><FileIcon name={item.key} /><span><strong>{knowledgeTitle(item)}</strong><small>{formatBytes(item.file_size)}</small></span></span>
          <span><i className={`knowledge-category ${knowledgeCategory(item)}`}>{knowledgeCategoryLabel(item)}</i></span>
          <span><Status value={item.status} /></span><time>{formatDate(item.last_seen_at)}</time><span>{item.chunks_count ? item.chunks_count.toLocaleString() : '—'}</span><span className="row-action"><EllipsisVertical /></span>
        </button>)}
        {!loading && pageItems.length === 0 ? <div className="knowledge-empty" role="row"><FileCheck2 /><p>条件に一致する物件・資料はありません。</p></div> : null}
      </div>
      <footer className="pagination"><span>{filteredItems.length ? `${firstItem}–${lastItem}` : '0'} / {filteredItems.length.toLocaleString()}件</span><div><button aria-label="前へ" disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft /></button><button className="current">{currentPage}</button><button aria-label="次へ" disabled={currentPage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ChevronRight /></button></div></footer>
    </main>
    <aside className={`detail-drawer ${selected ? 'open' : ''}`}>
      {selected ? <>
        <div className="drawer-heading"><h2>ナレッジの詳細</h2><button onClick={() => setSelected(null)} aria-label="閉じる"><X /></button></div>
        <div className="drawer-file"><FileIcon name={selected.key} /><div><strong>{knowledgeTitle(selected)}</strong><small>{formatBytes(selected.file_size)}</small></div></div>
        <dl className="detail-list">
          <div><dt>分類</dt><dd><i className={`knowledge-category ${knowledgeCategory(selected)}`}>{knowledgeCategoryLabel(selected)}</i></dd></div>
          <div><dt>公式詳細ページ</dt><dd className="source-url">{selectedSourceUrl ? <><Link2 /><a href={selectedSourceUrl} target="_blank" rel="noreferrer">{selectedSourceUrl}</a></> : '未登録'}</dd></div>
          <div><dt>登録日</dt><dd>{formatDate(selected.created_at)}</dd></div>
          <div><dt>インデックス状態</dt><dd><Status value={selected.status} /><small>{selected.chunks_count.toLocaleString()} チャンク</small></dd></div>
        </dl>
        <div className="drawer-actions"><h3>アクション</h3>{isPropertyKnowledge(selected) ? <button onClick={() => void openEditForm()} disabled={busy}><Pencil />編集</button> : null}<button onClick={() => void reindex()} disabled={busy}><RefreshCw />再インデックス</button><button className="danger" onClick={() => void remove()} disabled={busy}><Trash2 />この物件・資料を削除</button><p>保存時は再インデックスを自動開始します。成約済みの物件は削除してください。</p></div>
        <WidgetPreview />
      </> : <div className="empty-detail"><FileCheck2 /><p>物件・資料を選択すると詳細が表示されます。</p></div>}
    </aside>
  </div>;
}

function WidgetPreview() {
  return <section className="widget-preview"><div className="preview-title"><h3>ウィジェットプレビュー</h3><Eye /></div><div className="mini-widget"><header><span className="mini-cat" style={orinyanSpriteStyle}></span><div><strong>オリにゃんに相談</strong><small>● オンライン</small></div></header><div className="mini-message"><span className="mini-cat" style={orinyanSpriteStyle}></span><p>こんにちは！<br />何かお困りのことはありますか？</p></div><div className="mini-input">メッセージを入力… <span>➤</span></div></div></section>;
}

function ConversationsPage() {
  const [rows, setRows] = useState<ConversationSummary[]>(mockConversations);
  const [selected, setSelected] = useState<ConversationSummary | null>(mockConversations[0] || null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  useEffect(() => { void api.conversations().then((data) => { setRows(data.result); setSelected((current) => data.result.find((row) => row.id === current?.id) || data.result[0] || null); }); }, []);
  useEffect(() => { if (selected) void api.conversation(selected.id).then((data) => setMessages(data.messages)); }, [selected]);
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  return <div className="split-page logs-page"><main className="split-main"><PageHeader title="会話ログ" description="記録された質問と回答、参照資料、ポリシー判定を確認します。" action={<button className="secondary-button" onClick={() => void api.downloadConversations()}><Archive />CSV出力</button>} />
    <div className="table-tools"><label className="search-field"><Search /><input placeholder="会話内容で検索" /></label><button className="select-button">過去30日 <ChevronDown /></button><button className="select-button">すべての判定 <ChevronDown /></button></div>
    <div className="conversation-list"><div className="conversation-head"><span>日時</span><span>最新の質問</span><span>ページ</span><span>判定</span><span>顧客化</span></div>{rows.map((row) => <button key={row.id} className={selected?.id === row.id ? 'selected' : ''} onClick={() => setSelected(row)}><time>{formatDate(row.updated_at)}</time><span><strong>{row.latest_message}</strong><small>{row.message_count}メッセージ</small></span><code>{row.source_page}</code><span>{row.has_refusal ? <span className="status warning">要確認</span> : <span className="status success">回答</span>}</span><span>{row.marketing_consent ? <Check className="consent-check" /> : '—'}</span></button>)}</div>
  </main><aside className="detail-drawer open conversation-detail"><div className="drawer-heading"><div><h2>会話の詳細</h2><p>{selected?.id}</p></div><button onClick={() => setSelected(null)} aria-label="閉じる"><X /></button></div>{selected ? <><div className="conversation-meta"><span><History />{formatDate(selected.updated_at)}</span><span><Link2 />{selected.source_page}</span></div><div className="transcript">{messages.map((message) => <div key={message.id} className={message.role === 'user' ? 'transcript-user' : 'transcript-bot'}>{message.content_redacted}{message.role === 'assistant' && message.policy_action === 'allow' ? <small>出典は保存済みのナレッジ資料を参照</small> : null}</div>)}</div><div className="policy-result"><ShieldCheck /><div><strong>ポリシー判定</strong><p>{lastAssistant?.policy_action || '確認中'} {lastAssistant?.policy_action === 'allow' ? '— 根拠資料あり' : '— 回答を拒否または担当者へ案内'}</p></div></div></> : <div className="empty-detail"><MessageSquareText /><p>会話を選択してください。</p></div>}</aside></div>;
}

function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>(mockCustomers);
  const [selected, setSelected] = useState<Customer | null>(mockCustomers[0] || null);
  const [status, setStatus] = useState<Customer['status']>(selected?.status || 'new');
  const [notes, setNotes] = useState(selected?.notes || '');
  useEffect(() => { void api.customers().then((data) => { setRows(data.result); setSelected(data.result[0] || null); }); }, []);
  useEffect(() => { if (selected) { setStatus(selected.status); setNotes(selected.notes || ''); } }, [selected]);
  const save = async () => { if (!selected) return; await api.updateCustomer(selected.id, { status, notes }); setRows((current) => current.map((row) => row.id === selected.id ? { ...row, status, notes } : row)); setSelected({ ...selected, status, notes }); };
  return <div className="split-page"><main className="split-main"><PageHeader title="顧客" description="明示的に連絡へ同意した訪問者だけを顧客データベースへ取り込みます。" action={<button className="secondary-button" onClick={() => void api.downloadCustomers()}><Archive />CSV出力</button>} />
    <div className="privacy-banner"><ShieldCheck /><div><strong>同意ベースの顧客管理</strong><p>メール・電話番号は暗号化して保存され、回答生成には送信されません。</p></div></div>
    <div className="table-tools"><label className="search-field"><Search /><input placeholder="氏名・メールで検索" /></label><button className="select-button">すべてのステータス <ChevronDown /></button></div>
    <div className="customer-table"><div className="customer-head"><span>顧客</span><span>ステータス</span><span>関心</span><span>会話</span><span>更新日</span></div>{rows.map((row) => <button key={row.id} className={selected?.id === row.id ? 'selected' : ''} onClick={() => setSelected(row)}><span className="customer-name"><span className="avatar">{(row.name || '?').slice(0, 1)}</span><span><strong>{row.name || '氏名未登録'}</strong><small>{row.email || row.phone || '連絡先なし'}</small></span></span><span className={`crm-status ${row.status}`}>{row.status === 'new' ? '新規' : row.status === 'contacted' ? '連絡済み' : row.status === 'qualified' ? '見込み' : '完了'}</span><span className="tag-list">{parseTags(row.tags).map((tag) => <i key={tag}>{tag}</i>)}</span><span>{row.conversation_count}件</span><time>{formatDate(row.updated_at)}</time></button>)}</div>
  </main><aside className="detail-drawer open customer-detail"><div className="drawer-heading"><h2>顧客の詳細</h2><button onClick={() => setSelected(null)} aria-label="閉じる"><X /></button></div>{selected ? <><div className="customer-profile"><span className="avatar large">{(selected.name || '?').slice(0, 1)}</span><h3>{selected.name || '氏名未登録'}</h3><p>{selected.email}<br />{selected.phone}</p></div><label>ステータス<select value={status} onChange={(event) => setStatus(event.target.value as Customer['status'])}><option value="new">新規</option><option value="contacted">連絡済み</option><option value="qualified">見込み</option><option value="closed">完了</option></select></label><label>担当メモ<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label><button className="primary-button full" onClick={() => void save()}>変更を保存</button><p className="consent-note"><ShieldCheck />営業連絡への同意: {formatDate(selected.consent_at)}</p></> : <div className="empty-detail"><UsersRound /><p>顧客を選択してください。</p></div>}</aside></div>;
}

function PolicyPage() {
  const [threshold, setThreshold] = useState(48);
  const [saved, setSaved] = useState(false);
  const save = async () => { await api.saveSetting('answer_policy', { domain: '不動産・住まい・物件・家づくり・店舗案内・問い合わせ方法', min_retrieval_score: threshold / 100, refuse_price_negotiation: true, refuse_legal_judgment: true, refuse_important_matters: true }); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };
  return <><PageHeader title="応答設定" description="回答範囲、拒否ルール、根拠の厳しさを設定します。" action={<button className="primary-button" onClick={() => void save()}>{saved ? <Check /> : <Settings2 />}{saved ? '保存しました' : '変更を保存'}</button>} />
    <div className="settings-layout"><section className="settings-section"><h2>回答できる範囲</h2><p>チャットが扱う業務領域です。AI Searchの根拠がある場合だけ回答します。</p><div className="domain-box">不動産・住まい・物件・家づくり・店舗案内・問い合わせ方法</div><label className="range-label"><span><strong>根拠スコアの最低値</strong><small>高くするほど、曖昧な質問への回答を控えます。</small></span><output>{threshold / 100}</output><input type="range" min="35" max="80" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label></section>
    <section className="settings-section"><h2>常に回答しない内容</h2><p>契約と不動産業務の安全要件に基づく固定ガードレールです。</p>{[['価格交渉・値引き判断','個別の価格判断は担当店舗へ案内します。'],['法的判断','契約の有効性や責任の所在を判断しません。'],['重要事項説明・宅建業法上の説明','宅地建物取引士による説明へ誘導します。'],['ナレッジにない内容','推測せず、LINEまたは問い合わせへ案内します。']].map(([title,note]) => <div className="guardrail" key={title}><span><ShieldCheck /></span><div><strong>{title}</strong><p>{note}</p></div><label className="switch"><input type="checkbox" defaultChecked disabled /><i /></label></div>)}</section>
    <section className="settings-section"><h2>モデルとデータ利用</h2><div className="model-row"><Bot /><div><strong>モデルはデプロイ設定から変更可能</strong><p>初期候補: Workers AI / Llama 3.3 70B。AI Gateway経由でOpenAI・Anthropic等へ差し替えできます。</p></div></div><div className="no-training"><Check /><div><strong>学習利用を許可しない</strong><p>Workers AIは明示的同意なしにCustomer Contentを学習・サービス改善へ利用しません。外部モデルは同等条件のAPIのみ採用します。</p></div></div></section></div></>;
}

function AppearancePage() {
  const [primary, setPrimary] = useState('#ff680b');
  return <><PageHeader title="外観" description="公式サイトに合わせた色、表示位置、キャラクターの動きを確認します。" action={<button className="primary-button"><Check />変更を保存</button>} /><div className="appearance-layout"><section className="settings-section"><h2>ブランドカラー</h2><label className="color-field"><span>メインカラー</span><input type="color" value={primary} onChange={(event) => setPrimary(event.target.value)} /><code>{primary}</code></label><label className="color-field"><span>文字色</span><input type="color" defaultValue="#29293a" /><code>#29293a</code></label><label className="color-field"><span>補助テキスト</span><input type="color" defaultValue="#74757f" /><code>#74757f</code></label><h2>表示</h2><label className="field-label">位置<select defaultValue="right"><option value="right">右下</option><option value="left">左下</option></select></label><label className="check-row"><input type="checkbox" defaultChecked /><span><strong>キャラクターアニメーション</strong><small>待機・聞く・考える・話すを会話状態に合わせます。</small></span></label><label className="check-row"><input type="checkbox" defaultChecked /><span><strong>OSの動きを減らす設定に従う</strong><small>アクセシビリティ設定時は連続アニメーションを停止します。</small></span></label></section><section className="live-preview" style={{ '--preview-primary': primary } as React.CSSProperties}><div className="fake-site"><header>オリエントホールディングス</header><div className="fake-hero">住まい探しの情報</div><div className="preview-chat"><div className="preview-chat-head"><span className="mini-cat" style={orinyanSpriteStyle} /><div><strong>オリにゃんに相談</strong><small>● オンライン</small></div><X /></div><div className="preview-chat-body"><span className="mini-cat" style={orinyanSpriteStyle} /><p>住まい探しのご質問をどうぞ。<br />サイトの情報をもとにご案内します。</p></div><div className="preview-suggestions"><button>物件を探す</button><button>家づくりについて</button></div><div className="preview-composer">メッセージを入力 <span>➤</span></div></div></div></section></div></>;
}

function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>(mockAudit);
  const [verification, setVerification] = useState<AuditVerification | null>(null);
  const verify = async () => setVerification(await api.verifyAudit());
  useEffect(() => { void api.audit().then((data) => setEvents(data.result)); void verify(); }, []);
  const healthy = verification?.verified && !verification.truncated;
  return <><PageHeader title="監査" description="設定変更、回答、拒否、顧客同意を改ざん検知付きで追跡します。" action={<button className="secondary-button" onClick={() => void verify()}><ShieldCheck />チェーンを検証</button>} /><div className={`audit-health ${healthy ? '' : 'warning'}`}><ShieldCheck /><div><strong>{verification ? healthy ? '監査台帳は正常です' : '監査台帳を確認してください' : '監査台帳を検証しています'}</strong><p>{verification ? `${verification.ledgerId}: ${verification.verifiedEvents.toLocaleString()} / ${verification.totalEvents.toLocaleString()}イベントを検証` : '月次台帳のハッシュチェーンを照合しています。'}</p></div><span>{verification ? healthy ? '正常' : '要確認' : '確認中'}</span></div><div className="table-tools"><label className="search-field"><Search /><input placeholder="イベント・対象IDで検索" /></label><button className="select-button">すべてのイベント <ChevronDown /></button><button className="select-button">過去30日 <ChevronDown /></button></div><div className="audit-table"><div className="audit-head"><span>#</span><span>日時</span><span>イベント</span><span>実行者</span><span>対象</span><span>ハッシュ</span></div>{events.map((event) => <div key={event.sequence}><code>{event.sequence}</code><time>{formatDate(event.created_at)}</time><span className="event-name">{event.event_type}</span><span>{event.actor_id || event.actor_type}</span><code>{event.subject_id || '—'}</code><code className="hash">{event.event_hash.length > 14 ? `${event.event_hash.slice(0, 7)}…${event.event_hash.slice(-5)}` : event.event_hash}</code></div>)}</div><section className="audit-explain"><Archive /><div><h2>監査データの保存</h2><p>各イベントは月単位のSQLite Durable Objectへハッシュチェーンとして記録され、再送可能なQueueアウトボックスを経由してD1とR2へJSONL形式で複製されます。会話本文とは保持期間を分離しています。</p></div></section></>;
}

export function App() {
  const [page, setPage] = useState<PageKey>('knowledge');
  const [collapsed, setCollapsed] = useState(false);
  const ActivePage = page === 'overview' ? OverviewPage : page === 'reports' ? ReportsPage : page === 'knowledge' ? KnowledgePage : page === 'conversations' ? ConversationsPage : page === 'customers' ? CustomersPage : page === 'policy' ? PolicyPage : page === 'appearance' ? AppearancePage : AuditPage;
  return <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <header className="topbar"><button className="menu-button" onClick={() => setCollapsed((value) => !value)}><Menu /></button><div className="brand"><span className="brand-mark" aria-hidden="true"><span className="brand-cat" style={orinyanSpriteStyle} /></span><strong>オリにゃん管理</strong></div><div className="topbar-right"><span className="environment"><Activity />本番 <ChevronDown /></span><button className="profile" aria-label="アカウント"><UserRound /></button></div></header>
    <Sidebar page={page} onPage={setPage} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
    <section className="content"><ActivePage /></section>
  </div>;
}
