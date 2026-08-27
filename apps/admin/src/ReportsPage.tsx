import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Gauge, MessageSquareText, Sparkles, UsersRound } from 'lucide-react';
import {
  api,
  visitorDemographicLabel,
  type MonthlyIntentCount,
  type MonthlyPropertyInterest,
  type MonthlyReport,
} from './api';
import { formatJapanDateTime } from '../../worker/src/japan-time';

const orinyanSpriteStyle = { backgroundImage: "url('/assets/orinyan-states.png')" };

const genderLabels: Record<MonthlyReport['genders'][number]['gender'], string> = {
  male: '男性',
  female: '女性',
  other: 'そのほか',
};
const genderOrder: Array<MonthlyReport['genders'][number]['gender']> = ['male', 'female', 'other'];
const ageLabels: Record<MonthlyReport['ages'][number]['ageDecade'], string> = {
  teens: '10代',
  '20s': '20代',
  '30s': '30代',
  '40s': '40代',
  '50s': '50代',
  '60s_plus': '60代以上',
};
const ageOrder: Array<MonthlyReport['ages'][number]['ageDecade']> = ['teens', '20s', '30s', '40s', '50s', '60s_plus'];
const intentLabels: Record<MonthlyIntentCount['intent'], string> = {
  rent: '賃貸探し',
  buy: '購入検討',
  sell: '売却・査定',
  build: '注文住宅・リフォーム',
  other: 'その他',
};
const categoryLabels = {
  properties_for_sale: '売買',
  properties_for_rent: '賃貸',
} as const;

