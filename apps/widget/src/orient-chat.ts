type CatState = 'idle' | 'listening' | 'speaking' | 'thinking';
type ChatRole = 'assistant' | 'user';

interface Source {
  index: number;
  title: string;
  url?: string;
  key?: string;
  score?: number;
}

interface ChatChoice {
  label: string;
  value: string;
  tone?: 'primary' | 'default';
  size?: 'compact';
}

interface ChatDatetimePicker {
  type: 'datetime';
  min: string;
  max: string;
  prefix: string;
}

interface ChatFollowUp {
  answer: string;
  choices?: ChatChoice[];
}

type VisitorGender = 'male' | 'female' | 'other';
type VisitorAgeDecade = 'teens' | '20s' | '30s' | '40s' | '50s' | '60s_plus';

const visitorGenderChoices: ChatChoice[] = [
  { label: '男性', value: 'male', tone: 'primary' },
  { label: '女性', value: 'female', tone: 'primary' },
  { label: 'そのほか', value: 'other' },
];
const visitorAgeChoices: ChatChoice[] = [
  { label: '10代', value: 'teens' },
  { label: '20代', value: '20s' },
  { label: '30代', value: '30s' },
  { label: '40代', value: '40s' },
  { label: '50代', value: '50s' },
  { label: '60代以上', value: '60s_plus' },
];
const visitorGenderLabels: Record<VisitorGender, string> = { male: '男性', female: '女性', other: 'そのほか' };
const visitorAgeLabels: Record<VisitorAgeDecade, string> = {
  teens: '10代', '20s': '20代', '30s': '30代', '40s': '40代', '50s': '50代', '60s_plus': '60代以上',
};

function isVisitorGender(value: string): value is VisitorGender {
  return value in visitorGenderLabels;
}

function isVisitorAgeDecade(value: string): value is VisitorAgeDecade {
  return value in visitorAgeLabels;
}

const orinyanMonthlyGreetings = [
  [
    'あけましておめでとう、オリにゃんだよ！\n今年もいいお部屋と、いい日なたに出会えますようにだにゃん。',
    'お正月、こたつから出られないオリにゃんだよ。\n「こたつ付き」の物件があったら、たぶん内見から帰らないにゃん。',
    '新しい年だにゃん！\n初夢に出てきた理想のお部屋、いっしょに正夢にしよっか。',
  ],
  [
    'こんにちは、オリにゃんだよ！\n梅が咲いたら春まであとちょっと。ぽかぽかのお部屋、探そっか。',
    '2月22日は猫の日だにゃん。\nオリにゃん的には、毎月22日でもいいと思ってるにゃん。',
    '寒い日は、猫を見れば家でいちばん暖かい場所がわかるらしいにゃん。\nオリにゃんの後ろ、ついてくる？',
  ],
  [
    '桜がそわそわ、オリにゃんもうきうきだにゃん！\n春のお部屋探し、いっしょに始めよっか。',
    '引っ越しの段ボールを見ると、猫はとりあえず入るにゃん。\n荷造りより先に、オリにゃんのお城が完成だにゃん。',
    '春風ふわり、こんにちは！\n新生活の「こんなお部屋がいい」、オリにゃんに聞かせてにゃん。',
  ],
  [
    '新生活、ちゃんと息抜きできてる？\nオリにゃんとお部屋の話でもして、ひと休みするにゃん。',
    '桜の花びらがお部屋までついてきたにゃん。\n家賃は払わないけど、かわいい同居人だにゃん。',
    'ぽかぽかの窓辺は、猫界の一等地だにゃん。\n人間界のいい物件も、オリにゃんにまかせてにゃん。',
  ],
  [
    '新緑きらきら、窓を開けるといい風だにゃん。\nこんな日は、お部屋探しものんびりいこっか。',
    '鯉のぼりは泳いで、オリにゃんはお昼寝だにゃん。\n住まいの相談がきたら、ちゃんと起きるにゃん！',
    '日当たりは方角だけじゃなく、窓の前の景色でも変わるにゃん。\nオリにゃん、意外と物件を見る目があるでしょ？',
  ],
  [
    'あじさいがきれいな季節だにゃん。\n雨音を聞きながら、居心地いいお部屋の話しよっか。',
    '雨の日は、おうちがいちばんの遊び場だにゃん。\nオリにゃんは今、カーテンの影と戦ってるにゃん。',
    '梅雨どきは、クローゼットもたまに風を通すと喜ぶにゃん。\nお部屋探しも湿気対策も、風通しが大事だにゃん。',
  ],
  [
    '七夕のお願い、もう決めた？\nオリにゃんは「涼しくて素敵なお部屋」に一票だにゃん。',
    '夏の窓辺はぽかぽかを通り越して、あちあちだにゃん。\n涼しい場所から、お部屋探し始めよっか。',
    '窓が二方向にあると、風の通り道をつくりやすいにゃん。\n猫の通り道もあると、なお最高だにゃん。',
  ],
  [
    '暑いね〜。オリにゃん、床でぺたんこになってるにゃん。\n花火の話でも、お部屋の話でも、ひと休みしよっか。',
    '夏休みの宿題は後回しでも、お部屋の相談は今すぐ聞くにゃん！\nオリにゃんにまかせてにゃん。',
    '畳のいい香りは「い草」からするにゃん。\nごろんとしたくなるのは、猫だけじゃないはずだにゃん。',
  ],
  [
    'ちょっと涼しくなって、オリにゃんの食欲が戻ってきたにゃん。\n秋のお部屋探しも、もりもり手伝うにゃん！',
    'お月見だにゃん。\n月がきれいに見える窓、オリにゃんの特等席に予約していい？',
    '赤とんぼを見つけたにゃん！\n秋風にのって、いい住まいも見つけにいこっか。',
  ],
  [
    'きんもくせい、いい香りだにゃん。\nつい遠回りしたくなる季節、お部屋探しも寄り道歓迎だにゃん。',
    'ハロウィンだにゃん！\nお菓子をくれなくても、物件情報はちゃんと教えるにゃん。',
    '猫は頭が通れば、体も通れることが多いらしいにゃん。\nでも内見では、ちゃんと玄関から入るにゃん。',
  ],
  [
    '落ち葉がカサカサ、猫心をくすぐるにゃん。\n追いかける前に、住まいの相談を聞くにゃん！',
    'お日さまが低くなる冬は、部屋の奥まで光が届きやすいにゃん。\n日なたチェックが楽しい季節だにゃん。',
    'そろそろ毛布の出番だにゃん。\nくるまる派？ かぶる派？ オリにゃんは中にもぐる派だにゃん。',
  ],
  [
    'もう年末だにゃん！\n大掃除は未来のオリにゃんに任せて、今日はお部屋の話しよっか。',
    'こたつ、みかん、オリにゃん。冬の三点セットだにゃん。\nあったかい住まいも加えたら完璧だにゃん。',
    '窓辺がひんやりする日は、厚手のカーテンも頼れるにゃん。\nオリにゃんは毛皮でぬくぬくだけどね。',
  ],
] as const;

function japanCalendarMonth(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCMonth();
}

function jstIsoDay(offsetDays = 0, now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const date = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() + offsetDays));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function parseIsoDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return undefined;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function isoFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function weekdaySunday0(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1 };
}

function parseDatetimePicker(value: unknown): ChatDatetimePicker | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const picker = value as Record<string, unknown>;
  if (picker.type !== 'datetime') return undefined;
  if (typeof picker.min !== 'string' || typeof picker.max !== 'string' || typeof picker.prefix !== 'string') {
    return undefined;
  }
  if (!parseIsoDay(picker.min) || !parseIsoDay(picker.max) || !picker.prefix.trim()) return undefined;
  return { type: 'datetime', min: picker.min, max: picker.max, prefix: picker.prefix };
}

const calendarWeekdays = ['日', '月', '火', '水', '木', '金', '土'];

function orinyanOpeningMessage(now = new Date()) {
  const monthlyGreetings = orinyanMonthlyGreetings[japanCalendarMonth(now)] || orinyanMonthlyGreetings[0];
  const greeting = monthlyGreetings[Math.floor(Math.random() * monthlyGreetings.length)];
  return `${greeting}\nあなたに会えて、とってもうれしいにゃん。`;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  rawContent?: string;
  sources?: Source[];
  choices?: ChatChoice[];
  lineLink?: boolean;
  pending?: boolean;
  moreResults?: boolean;
  followUp?: boolean;
  picker?: ChatDatetimePicker;
}

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window { turnstile?: TurnstileApi; }
}

const scriptSource = (document.currentScript as HTMLScriptElement | null)?.src;
const defaultAssetUrl = scriptSource ? new URL('assets/orinyan-states.png', scriptSource).href : '/assets/orinyan-states.png';
const officialPropertyHosts = new Set([
  'orijyu.com',
  'www.orijyu.com',
  'orichin.com',
  'www.orichin.com',
  'origumi.jp',
  'www.origumi.jp',
  'oriho.com',
  'www.oriho.com',
]);
const propertySections = new Set(['buy', 'rent', 'pri2', 'property', 'house']);
// Keep this aligned with the Worker source-link policy. A grounded property
// answer can identify a listing by price or address before the model repeats
// its full title, and that answer must still expose the approved detail link.
const propertyDetailInAnswer = /(?:販売価格|物件価格|賃料|家賃|所在地)\s*(?:[：:]|は|\d)|\d+(?:\.\d+)?\s*万円/u;

