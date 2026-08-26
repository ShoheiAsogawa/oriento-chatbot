import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Archive, BookOpen, ChevronLeft, ChevronRight,
  EllipsisVertical, Eye, File, FileCheck2, FileSpreadsheet,
  FileText, Gauge, History, Home, Link2, Menu, MessageSquareText, Plus, ClipboardList,
  RefreshCw, Search, ShieldCheck, Trash2, UploadCloud, UsersRound,
  Pencil, X,
} from 'lucide-react';
import {
  ADMIN_SESSION_EXPIRED_EVENT,
  api,
  type ConversationMessage,
  type ConversationSummary,
  type CustomHomeInquiry,
  type InquiryKind,
  type KnowledgeItem,
  type PropertyKnowledgeInput,
  visitorDemographicLabel,
} from './api';
import { OverviewPage } from './OverviewPage';
import { ReportsPage } from './ReportsPage';

type PageKey = 'overview' | 'reports' | 'knowledge' | 'conversations' | 'inquiries';

const navItems: Array<{ key: PageKey; label: string; icon: typeof Home }> = [
  { key: 'overview', label: '概要', icon: Home },
  { key: 'reports', label: '月次レポート', icon: Gauge },
  { key: 'knowledge', label: 'ナレッジ', icon: BookOpen },
  { key: 'conversations', label: '会話ログ', icon: MessageSquareText },
  { key: 'inquiries', label: 'お問い合わせ', icon: ClipboardList },
];

const orinyanSpriteStyle = { backgroundImage: "url('/assets/orinyan-states.png')" };

