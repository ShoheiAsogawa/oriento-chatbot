import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Archive, BookOpen, ChevronDown, ChevronLeft, ChevronRight,
  Database, EllipsisVertical, Eye, File, FileCheck2, FileSpreadsheet,
  FileText, Gauge, History, Home, Link2, Menu, MessageSquareText, Plus,
  RefreshCw, Search, ShieldCheck, Trash2, UploadCloud,
  Pencil, X,
} from 'lucide-react';
import {
  api,
  type ConversationMessage,
  type ConversationSummary,
  type KnowledgeItem,
  type MonthlyReport,
  type PropertyKnowledgeInput,
  mockConversations,
} from './api';
import { OverviewPage } from './OverviewPage';

type PageKey = 'overview' | 'reports' | 'knowledge' | 'conversations';

const navItems: Array<{ key: PageKey; label: string; icon: typeof Home }> = [
  { key: 'overview', label: '概要', icon: Home },
  { key: 'reports', label: '月次レポート', icon: Gauge },
  { key: 'knowledge', label: 'ナレッジ', icon: BookOpen },
  { key: 'conversations', label: '会話ログ', icon: MessageSquareText },
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

function ReportsPage() {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  useEffect(() => { void api.monthlyReport().then((data) => { setReport(data.report); setMonths(data.availableMonths); }); }, []);
  if (!report) return <><PageHeader title="月次レポート" description="質問傾向、回答判定、会話状況を月ごとに確認します。" /><div className="surface report-empty"><Gauge /><p>最初の月次集計後にレポートが表示されます。</p></div></>;
  const conversations = Number(report.funnel?.conversations || 0);
  const maxQuestionCount = Math.max(1, ...report.questionTrends.map((item) => Number(item.count)));
  return <><PageHeader title="月次レポート" description="質問傾向、回答判定、会話状況を月ごとに確認します。" action={<button className="select-button">{report.month} <ChevronDown /></button>} />
    <section className="metric-strip report-metrics"><div className="metric"><MessageSquareText /><p>会話</p><strong>{conversations.toLocaleString()}</strong><small>対象月の開始数</small></div><div className="metric"><History /><p>保存月</p><strong>{months.length}</strong><small>R2月次JSON</small></div></section>
    <div className="report-grid"><section className="surface"><div className="section-heading"><div><h2>よくある質問</h2><p>PIIマスク後の質問文を集計</p></div></div><div className="trend-list">{report.questionTrends.slice(0, 10).map((item, index) => <div key={`${item.question}-${index}`}><span>{index + 1}</span><p>{item.question}</p><i style={{ width: `${Math.max(8, (Number(item.count) / maxQuestionCount) * 100)}%` }} /><strong>{Number(item.count).toLocaleString()}件</strong></div>)}</div></section></div>
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
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  useEffect(() => { void api.conversations().then((data) => { setRows(data.result); setSelected((current) => data.result.find((row) => row.id === current?.id) || data.result[0] || null); }); }, []);
  useEffect(() => { if (selected) void api.conversation(selected.id).then((data) => setMessages(data.messages)); }, [selected]);
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  return <div className="split-page logs-page"><main className="split-main"><PageHeader title="会話ログ" description="記録された質問と回答、参照資料、ポリシー判定を確認します。" action={<button className="secondary-button" onClick={() => void api.downloadConversations()}><Archive />CSV出力</button>} />
    <div className="table-tools"><label className="search-field"><Search /><input placeholder="会話内容で検索" /></label><button className="select-button">過去30日 <ChevronDown /></button><button className="select-button">すべての判定 <ChevronDown /></button></div>
    <div className="conversation-list"><div className="conversation-head"><span>日時</span><span>最新の質問</span><span>ページ</span><span>回答状況</span></div>{rows.map((row) => <button key={row.id} className={selected?.id === row.id ? 'selected' : ''} onClick={() => setSelected(row)}><time>{formatDate(row.updated_at)}</time><span><strong>{row.latest_message}</strong><small>{row.message_count}メッセージ</small></span><code>{row.source_page}</code><span>{row.has_refusal ? <span className="status warning">案内対象外</span> : <span className="status success">回答</span>}</span></button>)}</div>
  </main><aside className="detail-drawer open conversation-detail"><div className="drawer-heading"><div><h2>会話の詳細</h2><p>{selected?.id}</p></div><button onClick={() => setSelected(null)} aria-label="閉じる"><X /></button></div>{selected ? <><div className="conversation-meta"><span><History />{formatDate(selected.updated_at)}</span><span><Link2 />{selected.source_page}</span></div><div className="transcript">{messages.map((message) => <div key={message.id} className={message.role === 'user' ? 'transcript-user' : 'transcript-bot'}>{message.content_redacted}{message.role === 'assistant' && message.policy_action === 'allow' ? <small>出典は保存済みのナレッジ資料を参照</small> : null}</div>)}</div><div className="policy-result"><ShieldCheck /><div><strong>ポリシー判定</strong><p>{lastAssistant?.policy_action || '確認中'} {lastAssistant?.policy_action === 'allow' ? '— 根拠資料あり' : '— 回答を拒否または担当者へ案内'}</p></div></div></> : <div className="empty-detail"><MessageSquareText /><p>会話を選択してください。</p></div>}</aside></div>;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (identity: string) => void }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const session = await api.login(loginId, password); onAuthenticated(session.user.loginId || session.user.subject);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '処理に失敗しました。'); } finally { setBusy(false); }
  };
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><span className="brand-cat" style={orinyanSpriteStyle} /></span><strong>オリにゃん管理</strong></div><h1>管理画面にログイン</h1><p>事前に配布された管理者IDとパスワードを入力してください。</p><form onSubmit={(event) => void submit(event)}><label>管理者ID<input type="text" autoComplete="username" value={loginId} onChange={(event) => setLoginId(event.target.value)} required placeholder="管理者IDを入力" /></label><label>パスワード<input type="password" autoComplete="current-password" maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error ? <p className="auth-error">{error}</p> : null}<button className="primary-button full" disabled={busy}>{busy ? '処理中…' : 'ログイン'}</button></form></section></main>;
}

export function App() {
  const [page, setPage] = useState<PageKey>('knowledge');
  const [collapsed, setCollapsed] = useState(false);
  const [session, setSession] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  useEffect(() => { void api.authSession().then((value) => setSession(value.authenticated ? value.user?.loginId || null : null)).catch(() => setSession(null)).finally(() => setCheckingSession(false)); }, []);
  const logout = async () => { try { await api.logout(); } finally { setSession(null); } };
  const ActivePage = page === 'reports' ? ReportsPage : page === 'knowledge' ? KnowledgePage : page === 'conversations' ? ConversationsPage : null;
  if (checkingSession) return <main className="auth-page"><p>ログイン状態を確認しています…</p></main>;
  if (!session) return <AuthScreen onAuthenticated={setSession} />;
  return <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <header className="topbar"><button className="menu-button" onClick={() => setCollapsed((value) => !value)}><Menu /></button><div className="brand"><span className="brand-mark" aria-hidden="true"><span className="brand-cat" style={orinyanSpriteStyle} /></span><strong>オリにゃん管理</strong></div><div className="topbar-right"><span className="environment"><Activity />本番 <ChevronDown /></span><span className="account-email">{session}</span><button className="secondary-button logout-button" onClick={() => void logout()}>ログアウト</button></div></header>
    <Sidebar page={page} onPage={setPage} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
    <section className="content">{page === 'overview' ? <OverviewPage onOpenConversations={() => setPage('conversations')} /> : ActivePage ? <ActivePage /> : null}</section>
  </div>;
}