const template = document.createElement('template');
template.innerHTML = `
  <style></style>
  <div class="root">
    <section class="panel" role="dialog" aria-labelledby="orient-chat-title" aria-modal="false" hidden>
      <header class="panel-header">
        <div class="cat cat-avatar" data-cat-state="idle" aria-hidden="true"></div>
        <div class="header-copy">
          <h2 id="orient-chat-title">オリにゃんに相談</h2>
          <p><span class="online-dot"></span>オンライン</p>
        </div>
        <button class="icon-button minimize" type="button" aria-label="チャットを閉じる">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </header>
      <div class="messages" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="suggestions locked" aria-label="よくある質問">
        <button type="button" data-question="物件を探す" disabled title="はじめに性別と年代を選んでにゃん"><span>⌕</span>物件を探す</button>
        <button type="button" data-question="オリエントホームのこだわり" disabled title="はじめに性別と年代を選んでにゃん"><span>⌂</span>オリエントホームのこだわり</button>
      </div>
      <form class="composer">
        <label class="sr-only" for="orient-chat-input">メッセージを入力</label>
        <textarea id="orient-chat-input" rows="1" maxlength="2000" placeholder="はじめに性別と年代を選んでにゃん" disabled></textarea>
        <button class="send" type="submit" aria-label="送信" disabled>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11.5 17-8-6.5 17-2.8-6.2L3 11.5Z"/><path d="m10.7 14.3 4-4"/></svg>
        </button>
      </form>
      <p class="privacy">
        <a class="privacy-link" target="_blank" rel="noopener">プライバシーポリシー・免責事項</a>
      </p>
      <div class="escalation">
        <p><strong>最新情報は公式LINEへ</strong><span>友だち追加して物件・住まい情報をチェック</span></p>
        <div>
          <a class="line-link" target="_blank" rel="noopener">公式LINEを開く ↗</a>
          <a class="contact-link" target="_blank" rel="noopener noreferrer">問い合わせフォームはこちら</a>
        </div>
      </div>
      <div class="turnstile-slot" aria-hidden="true"></div>
    </section>
    <button class="launcher" type="button" aria-label="おりにゃんに相談にゃ！" aria-expanded="false">
      <span class="launcher-scene" aria-hidden="true">
        <span class="launcher-ring"></span>
        <span class="launcher-character"><span class="cat cat-launcher" data-cat-state="idle"></span></span>
      </span>
      <span class="launcher-label">おりにゃんに相談にゃ！</span>
    </button>
  </div>
`;