function formatDate(value: string) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatBytes(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(value / 1000)} KB`;
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

function supportsDirectDocumentEditing(item: KnowledgeItem) {
  return !isPropertyKnowledge(item) && /\.(?:md|txt)$/iu.test(item.key);
}

const KNOWLEDGE_PAGE_SIZE = 50;
const MAX_KNOWLEDGE_FILE_SIZE = 4 * 1024 * 1024;
const SUPPORTED_KNOWLEDGE_FILE = /\.(?:pdf|docx?|xlsx?|csv|txt|md|png|jpe?g|webp)$/iu;
const PROCESSING_STATUS = new Set<KnowledgeItem['status']>(['queued', 'running']);
const propertyNameCollator = new Intl.Collator('ja-JP', { numeric: true, sensitivity: 'base' });

type KnowledgeFilter = 'all' | 'properties_for_sale' | 'properties_for_rent' | 'other';
type KnowledgeSortOrder = 'title_asc' | 'title_desc' | 'recent';
type KnowledgeAddMode = 'property' | 'document';
type DocumentEditMode = 'metadata' | 'content';
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
        <button key={key} className={page === key ? 'active' : ''} onClick={() => onPage(key)} title={collapsed ? label : undefined} aria-current={page === key ? 'page' : undefined}>
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
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<KnowledgeAddMode>('property');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [propertyForm, setPropertyForm] = useState<PropertyKnowledgeInput>(createEmptyPropertyKnowledge);
  const [featureText, setFeatureText] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentSourceUrl, setDocumentSourceUrl] = useState('');
  const [documentReplacement, setDocumentReplacement] = useState<File | null>(null);
  const [documentEditMode, setDocumentEditMode] = useState<DocumentEditMode>('metadata');
  const [documentContent, setDocumentContent] = useState('');
  const [documentContentRevision, setDocumentContentRevision] = useState<string | undefined>();
  const [documentContentLoading, setDocumentContentLoading] = useState(false);
  const [documentContentError, setDocumentContentError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const operationLock = useRef(false);
  const busyRef = useRef(false);
  const editModalRef = useRef<HTMLElement>(null);
  const editCloseButtonRef = useRef<HTMLButtonElement>(null);
  const processingStartedAt = useRef<number | null>(null);
  const loadRequestSequence = useRef(0);
  const documentContentRequestSequence = useRef(0);
  const generatedPropertyKnowledge = useMemo(() => propertyKnowledgePreview(propertyForm), [propertyForm]);
  const documentContentBytes = useMemo(() => new TextEncoder().encode(documentContent).byteLength, [documentContent]);

  const load = useCallback(async (preferredId?: string, options: { silent?: boolean } = {}) => {
    const sequence = loadRequestSequence.current + 1;
    loadRequestSequence.current = sequence;
    if (!options.silent) {
      processingStartedAt.current = null;
      setLoading(true);
    }
    try {
      const data = await api.knowledge({ perPage: 1000 });
      if (loadRequestSequence.current !== sequence) return;
      setItems(data.result);
      setTotal(Number(data.result_info.total_count || data.result.length));
      setSelected((current) => {
        const selectedId = preferredId || current?.id;
        if (!selectedId) return null;
        return data.result.find((item) => item.id === selectedId) || null;
      });
    } catch (error) {
      if (loadRequestSequence.current !== sequence) return;
      setNotice(error instanceof Error ? `ナレッジを読み込めませんでした: ${error.message}` : 'ナレッジを読み込めませんでした。');
    } finally {
      if (!options.silent && loadRequestSequence.current === sequence) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pendingKnowledgeIds = useMemo(
    () => items.filter((item) => PROCESSING_STATUS.has(item.status)).map((item) => item.id),
    [items],
  );
  const pendingKnowledgeKey = pendingKnowledgeIds.join(',');

  useEffect(() => {
    if (!pendingKnowledgeIds.length) {
      processingStartedAt.current = null;
      return;
    }
    if (busy || loading) return;
    processingStartedAt.current ??= Date.now();
    if (Date.now() - processingStartedAt.current >= 2 * 60 * 1000) {
      setNotice((current) => current || 'インデックス処理に時間がかかっています。しばらくしてから「再読み込み」で状態を確認してください。');
      return;
    }

    let requestInFlight = false;
    const timer = window.setInterval(() => {
      if (requestInFlight) return;
      if (processingStartedAt.current
        && Date.now() - processingStartedAt.current >= 2 * 60 * 1000) {
        setNotice((current) => current || 'インデックス処理に時間がかかっています。「再インデックスを再試行」または「再読み込み」で状態を確認してください。');
        window.clearInterval(timer);
        return;
      }
      requestInFlight = true;
      void load(undefined, { silent: true }).catch((reason) => {
        setNotice(reason instanceof Error ? `インデックス状態を確認できませんでした: ${reason.message}` : 'インデックス状態を確認できませんでした。');
      }).finally(() => { requestInFlight = false; });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [busy, load, loading, pendingKnowledgeKey]);

  const beginOperation = () => {
    if (operationLock.current) return false;
    operationLock.current = true;
    busyRef.current = true;
    setBusy(true);
    return true;
  };

  const finishOperation = () => {
    operationLock.current = false;
    busyRef.current = false;
    setBusy(false);
  };

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
    documentContentRequestSequence.current += 1;
    setAddMode('property');
    setEditingId(null);
    setPropertyForm(createEmptyPropertyKnowledge());
    setFeatureText('');
    setDocumentTitle('');
    setDocumentSourceUrl('');
    setDocumentReplacement(null);
    setDocumentEditMode('metadata');
    setDocumentContent('');
    setDocumentContentRevision(undefined);
    setDocumentContentLoading(false);
    setDocumentContentError(null);
    setDragging(false);
  };

  const openAddForm = () => {
    resetAddForm();
    setAddOpen(true);
    setNotice(null);
  };

  const closeAddForm = () => {
    documentContentRequestSequence.current += 1;
    setAddOpen(false);
    setDragging(false);
    setDocumentReplacement(null);
    if (editingId) setEditingId(null);
  };

  useEffect(() => {
    if (!addOpen || !editingId) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => editCloseButtonRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!busyRef.current) {
          event.preventDefault();
          closeAddForm();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const modal = editModalRef.current;
      if (!modal) return;
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      window.requestAnimationFrame(() => previouslyFocused?.focus());
    };
  }, [addOpen, editingId]);

  const openEditForm = async () => {
    if (!selected) return;
    if (!isPropertyKnowledge(selected)) {
      setNotice(null);
      setDocumentTitle(knowledgeTitle(selected));
      setDocumentSourceUrl(knowledgeSourceUrl(selected));
      setDocumentReplacement(null);
      setDocumentEditMode('metadata');
      setDocumentContent('');
      setDocumentContentRevision(undefined);
      setDocumentContentError(null);
      setAddMode('document');
      setEditingId(selected.id);
      setAddOpen(true);
      if (supportsDirectDocumentEditing(selected)) {
        const requestSequence = documentContentRequestSequence.current + 1;
        documentContentRequestSequence.current = requestSequence;
        setDocumentContentLoading(true);
        try {
          const data = await api.generalKnowledgeContent(selected.id);
          if (documentContentRequestSequence.current !== requestSequence) return;
          setDocumentContent(data.content);
          setDocumentContentRevision(data.revision);
        } catch (error) {
          if (documentContentRequestSequence.current !== requestSequence) return;
          setDocumentContentError(error instanceof Error ? error.message : '本文を読み込めませんでした。');
        } finally {
          if (documentContentRequestSequence.current === requestSequence) setDocumentContentLoading(false);
        }
      }
      return;
    }
    if (!beginOperation()) return;
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
      finishOperation();
    }
  };

  const documentFileError = (file: File) => {
    if (!SUPPORTED_KNOWLEDGE_FILE.test(file.name)) {
      return '対応していないファイル形式です。PDF、Word、Excel、CSV、テキスト、画像を選択してください。';
    }
    if (file.size > MAX_KNOWLEDGE_FILE_SIZE) {
      return 'ファイルサイズが4MBを超えています。4MB以下のファイルを選択してください。';
    }
    return null;
  };

  const selectDocumentReplacement = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const validationError = documentFileError(file);
    if (validationError) {
      setNotice(validationError);
      return;
    }
    setDocumentReplacement(file);
    setNotice(null);
  };

  const uploadDocument = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const validationError = documentFileError(file);
    if (validationError) {
      setNotice(validationError);
      return;
    }
    if (!beginOperation()) return;
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
      finishOperation();
    }
  };

  const saveDocumentEdit = async () => {
    if (!editingId || addMode !== 'document') return;
    const title = documentTitle.trim();
    if (!title) {
      setNotice('資料名を入力してください。');
      return;
    }
    if (documentEditMode === 'metadata' && documentReplacement) {
      const validationError = documentFileError(documentReplacement);
      if (validationError) {
        setNotice(validationError);
        return;
      }
    }
    if (!beginOperation()) return;
    setNotice(null);
    try {
      const result = await api.updateGeneralKnowledge(editingId, {
        title,
        sourceUrl: documentSourceUrl.trim(),
        ...(documentEditMode === 'content'
          ? { content: documentContent, contentRevision: documentContentRevision }
          : { file: documentReplacement }),
      });
      closeAddForm();
      resetAddForm();
      setNotice(`「${title}」を保存しました。再インデックスを自動開始し、完了後に回答へ反映します。`);
      await load(result.id || undefined);
    } catch (error) {
      setNotice(error instanceof Error ? `一般資料を保存できませんでした: ${error.message}` : '一般資料を保存できませんでした。');
    } finally {
      finishOperation();
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
    if (!beginOperation()) return;
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
      finishOperation();
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!window.confirm(`「${knowledgeTitle(selected)}」を削除します。成約済みとしてチャットの候補から外す場合に実行してください。`)) return;
    if (!beginOperation()) return;
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
      finishOperation();
    }
  };

  const reindex = async () => {
    if (!selected) return;
    if (!beginOperation()) return;
    setNotice(null);
    try {
      const updated = await api.reindexKnowledge(selected.id);
      setItems((current) => current.map((item) => item.id === selected.id ? { ...item, ...updated } : item));
      setSelected((current) => current?.id === selected.id ? { ...current, ...updated } : current);
      setNotice(`「${knowledgeTitle(selected)}」の再インデックスを開始しました。`);
    } catch (error) {
      setNotice(error instanceof Error ? `再インデックスを開始できませんでした: ${error.message}` : '再インデックスを開始できませんでした。');
    } finally {
      finishOperation();
    }
  };

  const isEditingDocument = Boolean(editingId && addMode === 'document');
  const isEditingDirectDocument = Boolean(selected && supportsDirectDocumentEditing(selected));
  const documentContentSaveUnavailable = documentEditMode === 'content'
    && (documentContentLoading || Boolean(documentContentError) || !documentContentRevision);
  const selectedSourceUrl = selected ? knowledgeSourceUrl(selected) : '';

  return <div className="split-page knowledge-page">
    <main className="split-main">
      <PageHeader
        title="物件ナレッジ"
        description="物件は1件ごとに管理します。成約済みになった物件だけを削除し、必要な物件だけを追加できます。"
        action={<div className="page-actions">
          <button className="primary-button" onClick={openAddForm} disabled={busy}><Plus />物件・資料を追加</button>
        </div>}
      />
      <input
        ref={fileInput}
        type="file"
        hidden
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp"
        onChange={(event) => {
          if (editingId && addMode === 'document') selectDocumentReplacement(event.target.files);
          else void uploadDocument(event.target.files);
          event.target.value = '';
        }}
      />

      {addOpen ? <div
        className={editingId ? 'knowledge-edit-modal-backdrop' : undefined}
        onMouseDown={(event) => {
          if (editingId && event.target === event.currentTarget && !busyRef.current) closeAddForm();
        }}
      ><section
        ref={editModalRef}
        className={`knowledge-add surface ${editingId ? 'knowledge-edit-modal' : ''}`}
        role={editingId ? 'dialog' : undefined}
        aria-modal={editingId ? true : undefined}
        aria-label={editingId ? (isEditingDocument ? '一般資料を編集' : '物件ナレッジを編集') : '物件・資料を1件追加'}
        tabIndex={editingId ? -1 : undefined}
      >
        <div className="section-heading"><div><h2>{editingId ? (isEditingDocument ? '一般資料を編集' : '物件ナレッジを編集') : '物件・資料を1件追加'}</h2><p>{editingId ? (isEditingDocument ? (documentEditMode === 'content' ? 'Markdown本文を直接編集できます。保存すると既存の本文を置き換えます。' : '資料名・関連ページURLを更新できます。ファイルを選ばなければ、登録済みの資料内容をそのまま使います。') : '保存すると既存のナレッジを更新し、再インデックスを自動開始します。') : '物件は定型フォームだけで登録できます。資料は従来どおりファイルをアップロードします。'}</p></div><button ref={editingId ? editCloseButtonRef : undefined} className="square-button" type="button" onClick={closeAddForm} aria-label={editingId ? '編集画面を閉じる' : 'フォームを閉じる'} disabled={busy}><X /></button></div>
        {!editingId ? <div className="knowledge-add-mode" role="tablist" aria-label="登録方法">
          <button type="button" role="tab" aria-selected={addMode === 'property'} className={addMode === 'property' ? 'active' : ''} onClick={() => setAddMode('property')} disabled={busy}><Home />物件を定型登録</button>
          <button type="button" role="tab" aria-selected={addMode === 'document'} className={addMode === 'document' ? 'active' : ''} onClick={() => setAddMode('document')} disabled={busy || Boolean(editingId)}><UploadCloud />一般資料をアップロード</button>
        </div> : null}
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
        </form> : isEditingDocument ? <form className="knowledge-add-body document-knowledge-form" onSubmit={(event) => { event.preventDefault(); void saveDocumentEdit(); }}>
          {isEditingDirectDocument ? <div className="knowledge-add-mode document-edit-mode" role="tablist" aria-label="編集対象"><button type="button" role="tab" aria-selected={documentEditMode === 'metadata'} className={documentEditMode === 'metadata' ? 'active' : ''} onClick={() => setDocumentEditMode('metadata')} disabled={busy}>資料情報・ファイル</button><button type="button" role="tab" aria-selected={documentEditMode === 'content'} className={documentEditMode === 'content' ? 'active' : ''} onClick={() => setDocumentEditMode('content')} disabled={busy}>Markdown本文</button></div> : null}
          {documentEditMode === 'metadata' || !isEditingDirectDocument ? <>
            <label className="knowledge-field"><span>資料名 <em>必須</em></span><input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="例：オリエントホーム会社案内" autoComplete="off" required /></label>
            <label className="knowledge-field"><span>関連ページURL（任意）</span><input value={documentSourceUrl} onChange={(event) => setDocumentSourceUrl(event.target.value)} type="url" placeholder="https://orijyu.com/..." inputMode="url" autoComplete="url" /><small>公式サイトのURLを登録すると、回答時の案内リンクに使えます。</small></label>
          </> : null}
          {documentEditMode === 'content' && selected && supportsDirectDocumentEditing(selected) ? <div className="knowledge-field-wide markdown-editor-field"><label className="knowledge-field" htmlFor="knowledge-markdown-content"><span>Markdown / テキスト本文</span></label>{documentContentLoading ? <p className="document-content-state" role="status"><RefreshCw className="spin" />本文を読み込んでいます…</p> : documentContentError ? <p className="document-content-state error" role="alert">本文を読み込めませんでした: {documentContentError}</p> : <><textarea id="knowledge-markdown-content" value={documentContent} onChange={(event) => setDocumentContent(event.target.value)} rows={18} spellCheck={false} aria-describedby="knowledge-markdown-help" /><div className="markdown-editor-meta" id="knowledge-markdown-help"><span>{documentContent.length.toLocaleString()} 文字</span><span>{formatBytes(documentContentBytes)}</span><small>保存すると本文を置き換え、再インデックスを自動開始します。</small></div></>}</div> : <div className="knowledge-field-wide document-replacement">
            <button
              type="button"
              className={`dropzone knowledge-dropzone ${dragging ? 'dragging' : ''}`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); selectDocumentReplacement(event.dataTransfer.files); }}
              disabled={busy}
            >
              <UploadCloud /><span><strong>{documentReplacement ? '差し替えファイルを変更' : 'ファイルを差し替える（任意）'}</strong><small>選ばなければ現在の資料内容を維持します。PDF、DOCX、XLSX、CSV、画像（最大4MB / 1ファイル）</small></span>
            </button>
            {documentReplacement ? <p className="document-replacement-state"><span>差し替え予定: <strong>{documentReplacement.name}</strong>（{formatBytes(documentReplacement.size)}）</span><button type="button" onClick={() => setDocumentReplacement(null)} disabled={busy}>取り消し</button></p> : <p className="document-replacement-state">ファイルを選択しない場合は、現在登録されている資料内容をそのまま再インデックスします。</p>}
          </div>}
          <div className="property-form-actions knowledge-field-wide"><p>{documentEditMode === 'content' ? 'Markdown本文を保存すると、既存の本文を置き換えて再インデックスします。' : '保存すると資料名・関連ページURLを更新し、再インデックスを自動開始します。'}</p><button type="submit" className="primary-button" disabled={busy || documentContentSaveUnavailable}>{busy ? '保存しています…' : documentEditMode === 'content' ? '本文を保存して再インデックス' : '変更を保存'}</button></div>
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
      </section></div> : null}

      {notice ? <p className="knowledge-notice" role="status">{notice}</p> : null}

      <div className="table-tools knowledge-tools">
        <label className="search-field"><Search /><input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="物件名・資料名で検索" /></label>
        <label className="knowledge-select"><span>分類</span><select value={filter} onChange={(event) => updateFilter(event.target.value as KnowledgeFilter)}><option value="all">すべて</option><option value="properties_for_sale">売買物件</option><option value="properties_for_rent">賃貸物件</option><option value="other">一般資料</option></select></label>
        <label className="knowledge-select"><span>並び順</span><select value={sort} onChange={(event) => updateSort(event.target.value as KnowledgeSortOrder)}><option value="title_asc">物件名（昇順）</option><option value="title_desc">物件名（降順）</option><option value="recent">更新日時（新しい順）</option></select></label>
        <button className="square-button" onClick={() => void load()} aria-label="再読み込み" disabled={loading || busy}><RefreshCw /></button>
      </div>

      <div className="knowledge-result-summary"><strong>{filteredItems.length.toLocaleString()}件</strong><span>全{total.toLocaleString()}件のナレッジから表示{pendingKnowledgeIds.length ? ` ／ ${pendingKnowledgeIds.length}件を反映処理中（自動更新）` : ''}</span></div>
      <div className="data-table knowledge-table" role="table" aria-label="物件ナレッジ一覧" aria-busy={loading || pendingKnowledgeIds.length > 0}>
        <div className="table-head" role="row"><span>物件名・資料名</span><span>分類</span><span>状態</span><span>更新日</span><span>チャンク</span><span>操作</span></div>
        {pageItems.map((item) => <button className={`table-row ${selected?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setSelected(item)} role="row" aria-label={`${knowledgeTitle(item)}の詳細を表示`}>
          <span className="file-cell"><FileIcon name={item.key} /><span><strong>{knowledgeTitle(item)}</strong><small>{formatBytes(item.file_size)}</small></span></span>
          <span><i className={`knowledge-category ${knowledgeCategory(item)}`}>{knowledgeCategoryLabel(item)}</i></span>
          <span><Status value={item.status} /></span><time>{formatDate(item.last_seen_at)}</time><span>{item.chunks_count ? item.chunks_count.toLocaleString() : '—'}</span><span className="row-action"><EllipsisVertical /></span>
        </button>)}
        {loading && pageItems.length === 0 ? <div className="knowledge-empty" role="row"><RefreshCw className="spin" /><p>ナレッジを読み込んでいます…</p></div> : null}
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
          {selected.status === 'error' && selected.error ? <div><dt>エラー内容</dt><dd className="knowledge-error-detail">{selected.error}</dd></div> : null}
        </dl>
        <div className="drawer-actions"><h3>アクション</h3><button onClick={() => void openEditForm()} disabled={busy}><Pencil />編集</button><button onClick={() => void reindex()} disabled={busy}><RefreshCw />{PROCESSING_STATUS.has(selected.status) ? '再インデックスを再試行' : '再インデックス'}</button><button className="danger" onClick={() => void remove()} disabled={busy}><Trash2 />この物件・資料を削除</button><p>{isPropertyKnowledge(selected) ? '保存時は再インデックスを自動開始します。成約済みの物件は削除してください。' : '一般資料は、編集時に資料名・関連ページURL・差し替えファイルを更新できます。'}</p></div>
        <WidgetPreview />
      </> : <div className="empty-detail"><FileCheck2 /><p>物件・資料を選択すると詳細が表示されます。</p></div>}
    </aside>
  </div>;
}