function formatDate(value: string) {
  return formatJapanDateTime(value);
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-');
  if (!year || !monthNumber) return month;
  return `${year}年${Number(monthNumber)}月`;
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function propertyLabel(item: MonthlyPropertyInterest) {
  const who = visitorDemographicLabel(item.gender, item.ageDecade);
  const kind = item.category ? categoryLabels[item.category] : '';
  return kind ? `${who} ／ ${kind}` : who;
}

export function ReportsPage() {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const applyResult = (data: { availableMonths: string[]; report: MonthlyReport | null }, month?: string) => {
    setReport(data.report);
    setMonths(data.availableMonths);
    setSelectedMonth(data.report?.month || month || data.availableMonths[0] || '');
  };

  const loadMonth = useCallback(async (month?: string) => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setLoading(true);
    setError(null);
    try {
      const data = await api.monthlyReport(month);
      if (requestSequence.current !== sequence) return;
      applyResult(data, month);
    } catch (reason) {
      if (requestSequence.current !== sequence) return;
      setError(reason instanceof Error ? reason.message : '月次レポートを読み込めませんでした。');
    } finally {
      if (requestSequence.current === sequence) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMonth(); }, [loadMonth]);

  const requestCommentary = async () => {
    if (!selectedMonth || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await api.orinyanCommentary(selectedMonth);
      applyResult(data, selectedMonth);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'オリにゃん総評を生成できませんでした。');
    } finally {
      setGenerating(false);
    }
  };

  if (!report) {
    return <>
      <PageHeader title="月次レポート" description="途中の月でも、相談の動きとオリにゃん総評を確認できます。" />
      {error ? <p className="knowledge-notice" role="alert">{error}</p> : null}
      <div className="surface report-empty">
        <Gauge />
        <p>{loading ? '月次レポートを読み込んでいます…' : 'まだ表示できる月次レポートがありません。'}</p>
      </div>
    </>;
  }

  const conversations = report.conversations || Number(report.funnel?.conversations || 0);
  const maxQuestionCount = Math.max(1, ...report.questionTrends.map((item) => Number(item.count)));
  const demographicTotal = report.genders.reduce((sum, item) => sum + item.count, 0);
  const intentTotal = report.intents.reduce((sum, item) => sum + item.count, 0);
  const commentary = report.orinyanCommentary?.text?.trim() || '';

  return <>
    <PageHeader
      title="月次レポート"
      description="途中の月でも集計を見られます。オリにゃん総評は、その月のデータから担当者向けの気づきを話します。"
      action={<label className="report-month-select">
        <span>対象月</span>
        <select value={selectedMonth} onChange={(event) => void loadMonth(event.target.value)} disabled={loading || generating}>
          {months.map((month) => <option value={month} key={month}>{formatMonthLabel(month)}</option>)}
        </select>
        <ChevronDown />
      </label>}
    />
    {error ? <p className="knowledge-notice" role="alert">{error}</p> : null}

    <section className="metric-strip report-metrics">
      <div className="metric"><MessageSquareText /><p>会話</p><strong>{conversations.toLocaleString()}</strong><small>対象月の開始数</small></div>
      <div className="metric"><MessageSquareText /><p>質問</p><strong>{report.questions.toLocaleString()}</strong><small>相談内容の入力数</small></div>
      <div className="metric"><UsersRound /><p>相談者</p><strong>{report.visitors.toLocaleString()}</strong><small>ユニーク数</small></div>
      <div className="metric"><Gauge /><p>状態</p><strong>{report.status === 'in_progress' ? '途中経過' : '確定'}</strong><small>{formatMonthLabel(report.month)}</small></div>
    </section>

    <section className="surface orinyan-commentary">
      <div className="orinyan-commentary-head">
        <span className="orinyan-commentary-cat" style={orinyanSpriteStyle} aria-hidden="true" />
        <div>
          <h2>オリにゃん総評</h2>
          <p>{report.status === 'in_progress'
            ? 'いままでの数字をもとに話すにゃん。月末まではまだ変わるにゃん。'
            : 'この月のチャット集計をもとに、担当者向けの気づきを話すにゃん。'}</p>
        </div>
        <button className="primary-button" type="button" onClick={() => void requestCommentary()} disabled={generating || loading}>
          <Sparkles />
          {generating ? '考え中にゃん…' : '総評をもらう'}
        </button>
      </div>
      {generating ? <p className="orinyan-commentary-pending">数字をながめて、現場で使えそうな話をまとめてるにゃん。</p> : null}
      {!generating && commentary ? <div className="orinyan-speech">
        {commentary.split(/\n{2,}/u).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        <small>生成: {formatDate(report.orinyanCommentary?.generatedAt || '')}</small>
      </div> : null}
      {!generating && !commentary ? <p className="orinyan-commentary-empty">まだ総評がないにゃん。ボタンを押すと、この月の性別・年代・よく見られた物件からお話しするにゃん。</p> : null}
    </section>

    <div className="report-grid">
      <section className="surface">
        <div className="section-heading"><div><h2>相談者の年代・性別</h2><p>会話開始前に選んだ属性</p></div><UsersRound /></div>
        {demographicTotal ? <div className="demographic-stats">
          <div className="demographic-split">
            {genderOrder.map((gender) => {
              const count = report.genders.find((item) => item.gender === gender)?.count || 0;
              return <span key={gender}>{genderLabels[gender]} {count.toLocaleString()}件（{percent(count, demographicTotal)}%）</span>;
            })}
          </div>
          <table className="demographic-matrix">
            <thead>
              <tr>
                <th>年代</th>
                {genderOrder.map((gender) => <th key={gender}>{genderLabels[gender]}</th>)}
                <th>合計</th>
              </tr>
            </thead>
            <tbody>
              {ageOrder.map((age) => {
                const counts = genderOrder.map((gender) => report.demographics.find((item) => item.gender === gender && item.ageDecade === age)?.count || 0);
                const rowTotal = counts.reduce((sum, count) => sum + count, 0);
                return <tr key={age}>
                  <th>{ageLabels[age]}</th>
                  {counts.map((count, index) => <td key={genderOrder[index]}>{count.toLocaleString()}</td>)}
                  <td>{rowTotal.toLocaleString()}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div> : <p className="chart-empty">性別と年代の選択が集まると、ここに表示します。</p>}
      </section>
      <section className="surface">
        <div className="section-heading"><div><h2>相談ニーズ</h2><p>質問内容から集計した検討傾向</p></div><Building2 /></div>
        {intentTotal ? <div className="intent-bars">
          {report.intents.map((item) => <div key={item.intent}>
            <span>{intentLabels[item.intent]}</span>
            <b><i style={{ width: `${Math.max(item.count ? 7 : 0, percent(item.count, intentTotal))}%` }} /></b>
            <strong>{item.count.toLocaleString()}件</strong>
            <small>{percent(item.count, intentTotal)}%</small>
          </div>)}
        </div> : <p className="chart-empty">相談内容が集まると、検討傾向をここに表示します。</p>}
      </section>
    </div>

    <div className="report-grid">
      <section className="surface">
        <div className="section-heading"><div><h2>よくある質問</h2><p>PIIマスク後の質問文を集計</p></div></div>
        {report.questionTrends.length ? <div className="trend-list">{report.questionTrends.slice(0, 10).map((item, index) => <div key={`${item.question}-${index}`}><span>{index + 1}</span><p>{item.question}</p><i style={{ width: `${Math.max(8, (Number(item.count) / maxQuestionCount) * 100)}%` }} /><strong>{Number(item.count).toLocaleString()}件</strong></div>)}</div> : <p className="chart-empty">質問が集まると、ここに表示します。</p>}
      </section>
      <section className="surface">
        <div className="section-heading"><div><h2>属性別の人気物件</h2><p>チャット開始ページと案内した物件</p></div><Building2 /></div>
        {report.propertyInterests.length ? <ol className="report-property-list">
          {report.propertyInterests.slice(0, 8).map((item) => <li key={`${item.gender}:${item.ageDecade}:${item.sourceUrl || item.title}`}>
            <div>
              <strong>{item.title}</strong>
              <small>{propertyLabel(item)}</small>
            </div>
            <b>{item.count.toLocaleString()}件</b>
          </li>)}
        </ol> : <p className="chart-empty">物件ページからの相談や案内が増えると、属性ごとの人気が出ます。</p>}
      </section>
    </div>
    <p className="report-generated">
      {report.status === 'in_progress' ? '途中経過' : '確定集計'} ／ 集計日時: {formatDate(report.generatedAt)}
      {report.orinyanCommentary ? ` ／ 総評: ${formatDate(report.orinyanCommentary.generatedAt)}` : ''}
    </p>
  </>;
}