const styles = `
  :host {
    --orient-primary: #ff680b;
    --orient-primary-strong: #fd680a;
    --orient-ink: #29293a;
    --orient-muted: #74757f;
    --orient-border: #e8e9ee;
    --orient-soft: #f6f6f6;
    --orient-success: #20b866;
    --orient-line: #06c755;
    --orient-asset: url("${defaultAssetUrl}");
    position: fixed;
    inset: auto 20px 18px auto;
    z-index: 2147483000;
    color: var(--orient-ink);
    font-family: "Noto Sans JP", "Yu Gothic", "Hiragino Kaku Gothic ProN", system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    text-rendering: optimizeLegibility;
  }
  *, *::before, *::after { box-sizing: border-box; }
  button, textarea, a { font: inherit; }
  button, a { -webkit-tap-highlight-color: transparent; }
  button { color: inherit; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  .root { display: grid; justify-items: end; gap: 12px; }
  .panel {
    width: min(420px, calc(100vw - 28px));
    height: min(720px, calc(100vh - 118px));
    min-height: 520px;
    display: grid;
    grid-template-rows: auto minmax(160px, 1fr) auto auto auto auto;
    overflow: hidden;
    background: #fff;
    border: 1px solid var(--orient-border);
    border-radius: 18px;
    box-shadow: 0 22px 65px rgba(41, 41, 58, .2), 0 4px 16px rgba(41, 41, 58, .08);
    transform-origin: bottom right;
    animation: panel-in 220ms cubic-bezier(.2,.8,.2,1) both;
    position: relative;
  }
  .panel[hidden] { display: none; }
  .panel-header {
    min-height: 84px;
    display: grid;
    grid-template-columns: 54px 1fr 42px;
    align-items: center;
    gap: 10px;
    padding: 13px 15px;
    color: #fff;
    background: var(--orient-primary);
  }
  .header-copy h2 { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: .02em; }
  .header-copy p { margin: 1px 0 0; font-size: 12px; font-weight: 700; }
  .online-dot { display: inline-block; width: 9px; height: 9px; margin-right: 7px; border-radius: 50%; background: var(--orient-success); box-shadow: 0 0 0 3px rgba(255,255,255,.2); }
  .icon-button { width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 10px; color: #fff; background: transparent; cursor: pointer; }
  .icon-button:hover, .icon-button:focus-visible { background: rgba(255,255,255,.18); outline: none; }
  .icon-button svg { width: 25px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .messages { overflow: auto; overscroll-behavior: contain; padding: 20px 18px 12px; scrollbar-width: thin; scrollbar-color: #c7c8d0 transparent; }
  .message { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 9px; margin-bottom: 15px; animation: message-in 180ms ease-out both; }
  .message.user { grid-template-columns: minmax(0, 1fr); justify-items: end; padding-left: 40px; }
  .message .cat { width: 38px; height: 38px; border: 1px solid var(--orient-border); border-radius: 50%; background-color: #fff; }
  .bubble { max-width: 100%; padding: 11px 13px; color: var(--orient-ink); background: var(--orient-soft); border-radius: 5px 14px 14px 14px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .user .bubble { color: #3c2a20; background: #fff0e8; border-radius: 14px 5px 14px 14px; }
  .message-content { min-width: 0; max-width: 100%; }
  .user .message-content { justify-self: end; }
  .inline-source { display: inline-flex; align-items: center; margin: 3px 0 3px 5px; padding: 3px 8px; color: var(--orient-primary-strong); border: 1px solid #ffb98d; border-radius: 999px; background: #fffaf7; font-size: 10px; font-weight: 800; line-height: 1.5; text-decoration: none; vertical-align: middle; white-space: nowrap; }
  .inline-source:hover, .inline-source:focus-visible { border-color: var(--orient-primary); background: #fff1e8; outline: 2px solid rgba(255,104,11,.18); outline-offset: 1px; }
  .answer-url { color: var(--orient-primary-strong); font-weight: 700; text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 2px; overflow-wrap: anywhere; word-break: break-all; }
  .answer-url:hover, .answer-url:focus-visible { color: var(--orient-primary); outline: 2px solid rgba(255,104,11,.18); outline-offset: 1px; }
  .message-line-link { display: inline-block; margin-top: 7px; color: #237a46; font-size: 11px; font-weight: 700; line-height: 1.5; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
  .message-line-link:hover, .message-line-link:focus-visible { color: #05ae4a; outline: 2px solid rgba(6,199,85,.16); outline-offset: 2px; }
  .more-results { margin-top: 9px; }
  .more-results-button { min-height: 36px; padding: 7px 14px; border: 1px solid #ffc49f; border-radius: 999px; color: var(--orient-primary-strong); background: #fffaf7; font-size: 12px; font-weight: 800; cursor: pointer; transition: transform 120ms ease, border-color 120ms ease, background 120ms ease; }
  .more-results-button:hover, .more-results-button:focus-visible { transform: translateY(-1px); border-color: var(--orient-primary); background: #ffede2; outline: 2px solid rgba(255,104,11,.2); outline-offset: 1px; }
  .more-results-button:active { transform: translateY(0); }
  .more-results-button:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .thinking-label { display: inline-flex; align-items: center; min-height: 24px; color: var(--orient-muted); font-size: 12px; font-weight: 700; letter-spacing: .01em; }
  .thinking-chars { display: inline-flex; }
  .thinking-char {
    display: inline-block;
    animation: thinking-wave 1.15s ease-in-out infinite;
    will-change: transform, color;
  }
  .thinking-dots {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 6px;
    height: 12px;
  }
  .thinking-dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--orient-primary);
    animation: thinking-dot .9s ease-in-out infinite;
  }
  .thinking-dots span:nth-child(2) { animation-delay: .12s; }
  .thinking-dots span:nth-child(3) { animation-delay: .24s; }
  .message-choices { margin-top: 9px; animation: choices-in 180ms ease-out both; }
  .choice-label { margin: 0 0 6px; color: var(--orient-muted); font-size: 10px; font-weight: 700; letter-spacing: .03em; }
  .choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .choice-grid[data-count="3"], .choice-grid[data-count="6"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .choice-grid[data-count="1"] { grid-template-columns: minmax(0, 1fr); }
  .choice-button { min-width: 0; min-height: 40px; padding: 8px 9px; border: 1px solid #ffc49f; border-radius: 10px; color: #5a3522; background: #fffaf7; font-size: 12px; font-weight: 800; line-height: 1.35; overflow-wrap: anywhere; cursor: pointer; transition: transform 120ms ease, border-color 120ms ease, background 120ms ease; }
  .choice-button[data-tone="primary"] { border-color: var(--orient-primary); color: var(--orient-primary-strong); background: #fff3eb; }
  .choice-button:hover, .choice-button:focus-visible { transform: translateY(-1px); border-color: var(--orient-primary); background: #ffede2; outline: 2px solid rgba(255,104,11,.2); outline-offset: 1px; }
  .choice-button:active { transform: translateY(0); }
  .choice-button:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .choice-button:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .choice-grid[data-count="3"] .choice-button:last-child:nth-child(odd),
  .choice-grid[data-count="6"] .choice-button:last-child:nth-child(odd) { grid-column: auto; }
  .choice-compact { display: flex; justify-content: center; margin-top: 8px; }
  .choice-grid + .choice-compact { margin-top: 8px; }
  .choice-button.compact {
    min-height: 28px;
    padding: 4px 12px;
    border-color: #e0e1e6;
    border-radius: 999px;
    color: var(--orient-muted);
    background: #fff;
    font-size: 11px;
    font-weight: 700;
  }
  .choice-button.compact:hover, .choice-button.compact:focus-visible {
    color: var(--orient-ink);
    border-color: #c9cad1;
    background: #f6f6f8;
  }
  .message-picker { margin-top: 8px; animation: choices-in 180ms ease-out both; }
  .oc-picker-datetime {
    padding: 10px;
    border: 1px solid var(--orient-border);
    border-radius: 12px;
    background: #fff;
  }
  .oc-cal-nav {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
  }
  .oc-cal-nav button {
    min-width: 44px;
    min-height: 44px;
    border: 0;
    border-radius: 10px;
    color: var(--orient-primary-strong);
    background: #fff5ef;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    touch-action: manipulation;
  }
  .oc-cal-nav button:hover, .oc-cal-nav button:focus-visible { background: #ffede2; outline: 2px solid rgba(255,104,11,.2); outline-offset: 1px; }
  .oc-cal-nav button:disabled { opacity: .35; cursor: default; }
  .oc-cal-title { text-align: center; font-size: 14px; font-weight: 800; }
  .oc-cal-weekdays, .oc-cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
  .oc-cal-weekdays span { padding: 4px 0; color: var(--orient-muted); font-size: 10px; font-weight: 700; text-align: center; }
  .oc-cal-weekdays span:first-child { color: #c45b5b; }
  .oc-cal-weekdays span:last-child { color: #4a6fa5; }
  .oc-cal-day {
    min-height: 40px;
    border: 0;
    border-radius: 8px;
    color: var(--orient-ink);
    background: transparent;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
  }
  .oc-cal-day:hover:not(:disabled), .oc-cal-day:focus-visible:not(:disabled) { background: #fff5ef; outline: 2px solid rgba(255,104,11,.18); outline-offset: 0; }
  .oc-cal-day:disabled { color: #d0d1d7; cursor: default; }
  .oc-cal-day[data-selected="true"] { color: #fff; background: var(--orient-primary); }
  .oc-cal-day[data-selected="true"]:hover:not(:disabled), .oc-cal-day[data-selected="true"]:focus-visible:not(:disabled) { background: var(--orient-primary-strong); }
  .oc-cal-summary { margin: 8px 0 0; color: var(--orient-ink); font-size: 12px; font-weight: 800; text-align: center; }
  .oc-cal-time-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    margin-top: 10px;
  }
  .oc-cal-time-row span { font-size: 12px; font-weight: 800; }
  .oc-cal-time {
    width: 100%;
    min-height: 44px;
    padding: 8px 10px;
    border: 1px solid var(--orient-border);
    border-radius: 10px;
    color: var(--orient-ink);
    background: #fff;
    font-size: 16px;
  }
  .oc-cal-time:focus { border-color: var(--orient-primary); outline: 2px solid rgba(255,104,11,.18); }
  .oc-cal-submit {
    width: 100%;
    min-height: 44px;
    margin-top: 10px;
    border: 0;
    border-radius: 10px;
    color: #fff;
    background: var(--orient-primary);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    touch-action: manipulation;
  }
  .oc-cal-submit:hover, .oc-cal-submit:focus-visible { background: var(--orient-primary-strong); outline: 2px solid rgba(255,104,11,.2); outline-offset: 1px; }
  .oc-cal-submit:disabled { opacity: .45; cursor: not-allowed; }
  .suggestions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; padding: 9px 14px 11px; border-top: 1px solid var(--orient-border); overflow: visible; }
  .composer.locked { opacity: .55; }
  .suggestions button { position: relative; min-width: 0; min-height: 42px; padding: 8px 6px; border: 1px solid var(--orient-primary); border-radius: 10px; background: #fff; font-size: 11px; font-weight: 700; cursor: pointer; transition: background 180ms ease, box-shadow 180ms ease; }
  .suggestions button span { display: block; color: var(--orient-primary); font-size: 17px; line-height: 1; }
  .suggestions button:hover, .suggestions button:focus-visible { background: #fff5ef; outline: 2px solid rgba(255,104,11,.25); outline-offset: 1px; }
  .suggestions button:disabled {
    color: #8d8e96;
    border-color: #d8d9df;
    background: #f3f3f5;
    cursor: not-allowed;
    filter: grayscale(1);
    opacity: .72;
  }
  .suggestions button:disabled span { color: #9a9ba3; }
  .suggestions button:disabled:hover, .suggestions button:disabled:focus-visible {
    background: #f3f3f5;
    outline: none;
    transform: none;
  }
  .suggestions button.ready-pop {
    z-index: 1;
    animation: suggestion-ready 1s cubic-bezier(.22,.8,.28,1) 3 both;
  }
  .suggestions button.ready-pop span {
    animation: suggestion-ready-icon .65s ease-in-out 3 both;
  }
  .suggestions button.ready-pop::after {
    content: "";
    position: absolute;
    inset: -3px;
    border-radius: 12px;
    border: 2px solid var(--orient-primary);
    pointer-events: none;
    animation: suggestion-ready-ring 1s ease-out 3 both;
  }
  .composer { display: grid; grid-template-columns: 1fr 44px; gap: 8px; margin: 0 14px; padding: 5px 5px 5px 13px; border: 2px solid var(--orient-primary); border-radius: 12px; background: #fff; }
  .composer:focus-within { box-shadow: 0 0 0 3px rgba(255,104,11,.15); }
  textarea { width: 100%; max-height: 92px; resize: none; padding: 8px 0; border: 0; outline: 0; color: var(--orient-ink); background: transparent; line-height: 1.5; }
  textarea::placeholder { color: #a7a8b0; }
  .send { width: 42px; height: 42px; display: grid; place-items: center; align-self: end; border: 0; border-radius: 9px; color: #fff; background: var(--orient-primary); cursor: pointer; }
  .send:disabled { opacity: .45; cursor: not-allowed; }
  .send svg { width: 24px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .privacy { margin: 7px 18px 10px; color: var(--orient-muted); font-size: 10px; }
  .privacy::before { content: "▣"; margin-right: 5px; }
  .privacy-link { color: var(--orient-ink); font-weight: 700; text-decoration: underline; text-decoration-color: var(--orient-primary); text-underline-offset: 2px; }
  .privacy-link:hover, .privacy-link:focus-visible { color: var(--orient-primary-strong); outline: none; }
  .escalation { padding: 10px 14px 14px; border-top: 1px solid var(--orient-border); }
  .escalation p { margin: 0 0 9px; text-align: center; color: var(--orient-muted); font-size: 10px; line-height: 1.45; }
  .escalation p strong { display: block; margin-bottom: 2px; color: var(--orient-ink); font-size: 12px; }
  .escalation p span { display: block; }
  .escalation > div { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .line-link { min-height: 40px; display: grid; place-items: center; color: #fff; border: 1px solid var(--orient-line); border-radius: 9px; background: var(--orient-line); font-size: 12px; font-weight: 800; text-decoration: none; cursor: pointer; }
  .line-link:hover, .line-link:focus-visible { color: #fff; border-color: #05ae4a; background: #05ae4a; outline: 2px solid rgba(6,199,85,.2); outline-offset: 1px; }
  .escalation .contact-link { justify-self: center; color: var(--orient-muted); font-size: 10px; font-weight: 600; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
  .escalation .contact-link:hover, .escalation .contact-link:focus-visible { color: var(--orient-ink); outline: none; }
  .turnstile-slot { position: absolute; left: 12px; bottom: 12px; z-index: 8; }
  .cat { background-image: var(--orient-asset); background-repeat: no-repeat; background-size: 200% 200%; background-position: 0 0; }
  .cat[data-cat-state="listening"] { background-position: 100% 0; }
  .cat[data-cat-state="speaking"] { background-position: 0 100%; }
  .cat[data-cat-state="thinking"] { background-position: 100% 100%; }
  .cat-avatar { width: 52px; height: 52px; border: 3px solid rgba(255,255,255,.88); border-radius: 50%; background-color: #fff; }
  .launcher { width: 208px; height: 98px; position: relative; overflow: visible; border: 0; background: transparent; cursor: pointer; }
  .launcher-scene { position: absolute; inset: 0; }
  .launcher-ring { width: 180px; height: 180px; position: absolute; right: -98px; bottom: -108px; z-index: 1; display: block; border: 4px solid #fff; border-radius: 50%; background: var(--orient-primary); box-shadow: 0 0 0 1px rgba(255,104,11,.08), 0 10px 24px rgba(41,41,58,.18); }
  .launcher-character { width: 88px; height: 88px; position: absolute; right: -20px; bottom: -28px; z-index: 2; filter: drop-shadow(0 5px 5px rgba(41,41,58,.2)); transform-origin: 52% 92%; animation: launcher-peek 3.6s cubic-bezier(.45,0,.25,1) infinite; will-change: transform; }
  .cat-launcher { width: 100%; height: 100%; display: block; }
  .launcher-label { min-height: 32px; position: absolute; right: 56px; bottom: 2px; z-index: 3; display: inline-flex; align-items: center; padding: 7px 12px; color: #fff; border: 1px solid rgba(255,255,255,.2); border-radius: 999px; background: var(--orient-ink); box-shadow: 0 7px 16px rgba(41,41,58,.22); font-size: 11px; font-weight: 800; line-height: 1; letter-spacing: .01em; white-space: nowrap; transition: transform 180ms ease, background 180ms ease, box-shadow 180ms ease; }
  .launcher-label::after { content: ""; width: 0; height: 0; position: absolute; right: -8px; bottom: 8px; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 9px solid var(--orient-ink); transition: border-left-color 180ms ease; }
  .launcher:hover .launcher-character, .launcher:focus-visible .launcher-character { animation: launcher-greet .72s cubic-bezier(.2,.8,.2,1) both; }
  .launcher:hover .cat-launcher, .launcher:focus-visible .cat-launcher { background-position: 0 100%; }
  .launcher:hover .launcher-label { transform: translateX(-3px); background: #20202f; box-shadow: 0 9px 20px rgba(41,41,58,.26); }
  .launcher:hover .launcher-label::after { border-left-color: #20202f; }
  .launcher:focus-visible { outline: none; }
  .launcher:focus-visible .launcher-label { box-shadow: 0 0 0 4px rgba(255,104,11,.26), 0 7px 16px rgba(41,41,58,.22); }
  .launcher[aria-expanded="true"] { display: none; }
  .cat[data-cat-state="listening"] { animation: listen 1.4s ease-in-out infinite; }
  .cat[data-cat-state="speaking"] { animation: speak .42s ease-in-out infinite alternate; }
  .cat[data-cat-state="thinking"] { animation: think 1.5s ease-in-out infinite; }
  @keyframes panel-in { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }
  @keyframes message-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes choices-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes launcher-peek { 0%,100% { transform: translateY(3px) rotate(-1.4deg); } 42% { transform: translateY(-4px) rotate(.8deg); } 62% { transform: translateY(-2px) rotate(-.4deg); } }
  @keyframes launcher-greet { 0% { transform: translateY(2px) rotate(0); } 30% { transform: translateY(2px) rotate(5deg); } 58% { transform: translateY(2px) rotate(-4deg); } 78% { transform: translateY(2px) rotate(3deg); } 100% { transform: translateY(2px) rotate(0); } }
  @keyframes listen { 0%,100% { transform: rotate(0); } 50% { transform: rotate(2deg); } }
  @keyframes speak { from { transform: translateY(0); } to { transform: translateY(-2px); } }
  @keyframes think { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px) rotate(-1deg); } }
  @keyframes thinking-wave {
    0%, 62%, 100% { transform: translateY(0); color: var(--orient-muted); }
    31% { transform: translateY(-5px); color: var(--orient-ink); }
  }
  @keyframes thinking-dot {
    0%, 70%, 100% { transform: translateY(0) scale(1); opacity: .35; }
    40% { transform: translateY(-5px) scale(1.15); opacity: 1; }
  }
  @keyframes suggestion-ready {
    0% { transform: scale(1); background: #fff; box-shadow: 0 0 0 0 rgba(255,104,11,0); }
    28% { transform: scale(1.1); background: #fff3eb; box-shadow: 0 10px 22px rgba(255,104,11,.28), 0 0 0 7px rgba(255,104,11,.22); }
    55% { transform: scale(0.96); }
    100% { transform: scale(1); background: #fff; box-shadow: 0 0 0 0 rgba(255,104,11,0); }
  }
  @keyframes suggestion-ready-icon {
    0%, 100% { transform: scale(1) rotate(0); }
    40% { transform: scale(1.35) rotate(-12deg); }
    70% { transform: scale(1.1) rotate(8deg); }
  }
  @keyframes suggestion-ready-ring {
    0% { opacity: .95; transform: scale(1); }
    100% { opacity: 0; transform: scale(1.16); }
  }
  @keyframes thinking-fade {
    0%, 100% { opacity: .55; transform: none; }
    50% { opacity: 1; transform: none; }
  }
  @keyframes thinking-dot-fade {
    0%, 100% { opacity: .3; transform: none; }
    50% { opacity: 1; transform: none; }
  }
  @keyframes suggestion-ready-glow {
    0%, 100% { background: #fff; box-shadow: 0 0 0 0 rgba(255,104,11,0); transform: none; }
    40% { background: #fff3eb; box-shadow: 0 0 0 5px rgba(255,104,11,.32); transform: none; }
  }
  @media (max-width: 520px) {
    :host { inset: auto 10px 10px 10px; }
    .root { width: 100%; }
    .panel { width: 100%; height: min(690px, calc(100dvh - 24px)); min-height: 480px; border-radius: 16px; }
    .launcher { width: 202px; height: 94px; }
    .launcher-ring { width: 180px; height: 180px; right: -88px; bottom: -100px; }
    .launcher-character { width: 84px; height: 84px; right: -10px; bottom: -20px; }
    .launcher-label { right: 64px; bottom: 10px; }
    .suggestions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .suggestions button { font-size: 10px; }
    .choice-grid[data-count="3"] { gap: 5px; }
    .choice-grid[data-count="6"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .choice-button { min-height: 42px; padding-inline: 6px; font-size: 12px; }
    .choice-button.compact { min-height: 28px; padding: 4px 12px; font-size: 11px; }
    .oc-cal-day { min-height: 42px; }
    .oc-picker-datetime { padding: 8px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .panel, .message, .message-choices, .message-picker, .launcher-character, .cat { animation: none !important; }
    .thinking-char { animation: thinking-fade 1.2s ease-in-out infinite; }
    .thinking-dots span { animation: thinking-dot-fade .9s ease-in-out infinite; }
    .suggestions button.ready-pop { animation: suggestion-ready-glow 1s ease-in-out 3 both; }
    .suggestions button.ready-pop span, .suggestions button.ready-pop::after { animation: none; }
  }
`;