function WidgetPreview() {
  return <section className="widget-preview"><div className="preview-title"><h3>ウィジェットプレビュー</h3><Eye /></div><div className="mini-widget"><header><span className="mini-cat" style={orinyanSpriteStyle}></span><div><strong>オリにゃんに相談</strong><small>● オンライン</small></div></header><div className="mini-message"><span className="mini-cat" style={orinyanSpriteStyle}></span><p>こんにちは、オリにゃんだよ！<br />はじめに性別を選んでにゃん。</p></div><div className="mini-input">はじめに性別と年代を選んでにゃん</div></div></section>;
}

const CONVERSATIONS_PAGE_SIZE = 50;

function policyActionLabel(action: string | undefined) {
  if (action === 'allow') return '案内済み';
  if (action === 'price_negotiation') return '価格交渉のため案内対象外';
  if (action === 'important_matters') return '重要事項のため案内対象外';
  if (action === 'legal_judgment') return '法的判断のため案内対象外';
  if (action === 'prompt_injection') return '不正な入力';
  if (action === 'no_grounding') return '根拠不足のため未回答';
  if (action === 'out_of_scope') return '案内対象外';
  return action || '確認中';
}

function parseMessageCitations(raw: string | undefined) {
  try {
    const parsed = JSON.parse(raw || '[]') as Array<{ title?: string | null; url?: string | null }>;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && (item.title || item.url));
  } catch {
    return [];
  }
}

