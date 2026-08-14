import { useEffect, useState } from 'react';
import {
  Building2, CalendarDays, CheckCircle2, ChevronRight, Clock3,
  Eye, MapPinned, MessageSquareText, TrendingUp, UsersRound,
} from 'lucide-react';
import {
  api,
  type ConversationSummary,
  type OverviewDailyPoint,
  type OverviewData,
  type OverviewHourCount,
  type OverviewIntentCount,
  type OverviewPrefectureCount,
  type OverviewPropertyView,
} from './api';

const emptyOverview: OverviewData = {
  conversations30d: 0,
  conversationsToday: 0,
  conversationsYesterday: 0,
  visitors30d: 0,
  questions30d: 0,
  refused30d: 0,
  consented30d: 0,
  knowledgeItems: 0,
  daily: [],
  topPages: [],
  propertyPrefectures: [],
  topProperties: [],
  policy: [],
  intents: [],
  hours: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
  usage: [],
  costGuard: { day: '', sessions: 0, sessionLimit: 500, aiRequests: 0, aiRequestLimit: 500 },
};

const intentLabels: Record<OverviewIntentCount['intent'], string> = {
  rent: '賃貸探し',
  buy: '購入検討',
  sell: '売却・査定',
  build: '注文住宅・リフォーム',
  other: 'その他',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatDay(value: string) {
  const parts = value.split('-');
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function japanHour(now = new Date()) {
  return Number(new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(11, 13));
}

function shortenPage(page: string) {
  try {
    const url = new URL(page);
    return `${url.pathname}${url.search}`.replace(/\/$/, '') || '/';
  } catch {
    return page || '/';
  }
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function dayDelta(current: number, previous: number) {
  if (current === previous) return { label: '前日と同じ', tone: 'flat' as const };
  if (previous === 0) return { label: '前日は0件', tone: current > 0 ? 'up' as const : 'flat' as const };
  const change = Math.round(((current - previous) / previous) * 100);
  return {
    label: `${change > 0 ? '+' : ''}${change}% 前日比`,
    tone: change >= 0 ? 'up' as const : 'down' as const,
  };
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return <header className="page-header"><div><h1>{title}</h1><p>{description}</p></div></header>;
}

function TrendChart({ series, metric }: { series: OverviewDailyPoint[]; metric: 'conversations' | 'visitors' }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;
  const height = 248;
  const pad = { top: 18, right: 16, bottom: 32, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = series.map((point) => point[metric]);
  const max = Math.max(1, ...values);
  const points = series.map((point, index) => {
    const x = series.length <= 1 ? pad.left + innerW / 2 : pad.left + (index / (series.length - 1)) * innerW;
    const y = pad.top + innerH - (point[metric] / max) * innerH;
    return { x, y, ...point };
  });
  const first = points[0];
  const last = points.at(-1);
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = first && last
    ? `${line} L${last.x.toFixed(1)} ${pad.top + innerH} L${first.x.toFixed(1)} ${pad.top + innerH} Z`
    : '';
  const ticks = Array.from(new Set([0, Math.round(max / 2), max]));
  const xLabels = series.filter((_, index) => index === 0 || index === series.length - 1 || index % 7 === 6);
  const active = hover !== null ? points[hover] : last;
  const color = metric === 'conversations' ? '#ff680b' : '#2563b8';

  return <div className="trend-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="過去30日の相談推移">
      <defs>
        <linearGradient id="overview-trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => {
        const y = pad.top + innerH - (tick / max) * innerH;
        return <g key={tick}>
          <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="chart-grid" />
          <text x={pad.left - 8} y={y + 3} className="chart-axis" textAnchor="end">{tick.toLocaleString()}</text>
        </g>;
      })}
      {area ? <path d={area} fill="url(#overview-trend-fill)" /> : null}
      {line ? <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {xLabels.map((point) => {
        const index = series.indexOf(point);
        const x = points[index]?.x || pad.left;
        return <text key={point.day} x={x} y={height - 8} className="chart-axis" textAnchor="middle">{formatDay(point.day)}</text>;
      })}
      {active ? <>
        <line x1={active.x} x2={active.x} y1={pad.top} y2={pad.top + innerH} className="chart-hover-line" />
        <circle cx={active.x} cy={active.y} r="4.5" fill="#fff" stroke={color} strokeWidth="2.4" />
      </> : null}
      {points.map((point, index) => (
        <rect
          key={point.day}
          x={index === 0 ? pad.left : point.x - innerW / (series.length * 2)}
          y={pad.top}
          width={innerW / Math.max(1, series.length)}
          height={innerH}
          fill="transparent"
          onMouseEnter={() => setHover(index)}
          onMouseLeave={() => setHover(null)}
        />
      ))}
    </svg>
    {active ? <div className="chart-tooltip" style={{ left: `${((active.x - pad.left) / innerW) * 100}%` }}>
      <strong>{formatDay(active.day)}</strong>
      <span>{metric === 'conversations' ? '相談' : '相談者'} {active[metric].toLocaleString()}件</span>
    </div> : null}
  </div>;
}

function HourChart({ hours }: { hours: OverviewHourCount[] }) {
  const max = Math.max(1, ...hours.map((item) => item.count));
  const current = japanHour();
  return <div className="hour-chart" role="img" aria-label="時間帯別の相談数">
    {hours.map((item) => (
      <div key={item.hour} className={`hour-bar ${item.hour === current ? 'current' : ''}`} title={`${item.hour}時 ${item.count.toLocaleString()}件`}>
        <i style={{ height: `${Math.max(6, (item.count / max) * 100)}%` }} />
        {item.hour % 3 === 0 ? <small>{item.hour}</small> : <small>&nbsp;</small>}
      </div>
    ))}
  </div>;
}

function PrefectureBars({ items }: { items: OverviewPrefectureCount[] }) {
  const visible = items.slice(0, 8);
  const max = Math.max(1, ...visible.map((item) => item.total));
  if (!visible.length) return <p className="chart-empty">物件の所在地を集計中です。</p>;
  return <div className="prefecture-bars">
    <div className="property-legend"><span className="sale">売買</span><span className="rent">賃貸</span></div>
    {visible.map((item) => <div key={item.prefecture}>
      <span>{item.prefecture}</span>
      <b title={`売買 ${item.sale}件・賃貸 ${item.rent}件`}>
        <i className="sale" style={{ width: `${(item.sale / max) * 100}%` }} />
        <i className="rent" style={{ width: `${(item.rent / max) * 100}%` }} />
      </b>
      <strong>{item.total.toLocaleString()}件</strong>
      <small>売{item.sale}・賃{item.rent}</small>
    </div>)}
  </div>;
}

function PropertyRanking({ items }: { items: OverviewPropertyView[] }) {
  if (!items.length) return <div className="property-ranking-empty">
    <Eye />
    <div><strong>閲覧データはこれから蓄積されます</strong><p>チャットを設置した物件詳細ページが閲覧されると、物件名でランキング表示します。</p></div>
  </div>;
  return <ol className="property-ranking">
    {items.map((item, index) => <li key={item.sourceUrl}>
      <span>{index + 1}</span>
      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
        <strong>{item.title}</strong>
        <small>{item.address || '所在地未登録'}</small>
      </a>
      <b>{item.count.toLocaleString()}人</b>
      <ChevronRight />
    </li>)}
  </ol>;
}

function IntentBars({ intents }: { intents: OverviewIntentCount[] }) {
  const counts = new Map(intents.map((item) => [item.intent, item.count]));
  const ordered = (Object.keys(intentLabels) as OverviewIntentCount['intent'][]).map((intent) => ({
    intent,
    count: counts.get(intent) || 0,
  }));
  const total = ordered.reduce((sum, item) => sum + item.count, 0);
  if (!total) return <p className="chart-empty">相談内容が集まると、検討傾向をここに表示します。</p>;
  return <div className="intent-bars">
    {ordered.map((item) => <div key={item.intent}>
      <span>{intentLabels[item.intent]}</span>
      <b><i style={{ width: `${Math.max(item.count ? 7 : 0, percent(item.count, total))}%` }} /></b>
      <strong>{item.count.toLocaleString()}件</strong>
      <small>{percent(item.count, total)}%</small>
    </div>)}
  </div>;
}

function ReceptionSummary({ data }: { data: OverviewData }) {
  const usageRate = percent(data.costGuard.sessions, data.costGuard.sessionLimit);
  const delta = dayDelta(data.conversationsToday, data.conversationsYesterday);
  const busiest = data.hours.reduce((best, item) => item.count > best.count ? item : best, { hour: 0, count: 0 });
  const normal = usageRate < 80;
  return <section className="surface reception-summary">
    <div className="section-heading"><div><h2>本日の受付状況</h2><p>{data.costGuard.day || '本日'}の相談受付</p></div><CheckCircle2 /></div>
    <div className={`reception-health ${normal ? 'ok' : 'warning'}`}>
      <span />
      <strong>{normal ? '正常に受付中' : '受付数が上限に近づいています'}</strong>
    </div>
    <div className="reception-stats">
      <div><small>本日の相談</small><strong>{data.conversationsToday.toLocaleString()}件</strong></div>
      <div><small>前日比</small><strong className={`delta ${delta.tone}`}>{delta.label.replace(' 前日比', '')}</strong></div>
      <div><small>相談が多い時間</small><strong>{busiest.count ? `${busiest.hour}時台` : '—'}</strong></div>
    </div>
    <div className="reception-capacity">
      <div><span>受付上限の使用状況</span><strong>{data.costGuard.sessions.toLocaleString()} / {data.costGuard.sessionLimit.toLocaleString()}件</strong></div>
      <b><i style={{ width: `${Math.min(100, usageRate)}%` }} /></b>
    </div>
  </section>;
}

export function OverviewPage({ onOpenConversations }: { onOpenConversations: () => void }) {
  const [data, setData] = useState<OverviewData>(emptyOverview);
  const [recent, setRecent] = useState<ConversationSummary[]>([]);
  const [metric, setMetric] = useState<'conversations' | 'visitors'>('conversations');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.overview().then(setData).catch((reason) => {
      setError(reason instanceof Error ? reason.message : '概要を読み込めませんでした。');
    });
    void api.conversations().then((result) => setRecent(result.result.slice(0, 6))).catch(() => undefined);
  }, []);

  const todayDelta = dayDelta(data.conversationsToday, data.conversationsYesterday);
  const questionsPerConversation = data.conversations30d ? (data.questions30d / data.conversations30d) : 0;

  const metrics = [
    { label: '今日の相談', value: data.conversationsToday, note: todayDelta.label, tone: todayDelta.tone, icon: TrendingUp },
    { label: '30日間の相談', value: data.conversations30d, note: '相談受付数', tone: 'flat' as const, icon: CalendarDays },
    { label: '相談者', value: data.visitors30d, note: '過去30日のユニーク数', tone: 'flat' as const, icon: UsersRound },
    { label: '30日間の質問', value: data.questions30d, note: '相談内容の入力数', tone: 'flat' as const, icon: MessageSquareText },
    { label: '登録物件・資料', value: data.knowledgeItems, note: '案内に使える情報', tone: 'flat' as const, icon: Building2 },
  ] as const;

  return <>
    <PageHeader title="概要" description="反響の動きと物件の閲覧傾向をまとめて確認します。" />
    {error ? <p className="knowledge-notice" role="alert">{error}</p> : null}
    <section className="metric-strip overview-metrics">
      {metrics.map((item) => {
        const Icon = item.icon;
        return <div className="metric" key={item.label}>
          <Icon />
          <p>{item.label}</p>
          <strong>{item.value.toLocaleString()}</strong>
          <small className={`delta ${item.tone}`}>{item.note}</small>
        </div>;
      })}
    </section>

    <div className="overview-hero">
      <section className="surface">
        <div className="section-heading">
          <div>
            <h2>相談の推移</h2>
            <p>日本時間の過去30日。相談件数と相談者数の動きを確認できます。</p>
          </div>
          <div className="chart-toggle" role="tablist" aria-label="相談推移の指標">
            <button type="button" role="tab" aria-selected={metric === 'conversations'} className={metric === 'conversations' ? 'active' : ''} onClick={() => setMetric('conversations')}>相談</button>
            <button type="button" role="tab" aria-selected={metric === 'visitors'} className={metric === 'visitors' ? 'active' : ''} onClick={() => setMetric('visitors')}>相談者</button>
          </div>
        </div>
        <TrendChart series={data.daily} metric={metric} />
        <p className="chart-caption">相談あたりの質問 {questionsPerConversation.toFixed(1)}件 ／ 30日間の質問 {data.questions30d.toLocaleString()}件</p>
      </section>
      <ReceptionSummary data={data} />
    </div>

    <div className="overview-property-grid">
      <section className="surface">
        <div className="section-heading"><div><h2>物件数が多い都道府県</h2><p>登録中の売買・賃貸物件を所在地別に集計</p></div><MapPinned /></div>
        <PrefectureBars items={data.propertyPrefectures} />
      </section>
      <section className="surface">
        <div className="section-heading"><div><h2>閲覧が多い物件</h2><p>過去30日の物件ページ閲覧者数（1日1人1回）</p></div><Eye /></div>
        <PropertyRanking items={data.topProperties} />
      </section>
    </div>

    <div className="overview-charts overview-secondary-charts">
      <section className="surface">
        <div className="section-heading"><div><h2>相談ニーズ</h2><p>相談内容から集計した検討傾向（過去30日）</p></div><Building2 /></div>
        <IntentBars intents={data.intents} />
      </section>
      <section className="surface">
        <div className="section-heading"><div><h2>相談が多い時間帯</h2><p>相談が始まった時間（日本時間・過去30日）</p></div><Clock3 /></div>
        <HourChart hours={data.hours} />
      </section>
    </div>

    <div className="overview-grid">
      <section className="surface activity-list">
        <div className="section-heading">
          <div><h2>最近の相談</h2><p>直近に寄せられた相談内容</p></div>
          <button className="text-button" type="button" onClick={onOpenConversations}>すべて見る <ChevronRight /></button>
        </div>
        {recent.length ? recent.map((item) => <button className="activity-row" key={item.id} type="button" onClick={onOpenConversations}>
          <span className="activity-icon"><MessageSquareText /></span>
          <span><strong>{item.latest_message}</strong><small>{shortenPage(item.source_page)}</small></span>
          <time>{formatDate(item.updated_at)}</time><ChevronRight />
        </button>) : <p className="chart-empty">まだ相談はありません。</p>}
      </section>
    </div>
  </>;
}