class OrientChat extends HTMLElement {
  private readonly root: ShadowRoot;
  private messages: ChatMessage[] = [];
  private conversationId = '';
  private sessionToken = '';
  private catState: CatState = 'idle';
  private sending = false;
  private initialized = false;
  private visitorGender: VisitorGender | '' = '';
  private visitorAgeDecade: VisitorAgeDecade | '' = '';
  private turnstileWidgetId = '';
  private turnstilePromise: Promise<string> | null = null;

  static get observedAttributes() { return ['open']; }

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.root.append(template.content.cloneNode(true));
    const style = this.root.querySelector('style');
    if (style) style.textContent = styles;
  }

  connectedCallback() {
    this.applyConfiguration();
    void this.recordPropertyPageView();
    if (!this.initialized) {
      this.initialized = true;
      // Visible chat history is intentionally in-memory only. Discard legacy
      // stored credentials so a page reload cannot resume hidden server state.
      this.clearStoredSession();
      this.bindEvents();
      this.messages = [
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: orinyanOpeningMessage(),
        },
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'まずはあなたのことを知りたいにゃん。\n性別を教えてにゃん。',
          choices: visitorGenderChoices,
        },
      ];
      this.renderMessages();
      this.syncComposerLock();
    }
    if (this.hasAttribute('open')) this.open();
  }

  attributeChangedCallback(name: string) {
    if (!this.isConnected || name !== 'open') return;
    if (this.hasAttribute('open')) this.open(); else this.close();
  }

  private get apiUrl() { return (this.getAttribute('api-url') || '').replace(/\/$/, ''); }
  private get demoMode() { return this.getAttribute('demo-mode') === 'true' || !this.apiUrl; }
  private get lineUrl() { return this.getAttribute('line-url') || 'https://page.line.me/089wmudt'; }

  private async recordPropertyPageView() {
    if (this.demoMode) return;
    const page = new URL(location.href);
    const hostname = page.hostname.toLowerCase().replace(/^www\./u, '');
    if (page.protocol !== 'https:' || hostname !== 'orijyu.com') return;
    if (!/^\/(?:[^/]+\/)?post-\d+(?:-\d+)?\.html$/u.test(page.pathname)) return;
    page.search = '';
    page.hash = '';
    const day = new Date(Date.now() + 9 * 60 * 60 * 1_000).toISOString().slice(0, 10);
    const storageKey = `orient-chat.property-view.v1:${day}:${page.pathname}`;
    try {
      if (window.localStorage.getItem(storageKey)) return;
      const response = await this.fetchWithTimeout(`${this.apiUrl}/api/property-view`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourcePage: page.toString() }),
        keepalive: true,
      }, 5_000);
      if (response.ok) window.localStorage.setItem(storageKey, '1');
    } catch {
      // Analytics must never block the chat widget.
    }
  }

  private get sessionStorageKey() {
    try {
      return `orient-chat.session.v1:${new URL(this.apiUrl).origin}`;
    } catch {
      return '';
    }
  }

  private clearStoredSession() {
    const key = this.sessionStorageKey;
    this.conversationId = '';
    this.sessionToken = '';
    if (!key) return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Nothing to clear when browser storage is unavailable.
    }
  }

  private applyConfiguration() {
    const appearance = {
      '--orient-primary': this.getAttribute('primary-color'),
      '--orient-ink': this.getAttribute('ink-color'),
      '--orient-asset': this.getAttribute('character-src') ? `url("${this.getAttribute('character-src')}")` : null,
    };
    for (const [key, value] of Object.entries(appearance)) if (value) this.style.setProperty(key, value);
    const line = this.root.querySelector<HTMLAnchorElement>('.line-link');
    const contact = this.root.querySelector<HTMLAnchorElement>('.contact-link');
    const privacy = this.root.querySelector<HTMLAnchorElement>('.privacy-link');
    if (line) line.href = this.lineUrl;
    if (contact) contact.href = this.getAttribute('contact-url') || 'https://orijyu.com/reception.html';
    if (privacy) {
      privacy.href = this.getAttribute('privacy-policy-url')
        || `${this.apiUrl}/documents/orient-ai-chat-privacy-policy.pdf`;
    }
  }

  private bindEvents() {
    this.root.querySelector('.launcher')?.addEventListener('click', () => this.open());
    this.root.querySelector('.minimize')?.addEventListener('click', () => this.close());
    this.root.querySelectorAll<HTMLButtonElement>('[data-question]').forEach((button) => {
      button.addEventListener('click', () => this.sendMessage(button.dataset.question || ''));
    });
    const form = this.root.querySelector<HTMLFormElement>('.composer');
    const input = this.root.querySelector<HTMLTextAreaElement>('textarea');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!this.profileReady) return;
      const value = input?.value.trim() || '';
      if (value) void this.sendMessage(value);
    });
    input?.addEventListener('focus', () => this.setCatState('listening'));
    input?.addEventListener('blur', () => { if (!this.sending) this.setCatState('idle'); });
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 92)}px`;
    });
    input?.addEventListener('keydown', (event) => {
      // Pressing Enter confirms a Japanese IME conversion before it means
      // "send".  Submitting while composition is active cuts off the last
      // word and is especially easy to trigger on mobile keyboards.
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form?.requestSubmit();
      }
    });
  }

  private open() {
    const panel = this.root.querySelector<HTMLElement>('.panel');
    const launcher = this.root.querySelector<HTMLButtonElement>('.launcher');
    if (panel) panel.hidden = false;
    launcher?.setAttribute('aria-expanded', 'true');
    if (!this.hasAttribute('open')) this.setAttribute('open', '');
    window.setTimeout(() => this.root.querySelector<HTMLTextAreaElement>('textarea')?.focus(), 180);
  }

  private close() {
    const panel = this.root.querySelector<HTMLElement>('.panel');
    const launcher = this.root.querySelector<HTMLButtonElement>('.launcher');
    if (panel) panel.hidden = true;
    launcher?.setAttribute('aria-expanded', 'false');
    if (this.hasAttribute('open')) this.removeAttribute('open');
    this.setCatState('idle');
  }

  private setCatState(state: CatState) {
    this.catState = state;
    this.root.querySelectorAll<HTMLElement>('[data-cat-state]').forEach((cat) => { cat.dataset.catState = state; });
  }

  private get profileReady() {
    return Boolean(this.visitorGender && this.visitorAgeDecade);
  }

  private syncComposerLock() {
    const ready = this.profileReady;
    const suggestions = this.root.querySelector<HTMLElement>('.suggestions');
    const composer = this.root.querySelector<HTMLElement>('.composer');
    const input = this.root.querySelector<HTMLTextAreaElement>('textarea');
    const send = this.root.querySelector<HTMLButtonElement>('.send');
    if (suggestions) {
      const wasLocked = suggestions.classList.contains('locked');
      suggestions.hidden = false;
      suggestions.classList.toggle('locked', !ready);
      suggestions.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        button.disabled = !ready || this.sending;
        if (ready) button.removeAttribute('title');
        else button.title = 'はじめに性別と年代を選んでにゃん';
      });
      if (ready && wasLocked && !this.sending) this.playSearchReadyAnimation(suggestions);
    }
    composer?.classList.toggle('locked', !ready);
    if (input) {
      input.disabled = !ready || this.sending;
      input.placeholder = ready ? 'メッセージを入力' : 'はじめに性別と年代を選んでにゃん';
    }
    if (send && !this.sending) send.disabled = !ready;
  }

  private playSearchReadyAnimation(suggestions: HTMLElement) {
    const search = suggestions.querySelector<HTMLButtonElement>('button[data-question="物件を探す"]');
    if (!search) return;
    search.classList.remove('ready-pop');
    void search.offsetWidth;
    search.classList.add('ready-pop');
    const finish = (event: AnimationEvent) => {
      if (event.target !== search || event.animationName !== 'suggestion-ready') return;
      search.classList.remove('ready-pop');
      search.removeEventListener('animationend', finish);
    };
    search.addEventListener('animationend', finish);
  }

  private selectVisitorProfile(value: string) {
    if (this.profileReady || this.sending) return;
    if (!this.visitorGender) {
      if (!isVisitorGender(value)) return;
      this.visitorGender = value;
      this.messages = this.messages.map((message) => ({ ...message, choices: [] }));
      this.messages.push({ id: crypto.randomUUID(), role: 'user', content: visitorGenderLabels[value] });
      this.messages.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'ありがとう！つづいて年代を教えてにゃん。',
        choices: visitorAgeChoices,
      });
      this.renderMessages();
      return;
    }
    if (!isVisitorAgeDecade(value)) return;
    this.visitorAgeDecade = value;
    this.messages = this.messages.map((message) => ({ ...message, choices: [] }));
    this.messages.push({ id: crypto.randomUUID(), role: 'user', content: visitorAgeLabels[value] });
    this.messages.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'ありがとうにゃん！\n住まいやお部屋探しのこと、気軽に聞いてにゃん。',
    });
    this.renderMessages();
    this.syncComposerLock();
  }

  private async ensureSession() {
    if (this.demoMode || this.conversationId) return;
    if (!this.profileReady) throw new Error('はじめに性別と年代を選んでにゃん。');
    const turnstileToken = await this.getTurnstileToken();
    let response: Response;
    try {
      response = await this.fetchWithTimeout(`${this.apiUrl}/api/chat/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourcePage: location.href,
          turnstileToken,
          visitorGender: this.visitorGender,
          visitorAgeDecade: this.visitorAgeDecade,
        }),
      }, 15_000);
    } catch (error) {
      this.disposeTurnstileWidget();
      throw error;
    }
    if (!response.ok) {
      this.disposeTurnstileWidget();
      throw new Error('セッションを開始できませんでした。もう一度お試しください。');
    }
    const data = await this.readJsonResponse<{ conversationId?: string; sessionToken?: string }>(response);
    if (!data.conversationId || !data.sessionToken) {
      this.disposeTurnstileWidget();
      throw new Error('セッション情報を確認できませんでした。もう一度お試しください。');
    }
    this.conversationId = data.conversationId;
    this.sessionToken = data.sessionToken;
    // Turnstile tokens are single-use.  Remove the completed widget so a
    // future expired chat session always starts with a fresh challenge.
    this.disposeTurnstileWidget();
  }

  private disposeTurnstileWidget() {
    const widgetId = this.turnstileWidgetId;
    this.turnstileWidgetId = '';
    this.turnstilePromise = null;
    if (widgetId && window.turnstile) {
      try {
        window.turnstile.remove(widgetId);
      } catch {
        // The provider may already have removed an expired widget.
      }
    }
    this.root.querySelector<HTMLElement>('.turnstile-slot')?.replaceChildren();
  }

  private async getTurnstileToken() {
    if (this.demoMode) return '';
    const sitekey = this.getAttribute('turnstile-site-key');
    if (!sitekey) throw new Error('セキュリティ設定が未完了です。サイト管理者へお問い合わせください。');
    if (this.turnstilePromise) return this.turnstilePromise;

    this.turnstilePromise = new Promise<string>((resolve, reject) => {
      const startedAt = Date.now();
      let settled = false;
      const finish = (token: string) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(challengeTimeout);
        resolve(token);
      };
      const failWith = (message: string) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(challengeTimeout);
        this.disposeTurnstileWidget();
        reject(new Error(message));
      };
      const challengeTimeout = window.setTimeout(() => {
        failWith('セキュリティ確認に時間がかかっています。ページを再読み込みして、もう一度お試しください。');
      }, 15_000);
      const waitForApi = () => {
        const api = window.turnstile;
        const container = this.root.querySelector<HTMLElement>('.turnstile-slot');
        if (!api || !container) {
          if (Date.now() - startedAt > 12_000) {
            failWith('セキュリティ確認を開始できませんでした。ページを再読み込みしてください。');
            return;
          }
          window.setTimeout(waitForApi, 100);
          return;
        }

        const fail = () => failWith('セキュリティ確認に失敗しました。もう一度お試しください。');
        try {
          this.turnstileWidgetId = api.render(container, {
            sitekey,
            action: 'chat_session',
            execution: 'execute',
            appearance: 'interaction-only',
            callback: finish,
            'error-callback': fail,
            'expired-callback': fail,
            'timeout-callback': fail,
          });
          api.execute(this.turnstileWidgetId);
        } catch {
          failWith('セキュリティ確認を開始できませんでした。ページを再読み込みしてください。');
        }
      };
      waitForApi();
    });
    return this.turnstilePromise;
  }

  private async sendMessage(content: string) {
    if (this.sending || !this.profileReady) return;
    this.sending = true;
    // Only the latest answer can remain actionable.  Older guided-search and
    // pagination controls would otherwise let a visitor submit stale choices
    // while a newer turn is in progress.
    this.messages.forEach((message) => {
      message.choices = [];
      message.moreResults = false;
      message.picker = undefined;
    });
    this.root.querySelectorAll('.message-choices, .more-results, .message-picker').forEach((element) => element.remove());
    const userMessageId = crypto.randomUUID();
    this.messages.push({ id: userMessageId, role: 'user', content });
    const pendingId = crypto.randomUUID();
    this.messages.push({ id: pendingId, role: 'assistant', content: '', pending: true });
    const input = this.root.querySelector<HTMLTextAreaElement>('textarea');
    if (input) { input.value = ''; input.style.height = 'auto'; }
    this.setCatState('thinking');
    this.renderMessages();
    this.setDisabled(true);

    try {
      await this.ensureSession();
      const result = this.demoMode ? await this.demoResponse(content) : await this.remoteResponse(content, userMessageId);
      if (result.redactUserMessage) {
        const userMessage = this.messages.find((item) => item.id === userMessageId);
        if (userMessage) userMessage.content = '（連絡先を送信しました）';
      }
      const message = this.messages.find((item) => item.id === pendingId);
      const incomingChoices = result.choices;
      const incomingPicker = result.picker;
      const incomingMoreResults = this.shouldAttachMoreResults(
        typeof result.hasMoreResults === 'boolean'
          ? result.hasMoreResults
          : this.shouldShowMoreResults(result.answer),
        incomingChoices,
      );
      if (message) {
        message.pending = false;
        message.content = this.displayAnswer(result.answer).slice(0, 1);
        message.sources = result.sources;
        // Keep buttons off the DOM until typing finishes so they cannot be
        // tapped while this.sending is still true.
        message.choices = [];
        message.moreResults = false;
        message.picker = undefined;
        message.lineLink = result.followUp
          ? false
          : this.shouldShowLineLink(content, result.answer, result.choices, result.policy);
      }
      this.renderMessages();
      this.setDisabled(true);
      this.setCatState('speaking');
      await this.typeAnswer(pendingId, result.answer);
      if (message) {
        message.choices = incomingChoices;
        message.moreResults = incomingMoreResults;
        message.picker = incomingPicker;
      }
      const typedItem = Array.from(this.root.querySelectorAll<HTMLElement>('.message'))
        .find((candidate) => candidate.dataset.messageId === pendingId);
      if (typedItem) {
        this.renderChoices(typedItem, incomingChoices);
        this.renderPicker(typedItem, incomingPicker);
        this.renderMoreResults(typedItem, incomingMoreResults);
        this.setDisabled(true);
      }
      if (result.followUp?.answer) {
        const followUpId = crypto.randomUUID();
        this.messages.push({
          id: followUpId,
          role: 'assistant',
          content: '',
          pending: true,
          choices: [],
          moreResults: false,
          followUp: true,
        });
        this.renderMessages();
        this.setDisabled(true);
        const followUpMessage = this.messages.find((item) => item.id === followUpId);
        if (followUpMessage) {
          followUpMessage.pending = false;
          followUpMessage.content = this.displayAnswer(result.followUp.answer).slice(0, 1);
        }
        await this.typeAnswer(followUpId, result.followUp.answer);
        if (followUpMessage) followUpMessage.choices = result.followUp.choices || [];
        const followUpItem = Array.from(this.root.querySelectorAll<HTMLElement>('.message'))
          .find((candidate) => candidate.dataset.messageId === followUpId);
        if (followUpItem) {
          this.renderChoices(followUpItem, result.followUp.choices || []);
          this.setDisabled(true);
        }
      }
    } catch (error) {
      const expired = error instanceof Error && error.message.includes('有効期限');
      if (expired) {
        this.messages = this.messages.filter((item) => item.id === userMessageId || item.id === pendingId);
      }
      const message = this.messages.find((item) => item.id === pendingId);
      if (message) {
        message.pending = false;
        message.content = error instanceof Error ? error.message : '通信に失敗しました。しばらくしてからお試しください。';
      }
      this.renderMessages();
    } finally {
      this.sending = false;
      this.setDisabled(false);
      this.setCatState('idle');
      input?.focus();
    }
  }

  private async remoteResponse(content: string, clientTurnId: string) {
    const response = await this.fetchWithTimeout(`${this.apiUrl}/api/chat/message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conversationId: this.conversationId,
        sessionToken: this.sessionToken,
        clientTurnId,
        message: content,
      }),
    }, 30_000);
    const data = await this.readJsonResponse<{
      answer?: string;
      sources?: Source[];
      choices?: ChatChoice[];
      policy?: string;
      error?: string;
      redactUserMessage?: boolean;
      hasMoreResults?: boolean;
      followUp?: ChatFollowUp;
      picker?: ChatDatetimePicker;
    }>(response);
    if (response.status === 401) {
      this.clearStoredSession();
      this.disposeTurnstileWidget();
      throw new Error('チャットの有効期限が切れました。もう一度送信してにゃん。');
    }
    if (!response.ok) throw new Error(data.error || '回答を取得できませんでした。もう一度お試しください。');
    if (typeof data.answer !== 'string' || data.answer.trim().length === 0) {
      throw new Error('回答データを確認できませんでした。もう一度お試しください。');
    }
    return {
      answer: data.answer,
      sources: Array.isArray(data.sources) ? data.sources : [],
      choices: Array.isArray(data.choices) ? data.choices : [],
      policy: typeof data.policy === 'string' ? data.policy : 'allow',
      redactUserMessage: data.redactUserMessage === true,
      hasMoreResults: typeof data.hasMoreResults === 'boolean' ? data.hasMoreResults : undefined,
      followUp: data.followUp && typeof data.followUp.answer === 'string' && data.followUp.answer.trim()
        ? {
          answer: data.followUp.answer,
          choices: Array.isArray(data.followUp.choices) ? data.followUp.choices : [],
        }
        : undefined,
      picker: parseDatetimePicker(data.picker),
    };
  }

  private async readJsonResponse<T extends object>(response: Response): Promise<Partial<T>> {
    try {
      const data = await response.json() as unknown;
      return data != null && typeof data === 'object' && !Array.isArray(data)
        ? data as Partial<T>
        : {};
    } catch {
      return {};
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('通信が混み合っています。少し時間をおいて、もう一度お試しください。');
      }
      throw new Error('通信に失敗しました。ネットワークを確認して、もう一度お試しください。');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private async demoResponse(content: string) {
    await new Promise((resolve) => window.setTimeout(resolve, 1800));
    if (/値引|価格交渉|法的|重要事項/u.test(content)) {
      return {
        answer: 'ごめんね、その内容はオリにゃんでは案内できないにゃん。お部屋探しや住まいのことを聞いてにゃん。',
        sources: [],
        choices: [] as ChatChoice[],
        policy: 'out_of_scope',
        redactUserMessage: false,
        hasMoreResults: false,
        followUp: undefined as ChatFollowUp | undefined,
        picker: undefined as ChatDatetimePicker | undefined,
      };
    }
    if (content.startsWith('見学希望日時:')) {
      return {
        answer: '見学のお申し込みだにゃん。お名前を教えてにゃん。',
        sources: [],
        choices: [],
        policy: 'allow',
        redactUserMessage: false,
        hasMoreResults: false,
        followUp: undefined,
        picker: undefined,
      };
    }
    if (content === '見学したい' || /(?:見学|内見)したい/u.test(content)) {
      return {
        answer: '見学の希望日時を、カレンダーから選んでにゃん。',
        sources: [],
        choices: [],
        policy: 'allow',
        redactUserMessage: false,
        hasMoreResults: false,
        followUp: undefined,
        picker: {
          type: 'datetime' as const,
          min: jstIsoDay(1),
          max: jstIsoDay(60),
          prefix: '見学希望日時:',
        },
      };
    }
    if (content === '物件を探す' || content === 'もっと見たい') {
      return {
        answer: '条件に合う賃貸物件が見つかったにゃん。\n- サンプルマンション 賃料 8.5万円にゃん。',
        sources: [],
        choices: [
          { label: 'もっと見る', value: 'もっと見たい', tone: 'primary' as const },
          { label: '別条件で探す', value: '物件を探す', size: 'compact' as const },
        ],
        policy: 'allow',
        redactUserMessage: false,
        hasMoreResults: false,
        followUp: {
          answer: '気に入った物件はあったかにゃ？資料請求・お電話・内見から選んでにゃん。',
          choices: [
            { label: '資料請求', value: '資料請求したい', tone: 'primary' as const },
            { label: '電話', value: '電話で相談したい' },
            { label: '見学', value: '見学したい' },
          ],
        },
        picker: undefined,
      };
    }
    return {
      answer: 'オリにゃんは、物件探し・住まい・店舗のことを案内できるにゃん。気になるエリアや条件を教えてね。[1]',
      sources: [{ index: 1, title: 'オリエントホールディングス 公式サイト', url: 'https://orijyu.com/' }],
      choices: [],
      policy: 'allow',
      redactUserMessage: false,
      hasMoreResults: false,
      followUp: undefined,
      picker: undefined,
    };
  }

  private shouldAttachMoreResults(hasMoreResults: boolean, choices: ChatChoice[]) {
    return hasMoreResults && !choices.some((choice) => choice.value === 'もっと見たい');
  }

  private shouldShowLineLink(input: string, answer: string, choices: ChatChoice[], policy: string) {
    if (/(?:out_of_scope|prompt_injection)/u.test(policy)) return false;
    if (/(?:あなた|君|きみ|オリにゃん).*(?:誰|だれ|何者)|^(?:おはよう|こんにちは|こんばんは|ありがとう)[。！!？?]?$/u.test(input.normalize('NFKC').trim())) return false;
    const isGuidedQuestion = choices.length > 0
      && /(?:教えてにゃん|選んでにゃん|どちらを探|のまま探すか)/u.test(answer);
    if (isGuidedQuestion) return false;
    return /(?:物件|住まい|賃貸|購入|戸建|マンション|土地|家づくり|住宅|店舗|テナント|内見|見学|空室|申込|売却|査定|担当者|専門家|確認できない|価格交渉|重要事項)/u.test(answer);
  }

  private shouldShowMoreResults(answer: string) {
    // Catalog responses are capped at three listings. Offer the next page only
    // when the current answer actually contains three property candidates.
    const candidateLines = this.displayAnswer(answer)
      .split(/\r?\n/u)
      .filter((line) => /^\s*-\s+.+(?:販売価格|物件価格|賃料|家賃).+にゃん。?\s*$/u.test(line));
    return candidateLines.length >= 3
      && /条件に合う.*(?:賃貸|購入物件).*(?:見つかった|候補)/u.test(answer);
  }

  private displayAnswer(answer: string) {
    return answer.replace(/\s*(?:\[\d+\]|【\d+】)/gu, '').trim();
  }

  private async typeAnswer(id: string, answer: string) {
    const message = this.messages.find((item) => item.id === id);
    if (!message) return;
    const displayAnswer = this.displayAnswer(answer);
    message.rawContent = answer;
    const item = Array.from(this.root.querySelectorAll<HTMLElement>('.message'))
      .find((candidate) => candidate.dataset.messageId === id);
    const bubble = item?.querySelector<HTMLElement>('.bubble');
    const container = this.root.querySelector<HTMLElement>('.messages');
    if (!bubble) {
      message.content = displayAnswer;
      this.renderMessages();
      return;
    }

    const initialContent = displayAnswer.startsWith(message.content) ? message.content : '';
    const textNode = document.createTextNode(initialContent);
    bubble.replaceChildren(textNode);
    const updateBubble = (content: string) => {
      const keepPinnedToBottom = container
        ? container.scrollHeight - container.scrollTop - container.clientHeight <= 32
        : false;
      message.content = content;
      textNode.data = content;
      if (container && keepPinnedToBottom) container.scrollTop = container.scrollHeight;
    };

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      updateBubble(displayAnswer);
      this.renderAnswerWithSources(bubble, answer, message.sources || []);
      if (item) {
        this.renderLineLink(item, Boolean(message.lineLink));
        this.renderChoices(item, message.choices || []);
        this.renderPicker(item, message.picker);
        this.renderMoreResults(item, this.shouldAttachMoreResults(Boolean(message.moreResults), message.choices || []));
      }
      return;
    }
    await new Promise<void>((resolve) => {
      const charactersPerSecond = 120;
      const minimumFrameInterval = 32;
      const startedAt = performance.now();
      let renderedLength = initialContent.length;
      let lastPaintAt = startedAt;
      const renderFrame = (now: number) => {
        const targetLength = Math.min(displayAnswer.length, Math.max(1, Math.floor(((now - startedAt) * charactersPerSecond) / 1000)));
        if (targetLength > renderedLength && (now - lastPaintAt >= minimumFrameInterval || targetLength === displayAnswer.length)) {
          renderedLength = targetLength;
          lastPaintAt = now;
          updateBubble(displayAnswer.slice(0, renderedLength));
        }
        if (renderedLength < displayAnswer.length) {
          window.requestAnimationFrame(renderFrame);
        } else {
          resolve();
        }
      };
      window.requestAnimationFrame(renderFrame);
    });
    this.renderAnswerWithSources(bubble, answer, message.sources || []);
    if (item) {
      this.renderLineLink(item, Boolean(message.lineLink));
      this.renderChoices(item, message.choices || []);
      this.renderPicker(item, message.picker);
      this.renderMoreResults(item, this.shouldAttachMoreResults(Boolean(message.moreResults), message.choices || []));
    }
  }

  private renderLineLink(item: HTMLElement, visible: boolean) {
    item.querySelector('.message-line-link')?.remove();
    if (!visible) return;
    const messageContent = item.querySelector<HTMLElement>('.message-content');
    if (!messageContent) return;
    const link = document.createElement('a');
    link.className = 'message-line-link';
    link.href = this.lineUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '詳しくは公式LINEで問い合わせてにゃん ↗';
    messageContent.append(link);
  }

  private renderChoices(item: HTMLElement, choices: ChatChoice[]) {
    item.querySelector('.message-choices')?.remove();
    const standard = choices.filter((choice) => choice.size !== 'compact');
    const compact = choices.filter((choice) => choice.size === 'compact');
    if (standard.length === 0 && compact.length === 0) return;
    const messageContent = item.querySelector<HTMLElement>('.message-content');
    if (!messageContent) return;

    const section = document.createElement('div');
    section.className = 'message-choices';
    section.setAttribute('role', 'group');
    section.setAttribute('aria-label', '回答候補');
    if (standard.length > 0) {
      const label = document.createElement('p');
      label.className = 'choice-label';
      label.textContent = 'タップして選べるにゃん';
      const grid = document.createElement('div');
      grid.className = 'choice-grid';
      grid.dataset.count = String(standard.length);
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', '回答候補の選択肢');
      standard.forEach((choice) => grid.append(this.createChoiceButton(choice)));
      section.append(label, grid);
    }
    if (compact.length > 0) {
      const compactRow = document.createElement('div');
      compactRow.className = 'choice-compact';
      compactRow.setAttribute('role', 'group');
      compactRow.setAttribute('aria-label', 'その他の操作');
      compact.forEach((choice) => compactRow.append(this.createChoiceButton(choice, true)));
      section.append(compactRow);
    }
    messageContent.append(section);
    const container = this.root.querySelector<HTMLElement>('.messages');
    if (container) this.revealMessageChoices(item, container);
  }

  private createChoiceButton(choice: ChatChoice, compact = false) {
    const button = document.createElement('button');
    button.className = compact ? 'choice-button compact' : 'choice-button';
    button.type = 'button';
    button.dataset.tone = choice.tone || 'default';
    if (compact) button.dataset.size = 'compact';
    button.textContent = choice.label;
    button.addEventListener('click', () => {
      if (!this.profileReady) {
        this.selectVisitorProfile(choice.value);
        return;
      }
      void this.sendMessage(choice.value);
    });
    return button;
  }

  private renderPicker(item: HTMLElement, picker?: ChatDatetimePicker) {
    item.querySelector('.message-picker')?.remove();
    if (!picker || picker.type !== 'datetime') return;
    const messageContent = item.querySelector<HTMLElement>('.message-content');
    if (!messageContent) return;
    const section = document.createElement('div');
    section.className = 'message-picker';
    section.append(this.createDatetimePicker(picker));
    messageContent.append(section);
    const container = this.root.querySelector<HTMLElement>('.messages');
    if (container) this.revealMessageChoices(item, container);
  }

  private createDatetimePicker(picker: ChatDatetimePicker) {
    const minParts = parseIsoDay(picker.min) || parseIsoDay(jstIsoDay(1))!;
    const maxParts = parseIsoDay(picker.max) || parseIsoDay(jstIsoDay(60))!;
    let viewYear = minParts.y;
    let viewMonth = minParts.m;
    let selected = picker.min;
    const minMonth = `${minParts.y}-${String(minParts.m).padStart(2, '0')}`;
    const maxMonth = `${maxParts.y}-${String(maxParts.m).padStart(2, '0')}`;

    const root = document.createElement('div');
    root.className = 'oc-picker-datetime';

    const nav = document.createElement('div');
    nav.className = 'oc-cal-nav';
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'oc-cal-prev';
    prev.setAttribute('aria-label', '前の月');
    prev.textContent = '‹';
    const title = document.createElement('div');
    title.className = 'oc-cal-title';
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'oc-cal-next';
    next.setAttribute('aria-label', '次の月');
    next.textContent = '›';
    nav.append(prev, title, next);

    const weekdays = document.createElement('div');
    weekdays.className = 'oc-cal-weekdays';
    calendarWeekdays.forEach((label) => {
      const cell = document.createElement('span');
      cell.textContent = label;
      weekdays.append(cell);
    });

    const grid = document.createElement('div');
    grid.className = 'oc-cal-grid';
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', '見学希望日');

    const summary = document.createElement('p');
    summary.className = 'oc-cal-summary';

    const timeRow = document.createElement('label');
    timeRow.className = 'oc-cal-time-row';
    const timeLabel = document.createElement('span');
    timeLabel.textContent = '時間';
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.className = 'oc-cal-time';
    timeInput.step = '900';
    timeInput.value = '15:00';
    timeInput.setAttribute('aria-label', '見学希望時間');
    timeRow.append(timeLabel, timeInput);

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'oc-cal-submit';
    submit.textContent = 'この日時で送る';

    const formatSelected = () => {
      const parts = parseIsoDay(selected);
      const time = timeInput.value || '15:00';
      if (!parts) {
        summary.textContent = '日付を選んでにゃん';
        return;
      }
      const weekday = calendarWeekdays[weekdaySunday0(parts.y, parts.m, parts.d)] || '';
      summary.textContent = `選択中 ${parts.m}月${parts.d}日（${weekday}） ${time}`;
    };

    const renderMonth = () => {
      title.textContent = `${viewYear}年${viewMonth}月`;
      const viewMonthKey = `${viewYear}-${String(viewMonth).padStart(2, '0')}`;
      prev.disabled = viewMonthKey <= minMonth;
      prev.dataset.selectable = prev.disabled ? 'false' : 'true';
      next.disabled = viewMonthKey >= maxMonth;
      next.dataset.selectable = next.disabled ? 'false' : 'true';
      grid.replaceChildren();
      const leading = weekdaySunday0(viewYear, viewMonth, 1);
      const lastDay = daysInMonth(viewYear, viewMonth);
      for (let index = 0; index < leading; index += 1) {
        const empty = document.createElement('button');
        empty.type = 'button';
        empty.className = 'oc-cal-day';
        empty.disabled = true;
        empty.dataset.selectable = 'false';
        empty.tabIndex = -1;
        empty.setAttribute('aria-hidden', 'true');
        grid.append(empty);
      }
      for (let day = 1; day <= lastDay; day += 1) {
        const iso = isoFromParts(viewYear, viewMonth, day);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'oc-cal-day';
        button.textContent = String(day);
        button.dataset.date = iso;
        const outOfRange = iso < picker.min || iso > picker.max;
        button.disabled = outOfRange;
        button.dataset.selectable = outOfRange ? 'false' : 'true';
        if (iso === selected) {
          button.dataset.selected = 'true';
          button.setAttribute('aria-pressed', 'true');
        } else {
          button.setAttribute('aria-pressed', 'false');
        }
        if (!outOfRange) {
          button.addEventListener('click', () => {
            selected = iso;
            renderMonth();
            formatSelected();
          });
        }
        grid.append(button);
      }
    };

    prev.addEventListener('click', () => {
      const nextView = shiftMonth(viewYear, viewMonth, -1);
      viewYear = nextView.y;
      viewMonth = nextView.m;
      renderMonth();
    });
    next.addEventListener('click', () => {
      const nextView = shiftMonth(viewYear, viewMonth, 1);
      viewYear = nextView.y;
      viewMonth = nextView.m;
      renderMonth();
    });
    timeInput.addEventListener('input', formatSelected);
    submit.addEventListener('click', () => {
      const time = /^\d{1,2}:\d{2}$/u.test(timeInput.value) ? timeInput.value : '15:00';
      const [hour, minute] = time.split(':');
      const padded = `${String(Number(hour)).padStart(2, '0')}:${minute}`;
      void this.sendMessage(`${picker.prefix}${selected} ${padded}`);
    });

    renderMonth();
    formatSelected();
    root.append(nav, weekdays, grid, summary, timeRow, submit);
    return root;
  }

  private renderMoreResults(item: HTMLElement, visible: boolean) {
    item.querySelector('.more-results')?.remove();
    if (!visible) return;
    const messageContent = item.querySelector<HTMLElement>('.message-content');
    if (!messageContent) return;
    const section = document.createElement('div');
    section.className = 'more-results';
    const button = document.createElement('button');
    button.className = 'more-results-button';
    button.type = 'button';
    button.textContent = 'もっと見たい';
    button.addEventListener('click', () => { void this.sendMessage('もっと見たい'); });
    section.append(button);
    messageContent.append(section);
    const container = this.root.querySelector<HTMLElement>('.messages');
    if (container) this.revealMessageChoices(item, container);
  }

  private revealMessageChoices(item: HTMLElement, container: HTMLElement) {
    if (!item.isConnected || !container.isConnected) return;
    const itemRect = item.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const padding = 8;
    const availableHeight = Math.max(0, containerRect.height - padding * 2);

    if (itemRect.height > availableHeight) {
      container.scrollTop += itemRect.top - containerRect.top - padding;
      return;
    }
    if (itemRect.bottom > containerRect.bottom - padding) {
      container.scrollTop += itemRect.bottom - containerRect.bottom + padding;
    } else if (itemRect.top < containerRect.top + padding) {
      container.scrollTop += itemRect.top - containerRect.top - padding;
    }
  }

  private shouldShowPropertyDetailLink(answer: string, source: Source) {
    const sourceUrl = source.url ? this.normalizeOfficialUrl(source.url) : null;
    if (!sourceUrl) return false;
    try {
      const url = new URL(sourceUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const normalizedTitle = source.title.replace(/[\s　・|｜「」『』（）()【】\[\]]+/gu, '').toLowerCase();
      const normalizedAnswer = answer.replace(/[\s　・|｜「」『』（）()【】\[\]]+/gu, '').toLowerCase();
      const titleVariants = [normalizedTitle, normalizedTitle.replace(/^(?:賃貸|新築|中古)/u, '')]
        .filter((title, index, values) => title.length >= 3 && values.indexOf(title) === index);
      return pathParts.length >= 2
        && propertySections.has(pathParts[0]!.toLowerCase())
        && (propertyDetailInAnswer.test(answer) || titleVariants.some((title) => normalizedAnswer.includes(title)));
    } catch {
      return false;
    }
  }

  private normalizeOfficialUrl(value: string) {
    try {
      const url = new URL(value);
      if (
        url.protocol !== 'https:'
        || !officialPropertyHosts.has(url.hostname.toLowerCase())
        || url.username
        || url.password
        || url.port
      ) return null;
      url.hash = '';
      return url.href;
    } catch {
      return null;
    }
  }

  private createPropertyDetailLink(source: Source, url: string) {
    const link = document.createElement('a');
    link.className = 'inline-source';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = source.title;
    link.textContent = '詳細を見る ↗';
    return link;
  }

  private createOfficialUrlLink(url: string, label: string) {
    const link = document.createElement('a');
    link.className = 'answer-url';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = '公式ページを開く';
    link.textContent = label;
    return link;
  }

  private propertyDetailSourcesByUrl(answer: string, sources: Source[]) {
    const result = new Map<string, Source>();
    for (const source of sources) {
      if (!this.shouldShowPropertyDetailLink(answer, source) || !source.url) continue;
      const url = this.normalizeOfficialUrl(source.url);
      if (url) result.set(url, source);
    }
    return result;
  }

  private appendAnswerText(
    fragment: DocumentFragment,
    text: string,
    propertySourcesByUrl: Map<string, Source>,
    usedUrls: Set<string>,
  ) {
    const urlPattern = /https:\/\/[^\s<>"'`、。．，！？「」『』【】（）()]+/giu;
    const trailingPunctuation = /[.,!?;:。．，、！？」』】〉》）)\]}]+$/u;
    let cursor = 0;
    for (const match of text.matchAll(urlPattern)) {
      const index = match.index ?? cursor;
      const rawUrl = match[0];
      const punctuation = rawUrl.match(trailingPunctuation)?.[0] || '';
      const candidate = rawUrl.slice(0, rawUrl.length - punctuation.length);
      fragment.append(document.createTextNode(text.slice(cursor, index)));

      const url = this.normalizeOfficialUrl(candidate);
      const propertySource = url ? propertySourcesByUrl.get(url) : undefined;
      if (url && propertySource) {
        if (!usedUrls.has(url)) {
          usedUrls.add(url);
          fragment.append(this.createPropertyDetailLink(propertySource, url));
        }
      } else if (url) {
        usedUrls.add(url);
        fragment.append(this.createOfficialUrlLink(url, candidate));
      } else {
        fragment.append(document.createTextNode(candidate));
      }
      if (punctuation) fragment.append(document.createTextNode(punctuation));
      cursor = index + rawUrl.length;
    }
    fragment.append(document.createTextNode(text.slice(cursor)));
  }

  private renderAnswerWithSources(bubble: HTMLElement, answer: string, sources: Source[]) {
    const sourceByIndex = new Map(sources.map((source) => [source.index, source]));
    const propertySourcesByUrl = this.propertyDetailSourcesByUrl(answer, sources);
    const usedUrls = new Set<string>();
    const fragment = document.createDocumentFragment();
    const citationPattern = /\s*(?:\[(\d+)\]|【(\d+)】)/gu;
    let cursor = 0;
    for (const match of answer.matchAll(citationPattern)) {
      const index = match.index ?? cursor;
      this.appendAnswerText(fragment, answer.slice(cursor, index), propertySourcesByUrl, usedUrls);
      const citationIndex = Number(match[1] || match[2]);
      const source = sourceByIndex.get(citationIndex);
      const sourceUrl = source?.url ? this.normalizeOfficialUrl(source.url) : null;
      if (source && sourceUrl && propertySourcesByUrl.has(sourceUrl) && !usedUrls.has(sourceUrl)) {
        usedUrls.add(sourceUrl);
        fragment.append(this.createPropertyDetailLink(source, sourceUrl));
      }
      cursor = index + match[0].length;
    }
    this.appendAnswerText(fragment, answer.slice(cursor), propertySourcesByUrl, usedUrls);
    bubble.replaceChildren(fragment);
  }

  private setDisabled(disabled: boolean) {
    this.root.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      '.suggestions button, .choice-button, .more-results-button, .send, .oc-cal-prev, .oc-cal-next, .oc-cal-day, .oc-cal-submit, .oc-cal-time',
    ).forEach((control) => {
      if (disabled) {
        control.disabled = true;
        return;
      }
      control.disabled = control.dataset.selectable === 'false';
    });
    const input = this.root.querySelector<HTMLTextAreaElement>('textarea');
    if (disabled) {
      if (input && this.profileReady) input.disabled = true;
      return;
    }
    this.syncComposerLock();
  }

  private renderMessages() {
    const container = this.root.querySelector<HTMLElement>('.messages');
    if (!container) return;
    container.replaceChildren(...this.messages.map((message) => this.renderMessage(message)));
    container.scrollTop = container.scrollHeight;
  }

  private renderMessage(message: ChatMessage) {
    const item = document.createElement('article');
    item.className = `message ${message.role}`;
    item.dataset.messageId = message.id;
    if (message.role === 'assistant') {
      const cat = document.createElement('div');
      cat.className = 'cat';
      cat.dataset.catState = message.pending ? 'thinking' : this.catState;
      cat.setAttribute('aria-hidden', 'true');
      item.append(cat);
    }
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (message.pending) {
      const thinkingLabel = document.createElement('span');
      thinkingLabel.className = 'thinking-label';
      thinkingLabel.setAttribute('role', 'status');
      thinkingLabel.setAttribute('aria-live', 'polite');
      thinkingLabel.setAttribute('aria-atomic', 'true');
      thinkingLabel.setAttribute('aria-label', 'おりにゃんが考えています');
      const chars = document.createElement('span');
      chars.className = 'thinking-chars';
      Array.from('おりにゃんが考えています').forEach((character, index) => {
        const letter = document.createElement('span');
        letter.className = 'thinking-char';
        letter.textContent = character;
        letter.style.animationDelay = `${index * 70}ms`;
        chars.append(letter);
      });
      const dots = document.createElement('span');
      dots.className = 'thinking-dots';
      dots.setAttribute('aria-hidden', 'true');
      for (let index = 0; index < 3; index += 1) dots.append(document.createElement('span'));
      thinkingLabel.append(chars, dots);
      bubble.append(thinkingLabel);
    } else if (message.role === 'assistant' && message.rawContent) {
      this.renderAnswerWithSources(bubble, message.rawContent, message.sources || []);
    } else {
      bubble.append(document.createTextNode(message.content));
    }
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.append(bubble);
    item.append(messageContent);
    if (message.role === 'assistant' && !message.pending) {
      if (message.rawContent) this.renderLineLink(item, Boolean(message.lineLink));
      if (message.choices?.length) this.renderChoices(item, message.choices);
      if (message.picker) this.renderPicker(item, message.picker);
      if (this.shouldAttachMoreResults(Boolean(message.moreResults), message.choices || [])) {
        this.renderMoreResults(item, true);
      }
    }
    return item;
  }

}

if (!customElements.get('orient-chat')) customElements.define('orient-chat', OrientChat);

export { OrientChat };