function ConversationsPage({ initialConversationId }: { initialConversationId?: string }) {
  const [rows, setRows] = useState<ConversationSummary[]>([]);
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const rowsRequestSequence = useRef(0);
  const loadRows = useCallback(async (query: string, nextPage: number) => {
    const sequence = rowsRequestSequence.current + 1;
    rowsRequestSequence.current = sequence;
    setLoading(true);
    setError(null);
    try {
      const data = await api.conversations(query, nextPage, CONVERSATIONS_PAGE_SIZE);
      if (rowsRequestSequence.current !== sequence) return;
      setRows(data.result);
      setTotal(Number(data.total || data.result.length));
      setSelected((current) => (
        data.result.find((row) => row.id === initialConversationId)
        || data.result.find((row) => row.id === current?.id)
        || data.result[0]
        || null
      ));
    } catch (reason) {
      if (rowsRequestSequence.current !== sequence) return;
      setError(reason instanceof Error ? reason.message : '会話ログを読み込めませんでした。');
    } finally {
      if (rowsRequestSequence.current === sequence) setLoading(false);
    }
  }, [initialConversationId]);
  useEffect(() => { setPage(1); }, [deferredSearch]);
  useEffect(() => { void loadRows(deferredSearch, page); }, [deferredSearch, page, loadRows]);
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }
    let active = true;
    setMessages([]);
    setMessagesLoading(true);
    void api.conversation(selected.id).then((data) => {
      if (!active) return;
      setMessages(data.messages);
      setMessagesLoading(false);
    }).catch((reason) => {
      if (!active) return;
      setMessagesLoading(false);
      setError(reason instanceof Error ? reason.message : '会話の詳細を読み込めませんでした。');
    });
    return () => { active = false; };
  }, [selected]);
  const download = async () => {
    if (exporting) return;
    setExporting(true);
    setError(null);
    try {
      const exported = await api.downloadConversations();
      if (exported.truncated) setError('CSVは最新1万件までです。それ以前の会話は含まれていません。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'CSVを出力できませんでした。');
    } finally {
      setExporting(false);
    }
  };
  const visitorLabel = selected ? visitorDemographicLabel(selected.visitor_gender, selected.visitor_age_decade) : '';
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const totalPages = Math.max(1, Math.ceil(total / CONVERSATIONS_PAGE_SIZE));
  return <div className="split-page logs-page"><main className="split-main"><PageHeader title="会話ログ" description="記録された質問と回答、参照資料、ポリシー判定を確認します。" action={<button className="secondary-button" onClick={() => void download()} disabled={exporting}><Archive />{exporting ? '出力中…' : 'CSV出力'}</button>} />
    {error ? <p className="knowledge-notice" role="alert">{error}</p> : null}
    <div className="table-tools"><label className="search-field"><Search /><input placeholder="会話内容で検索" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="square-button" type="button" aria-label="会話ログを再読み込み" onClick={() => void loadRows(deferredSearch, page)} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} /></button></div>
    <div className="conversation-list" aria-busy={loading}><div className="conversation-head"><span>日時</span><span>最新の質問</span><span>ページ</span><span>回答状況</span></div>{rows.map((row) => <button key={row.id} className={selected?.id === row.id ? 'selected' : ''} onClick={() => setSelected(row)}><time>{formatDate(row.updated_at)}</time><span><strong>{row.latest_message || '（質問なし）'}</strong><small>{row.message_count}メッセージ</small></span><code>{row.source_page || '/'}</code><span>{row.has_refusal ? <span className="status warning">案内対象外</span> : <span className="status success">回答</span>}</span></button>)}{!loading && rows.length === 0 ? <div className="knowledge-empty"><MessageSquareText /><p>条件に一致する会話はありません。</p></div> : null}</div>
    {totalPages > 1 ? <nav className="inquiry-pagination" aria-label="会話ログのページ移動"><button className="secondary-button" type="button" disabled={loading || page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft />前へ</button><span>{page} / {totalPages} ページ</span><button className="secondary-button" type="button" disabled={loading || page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>次へ<ChevronRight /></button></nav> : null}
  </main><aside className={`detail-drawer conversation-detail ${selected ? 'open' : ''}`}><div className="drawer-heading"><div><h2>会話の詳細</h2><p>{selected?.id}</p></div><button onClick={() => setSelected(null)} aria-label="閉じる"><X /></button></div>{selected ? <><div className="conversation-meta"><span><History />{formatDate(selected.updated_at)}</span><span><Link2 />{selected.source_page}</span>{visitorLabel ? <span><UsersRound />{visitorLabel}</span> : null}</div><div className="transcript">{messagesLoading ? <p className="knowledge-notice">会話を読み込んでいます…</p> : messages.map((message) => {
    const citations = message.role === 'assistant' ? parseMessageCitations(message.citations) : [];
    return <div key={message.id} className={message.role === 'user' ? 'transcript-user' : 'transcript-bot'}>{message.content_redacted}{citations.length > 0 ? <ul className="transcript-citations">{citations.map((citation, index) => <li key={`${citation.url || citation.title || index}`}>{citation.url ? <a href={citation.url} target="_blank" rel="noopener noreferrer">{citation.title || citation.url}</a> : citation.title}</li>)}</ul> : message.role === 'assistant' && message.policy_action === 'allow' ? <small>出典は保存済みのナレッジ資料を参照</small> : null}</div>;
  })}</div><div className="policy-result"><ShieldCheck /><div><strong>ポリシー判定</strong><p>{policyActionLabel(lastAssistant?.policy_action)}{lastAssistant?.policy_action === 'allow' ? ' — 根拠資料あり' : lastAssistant?.policy_action ? ' — 回答を拒否または担当者へ案内' : ''}</p></div></div></> : <div className="empty-detail"><MessageSquareText /><p>会話を選択してください。</p></div>}</aside></div>;
}

function inquiryValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '未回答';
  return String(value);
}

