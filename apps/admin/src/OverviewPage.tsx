import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight, CircleAlert, Clock3, Database, Gauge, Globe, MessageSquareText,
  TrendingUp, UsersRound,
} from 'lucide-react';
import {
  api,
  type ConversationSummary,
  type OverviewDailyPoint,
  type OverviewData,
  type OverviewHourCount,
  type OverviewPageCount,
  type OverviewPolicyCount,
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
  policy: [],
  hours: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
  usage: [],
  costGuard: { day: '', sessions: 0, sessionLimit: 500, aiRequests: 0, aiRequestLimit: 500 },
};

const policyLabels: Record<string, string> = {
  allow: '回答済み',
  price_negotiation: '価格交渉',
  legal_judgment: '法的判断',
  important_matters: '重要事項',
  prompt_injection: '不正な指示',
  out_of_scope: '対象外',
  no_grounding: '根拠不足',
};

const policyColors: Record<string, string> = {
  allow: '#20a95b',
  price_negotiation: '#e98b09',
  legal_judgment: '#2563b8',
  important_matters: '#ff680b',
  prompt_injection: '#ef4444',
  out_of_scope: '#74757f',
  no_grounding: '#7c3aed',
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
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="過去30日の推移">
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
      <span>{metric === 'conversations' ? '会話' : '訪問者'} {active[metric].toLocaleString()}件</span>
    </div> : null}
  </div>;
}

function HourChart({ hours }: { hours: OverviewHourCount[] }) {
  const max = Math.max(1, ...hours.map((item) => item.count));
  const current = japanHour();
  return <div className="hour-chart" role="img" aria-label="時間帯別の会話数">
    {hours.map((item) => (
      <div key={item.hour} className={`hour-bar ${item.hour === current ? 'current' : ''}`} title={`${item.hour}時 ${item.count.toLocaleString()}件`}>
        <i style={{ height: `${Math.max(6, (item.count / max) * 100)}%` }} />
        {item.hour % 3 === 0 ? <small>{item.hour}</small> : <small>&nbsp;</small>}
      </div>
    ))}
  </div>;
}

function PageBars({ pages }: { pages: OverviewPageCount[] }) {
  const max = Math.max(1, ...pages.map((item) => item.count));
  if (!pages.length) return <p className="chart-empty">まだ訪問元ページの集計がありません。</p>;
  return <div className="page-bars">
    {pages.map((item) => {
      const path = shortenPage(item.page);
      return <div key={item.page}>
        <span title={item.page}>{path}</span>
        <b><i style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }} /></b>
        <strong>{item.count.toLocaleString()}</strong>
      </div>;
    })}
  </div>;
}