function inquiryBudget(value: unknown) {
  if (value === undefined || value === null || value === '') return '未回答';
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? `${numeric.toLocaleString('ja-JP')}円` : String(value);
}

function inquiryUndecidedNote(value: unknown) {
  const note = inquiryValue(value);
  return note === '未定' || note.startsWith('未定（') ? note : `未定（${note}）`;
}

function inquiryLandOwnership(value: unknown) {
  if (value === 'owned' || value === 'あり') return '土地あり';
  if (value === 'not_owned' || value === 'なし') return '土地なし';
  if (value === 'unknown' || value === '未定') return '未定';
  return inquiryValue(value);
}

function inquiryKindLabel(kind: InquiryKind | string | undefined) {
  if (kind === 'document_request') return '資料請求';
  if (kind === 'phone') return '電話相談';
  if (kind === 'viewing') return '見学予約';
  return '注文住宅';
}

function inquiryNotificationLabel(status: string | undefined) {
  if (status === 'sent') return 'メール送信済み';
  if (status === 'failed') return 'メール送信失敗';
  if (status === 'processing') return 'メール送信中';
  if (status === 'pending') return 'メール未送信';
  return '';
}

function InquirySummary({ inquiry }: { inquiry: CustomHomeInquiry }) {
  const kind = inquiry.kind || 'custom_home';
  if (kind === 'document_request') {
    const summary = [inquiry.address, inquiry.properties?.[0]?.title].filter(Boolean);
    return <p className="inquiry-summary">{summary.length ? summary.join(' ／ ') : '資料請求'}</p>;
  }
  if (kind === 'phone') {
    return <p className="inquiry-summary">{inquiry.properties?.[0]?.title || '電話でのご相談'}</p>;
  }
  if (kind === 'viewing') {
    const summary = [inquiry.preferredDatetime, inquiry.properties?.[0]?.title].filter(Boolean);
    return <p className="inquiry-summary">{summary.length ? summary.join(' ／ ') : '見学予約'}</p>;
  }
  const intake = inquiry.intake || {};
  const summary = [
    intake.desiredArea,
    intake.landOwnership ? inquiryLandOwnership(intake.landOwnership) : undefined,
    intake.layout,
    intake.budgetYen ? `予算 ${inquiryBudget(intake.budgetYen)}` : intake.budgetNote ? `予算 ${inquiryUndecidedNote(intake.budgetNote)}` : undefined,
  ].filter(Boolean);
  return <p className="inquiry-summary">{summary.length ? summary.join(' ／ ') : '聞き取り内容あり'}</p>;
}

function InquiryDetails({ inquiry, onClose, onOpenConversation }: { inquiry: CustomHomeInquiry; onClose: () => void; onOpenConversation?: (conversationId: string) => void }) {
  const kind = inquiry.kind || 'custom_home';
  const intake = inquiry.intake || {};
  const household = [
    intake.householdSize ? `${inquiryValue(intake.householdSize)}人` : '',
    intake.householdDescription || '',
  ].filter(Boolean).join(' ／ ') || '未回答';
  const propertyLines = (inquiry.properties || [])
    .map((item) => `${item.title}\n${item.url}`)
    .join('\n\n') || '（案内中の物件なし）';
  const customHomeFields: Array<[string, string]> = [
    ['土地の有無', inquiryLandOwnership(intake.landOwnership)],
    ['土地の場所', inquiryValue(intake.landLocation)],
    ['土地の広さ', intake.landSizeSqm ? `${inquiryValue(intake.landSizeSqm)}㎡` : intake.landSizeNote ? inquiryUndecidedNote(intake.landSizeNote) : '未回答'],
    ['希望エリア', inquiryValue(intake.desiredArea)],
    ['家族構成・人数', household],
    ['希望間取り', inquiryValue(intake.layout)],
    ['予算', intake.budgetYen ? inquiryBudget(intake.budgetYen) : intake.budgetNote ? inquiryUndecidedNote(intake.budgetNote) : '未回答'],
    ['入居時期', inquiryValue(intake.timing)],
    ['こだわり・優先事項', inquiryValue(intake.priorities)],
    ['メール通知', inquiryNotificationLabel(inquiry.notificationStatus) || inquiry.notificationStatus || '未確認'],
  ];
  const propertyFields: Array<[string, string]> = [
    ['お問い合わせ種別', inquiryKindLabel(kind)],
    ...(kind === 'viewing' ? [['希望日時', inquiryValue(inquiry.preferredDatetime)] as [string, string]] : []),
    ...(kind !== 'phone' ? [['住所', inquiryValue(inquiry.address)] as [string, string]] : []),
    ['対象物件', propertyLines],
    ['メール通知', inquiryNotificationLabel(inquiry.notificationStatus) || inquiry.notificationStatus || '未確認'],
  ];
  const fields = kind === 'custom_home' ? customHomeFields : propertyFields;
  return <div className="inquiry-modal-backdrop" role="presentation">
    <section className="inquiry-modal" role="dialog" aria-modal="true" aria-labelledby="inquiry-modal-title">
      <div className="drawer-heading"><div><h2 id="inquiry-modal-title">お問い合わせ内容</h2><p>{formatDate(inquiry.createdAt)}</p></div><button type="button" onClick={onClose} aria-label="閉じる"><X /></button></div>
      <div className="inquiry-contact"><strong>{inquiry.name || '氏名未入力'}</strong>{inquiry.phone ? <a href={`tel:${inquiry.phone}`}>{inquiry.phone}</a> : <span>電話番号未入力</span>}</div>
      <dl className="inquiry-detail-list">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {inquiry.conversationId && onOpenConversation ? <button className="secondary-button full" type="button" onClick={() => { onOpenConversation(inquiry.conversationId); onClose(); }}>会話ログを開く</button> : null}
      <button className="secondary-button full" type="button" onClick={onClose}>一覧に戻る</button>
    </section>
  </div>;
}