function PolicyDonut({ policy }: { policy: OverviewPolicyCount[] }) {
  const total = policy.reduce((sum, item) => sum + item.count, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  if (!total) return <p className="chart-empty">まだ回答判定の集計がありません。</p>;
  return <div className="policy-donut">
    <svg viewBox="0 0 140 140" aria-hidden="true">
      {policy.map((item) => {
        const length = (item.count / total) * circumference;
        const circle = <circle
          key={item.action}
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={policyColors[item.action] || '#74757f'}
          strokeWidth="16"
          strokeDasharray={`${length} ${circumference - length}`}
          strokeDashoffset={-offset}
          transform="rotate(-90 70 70)"
        />;
        offset += length;
        return circle;
      })}
      <text x="70" y="66" textAnchor="middle" className="donut-value">{total.toLocaleString()}</text>
      <text x="70" y="84" textAnchor="middle" className="donut-label">件</text>
    </svg>
    <ul>
      {policy.map((item) => (
        <li key={item.action}>
          <i style={{ background: policyColors[item.action] || '#74757f' }} />
          <span>{policyLabels[item.action] || item.action}</span>
          <strong>{percent(item.count, total)}%</strong>
        </li>
      ))}
    </ul>
  </div>;
}

function UsageMeter({ label, value, limit }: { label: string; value: number; limit: number }) {
  const ratio = limit > 0 ? Math.min(1, value / limit) : 0;
  const tone = ratio >= 0.9 ? 'danger' : ratio >= 0.8 ? 'warning' : 'ok';
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return <div className={`usage-meter ${tone}`}>
    <svg viewBox="0 0 88 88" aria-hidden="true">
      <circle cx="44" cy="44" r={radius} fill="none" stroke="#eceef3" strokeWidth="8" />
      <circle
        cx="44"
        cy="44"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${circumference * ratio} ${circumference}`}
        transform="rotate(-90 44 44)"
      />
      <text x="44" y="48" textAnchor="middle">{percent(value, limit)}%</text>
    </svg>
    <div>
      <p>{label}</p>
      <strong>{value.toLocaleString()} / {limit.toLocaleString()}</strong>
    </div>
  </div>;
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
  const consentRate = percent(data.consented30d, data.conversations30d);
  const latestUsage = useMemo(() => data.usage.slice(-7), [data.usage]);
  const usageMax = Math.max(1, ...latestUsage.map((item) => item.sessions));

  const metrics = [
    { label: '今日の会話', value: data.conversationsToday, note: todayDelta.label, tone: todayDelta.tone, icon: TrendingUp },
    { label: '過去30日の会話', value: data.conversations30d, note: 'チャット開始数', tone: 'flat' as const, icon: MessageSquareText },
    { label: '訪問者', value: data.visitors30d, note: '過去30日のユニーク', tone: 'flat' as const, icon: UsersRound },
    { label: '回答を控えた質問', value: data.refused30d, note: '担当確認の候補', tone: data.refused30d ? 'down' as const : 'flat' as const, icon: CircleAlert },
    { label: 'ナレッジ資料', value: data.knowledgeItems, note: 'AI Search登録数', tone: 'flat' as const, icon: Database },
  ] as const;

  return <>
    <PageHeader title="概要" description="チャットの訪問数、会話の推移、よく見られているページをまとめて確認します。" />
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
            <h2>訪問と会話の推移</h2>
            <p>日本時間の過去30日。会話1件はチャットを開いた訪問として数えます。</p>
          </div>
          <div className="chart-toggle" role="tablist" aria-label="グラフの指標">
            <button type="button" role="tab" aria-selected={metric === 'conversations'} className={metric === 'conversations' ? 'active' : ''} onClick={() => setMetric('conversations')}>会話</button>
            <button type="button" role="tab" aria-selected={metric === 'visitors'} className={metric === 'visitors' ? 'active' : ''} onClick={() => setMetric('visitors')}>訪問者</button>
          </div>
        </div>
        <TrendChart series={data.daily} metric={metric} />
        <p className="chart-caption">会話あたりの質問 {questionsPerConversation.toFixed(1)}件 ／ 案内同意 {data.consented30d.toLocaleString()}件（{consentRate}%）</p>
      </section>
      <section className="surface overview-guard">
        <div className="section-heading"><div><h2>本日の稼働</h2><p>日次コストガード {data.costGuard.day || '—'}</p></div><Gauge /></div>
        <UsageMeter label="セッション" value={data.costGuard.sessions} limit={data.costGuard.sessionLimit} />
        <UsageMeter label="AI回答" value={data.costGuard.aiRequests} limit={data.costGuard.aiRequestLimit} />
        <div className="usage-spark" aria-label="直近7日のセッション">
          {latestUsage.map((item) => <i key={item.day} style={{ height: `${Math.max(8, (item.sessions / usageMax) * 100)}%` }} title={`${formatDay(item.day)} ${item.sessions.toLocaleString()}件`} />)}
        </div>
        <p className="chart-caption">直近7日のセッション数</p>
      </section>
    </div>

    <div className="overview-charts">
      <section className="surface">
        <div className="section-heading"><div><h2>時間帯</h2><p>会話が始まった時間（日本時間）</p></div><Clock3 /></div>
        <HourChart hours={data.hours} />
      </section>
      <section className="surface">
        <div className="section-heading"><div><h2>よく使われるページ</h2><p>チャット開始時の掲載ページ</p></div><Globe /></div>
        <PageBars pages={data.topPages} />
      </section>
      <section className="surface">
        <div className="section-heading"><div><h2>回答判定</h2><p>過去30日のアシスタント応答</p></div></div>
        <PolicyDonut policy={data.policy} />
      </section>
    </div>

    <div className="overview-grid">
      <section className="surface activity-list">
        <div className="section-heading">
          <div><h2>最近の会話</h2><p>直近の質問と回答状態</p></div>
          <button className="text-button" type="button" onClick={onOpenConversations}>すべて見る <ChevronRight /></button>
        </div>
        {recent.length ? recent.map((item) => <button className="activity-row" key={item.id} type="button" onClick={onOpenConversations}>
          <span className={`activity-icon ${item.has_refusal ? 'warn' : ''}`}>{item.has_refusal ? <CircleAlert /> : <MessageSquareText />}</span>
          <span><strong>{item.latest_message}</strong><small>{shortenPage(item.source_page)}</small></span>
          <time>{formatDate(item.updated_at)}</time><ChevronRight />
        </button>) : <p className="chart-empty">まだ会話はありません。</p>}
      </section>
      <section className="surface attention-list">
        <div className="section-heading"><div><h2>確認が必要</h2><p>運用担当者向けの通知</p></div></div>
        <button className="attention" type="button" onClick={onOpenConversations}>
          <span className="warning-dot"></span>
          <div><strong>回答を控えた質問</strong><p>過去30日で{data.refused30d.toLocaleString()}件あります。会話ログから確認できます。</p></div>
          <ChevronRight />
        </button>
        <div className="attention">
          <span className="info-dot"></span>
          <div><strong>ナレッジの登録状況</strong><p>{data.knowledgeItems.toLocaleString()}件の資料が管理対象です。</p></div>
        </div>
        <div className="attention">
          <span className={data.costGuard.aiRequests / data.costGuard.aiRequestLimit >= 0.8 ? 'warning-dot' : 'success-dot'}></span>
          <div><strong>日次コストガード</strong><p>AI回答 {data.costGuard.aiRequests.toLocaleString()} / {data.costGuard.aiRequestLimit.toLocaleString()}件、セッション {data.costGuard.sessions.toLocaleString()} / {data.costGuard.sessionLimit.toLocaleString()}件</p></div>
          <Gauge />
        </div>
      </section>
    </div>
  </>;
}