const INQUIRIES_PAGE_SIZE = 50;

function InquiriesPage({ onOpenConversation }: { onOpenConversation?: (conversationId: string) => void }) {
  const [rows, setRows] = useState<CustomHomeInquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CustomHomeInquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.inquiries(page, INQUIRIES_PAGE_SIZE);
      setRows(data.result);
      setTotal(data.total);
      setSelected((current) => current ? data.result.find((row) => row.id === current.id) || null : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'お問い合わせを読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => { void load(); }, [load]);
  const totalPages = Math.max(1, Math.ceil(total / INQUIRIES_PAGE_SIZE));
  return <main className="inquiries-page">
    <PageHeader title="お問い合わせ" description="チャットから届いた資料請求・電話・見学・注文住宅のご相談を新しい順に確認できます。" action={<button className="secondary-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} />再読み込み</button>} />
    <p className="knowledge-notice">新しいお問い合わせはこの一覧で確認できます。同じ内容は担当者メールにも届きます。</p>
    {error ? <p className="knowledge-notice" role="alert">{error}</p> : null}
    <div className="inquiry-list-heading"><strong>{total.toLocaleString()}件</strong><span>チャットからのお問い合わせ</span></div>
    <section className="surface inquiry-list" aria-busy={loading} aria-label="お問い合わせ一覧">
      <div className="inquiry-list-head"><span>受付日時</span><span>種別</span><span>お客様</span><span>相談内容</span><span>操作</span></div>
      {rows.map((row) => <button className="inquiry-row" type="button" key={row.id} onClick={() => setSelected(row)}>
        <time>{formatDate(row.createdAt)}</time>
        <span className="inquiry-kind-cell">
          <span className="inquiry-kind">{inquiryKindLabel(row.kind)}</span>
          {inquiryNotificationLabel(row.notificationStatus) ? <small className={`inquiry-mail inquiry-mail-${row.notificationStatus}`}>{inquiryNotificationLabel(row.notificationStatus)}</small> : null}
        </span>
        <span className="inquiry-person"><strong>{row.name || '氏名未入力'}</strong><small>{row.phone || '電話番号未入力'}</small></span>
        <InquirySummary inquiry={row} />
        <span className="row-action">詳細を見る <ChevronRight /></span>
      </button>)}
      {loading && rows.length === 0 ? <div className="knowledge-empty"><RefreshCw className="spin" /><p>お問い合わせを読み込んでいます…</p></div> : null}
      {!loading && rows.length === 0 ? <div className="knowledge-empty"><ClipboardList /><p>お問い合わせはまだありません。</p></div> : null}
    </section>
    {totalPages > 1 ? <nav className="inquiry-pagination" aria-label="お問い合わせのページ移動"><button className="secondary-button" type="button" disabled={loading || page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft />前へ</button><span>{page} / {totalPages} ページ</span><button className="secondary-button" type="button" disabled={loading || page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>次へ<ChevronRight /></button></nav> : null}
    {selected ? <InquiryDetails inquiry={selected} onClose={() => setSelected(null)} onOpenConversation={onOpenConversation} /> : null}
  </main>;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (identity: string) => void }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setError(''); setBusy(true);
    try {
      const session = await api.login(loginId, password); onAuthenticated(session.user.loginId || session.user.subject);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '処理に失敗しました。'); } finally { submitLock.current = false; setBusy(false); }
  };
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><span className="brand-cat" style={orinyanSpriteStyle} /></span><strong>オリにゃん管理</strong></div><h1>管理画面にログイン</h1><p>事前に配布された管理者IDとパスワードを入力してください。</p><form onSubmit={(event) => void submit(event)}><label>管理者ID<input type="text" autoComplete="username" value={loginId} onChange={(event) => setLoginId(event.target.value)} required placeholder="管理者IDを入力" disabled={busy} /></label><label>パスワード<input type="password" autoComplete="current-password" maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} /></label>{error ? <p className="auth-error" role="alert">{error}</p> : null}<button className="primary-button full" disabled={busy}>{busy ? '処理中…' : 'ログイン'}</button></form></section></main>;
}

export function App() {
  const [page, setPage] = useState<PageKey>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [session, setSession] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [focusConversationId, setFocusConversationId] = useState<string | undefined>();
  useEffect(() => { void api.authSession().then((value) => setSession(value.authenticated ? value.user?.loginId || null : null)).catch(() => setSession(null)).finally(() => setCheckingSession(false)); }, []);
  useEffect(() => {
    const expireSession = () => setSession(null);
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, expireSession);
    return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, expireSession);
  }, []);
  const logout = async () => { try { await api.logout(); } finally { setSession(null); } };
  const ActivePage = page === 'reports' ? ReportsPage : page === 'knowledge' ? KnowledgePage : null;
  if (checkingSession) return <main className="auth-page"><p>ログイン状態を確認しています…</p></main>;
  if (!session) return <AuthScreen onAuthenticated={setSession} />;
  return <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <header className="topbar"><button className="menu-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'メニューを開く' : 'メニューを折りたたむ'} aria-expanded={!collapsed}><Menu /></button><div className="brand"><span className="brand-mark" aria-hidden="true"><span className="brand-cat" style={orinyanSpriteStyle} /></span><strong>オリにゃん管理</strong></div><div className="topbar-right"><span className="environment"><Activity />本番</span><span className="account-email">{session}</span><button className="secondary-button logout-button" onClick={() => void logout()}>ログアウト</button></div></header>
    <Sidebar page={page} onPage={setPage} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
    <section className="content">{
      page === 'overview'
        ? <OverviewPage onOpenConversations={(conversationId) => { setFocusConversationId(conversationId); setPage('conversations'); }} />
        : page === 'conversations'
          ? <ConversationsPage initialConversationId={focusConversationId} />
          : page === 'inquiries'
            ? <InquiriesPage onOpenConversation={(conversationId) => { setFocusConversationId(conversationId); setPage('conversations'); }} />
            : ActivePage ? <ActivePage /> : null
    }</section>
  </div>;
}
