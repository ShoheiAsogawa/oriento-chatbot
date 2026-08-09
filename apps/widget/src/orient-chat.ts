type CatState = 'idle' | 'listening' | 'speaking' | 'thinking';
type ChatRole = 'assistant' | 'user';

interface Source {
  index: number;
  title: string;
  url?: string;
  key?: string;
  score?: number;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  sources?: Source[];
  pending?: boolean;
}

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
}

declare global {
  interface Window { turnstile?: TurnstileApi; }
}

const scriptSource = (document.currentScript as HTMLScriptElement | null)?.src;
const defaultAssetUrl = scriptSource ? new URL('assets/orinyan-states.png', scriptSource).href : '/assets/orinyan-states.png';

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
      <div class="suggestions" aria-label="よくある質問">
        <button type="button" data-question="物件を探す方法を教えてください"><span>⌕</span>物件を探す</button>
        <button type="button" data-question="家づくりの特徴を教えてください"><span>⌂</span>家づくりについて</button>
        <button type="button" data-question="店舗と問い合わせ方法を教えてください"><span>▦</span>店舗・お問い合わせ</button>
      </div>
      <form class="composer">
        <label class="sr-only" for="orient-chat-input">メッセージを入力</label>
        <textarea id="orient-chat-input" rows="1" maxlength="2000" placeholder="メッセージを入力"></textarea>
        <button class="send" type="submit" aria-label="送信">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11.5 17-8-6.5 17-2.8-6.2L3 11.5Z"/><path d="m10.7 14.3 4-4"/></svg>
        </button>
      </form>
      <p class="privacy">
        <span class="privacy-copy">入力内容は品質管理のため記録されます。</span>
        <a class="privacy-link" target="_blank" rel="noopener">プライバシーポリシー・免責事項</a>
      </p>
      <div class="escalation">
        <p>解決しない場合は、こちらからもご連絡いただけます。</p>
        <div>
          <a class="line-link" target="_blank" rel="noopener">公式LINE</a>
          <a class="contact-link" target="_blank" rel="noopener">お問い合わせ</a>
          <button class="lead-trigger" type="button">担当者からの連絡を希望</button>
        </div>
      </div>
      <section class="lead-sheet" aria-labelledby="orient-lead-title" hidden>
        <div class="lead-heading">
          <div>
            <h3 id="orient-lead-title">担当者からご連絡します</h3>
            <p>メールまたは電話番号のどちらかをご入力ください。</p>
          </div>
          <button class="lead-close" type="button" aria-label="連絡先入力を閉じる">×</button>
        </div>
        <form class="lead-form">
          <label>お名前（任意）<input name="name" autocomplete="name" maxlength="100"></label>
          <label>メールアドレス<input name="email" type="email" autocomplete="email" maxlength="254"></label>
          <label>電話番号<input name="phone" type="tel" autocomplete="tel" maxlength="30"></label>
          <label class="consent"><input name="consent" type="checkbox" required><span>営業連絡のため、入力した連絡先を顧客情報として保存することに同意します。</span></label>
          <p class="lead-status" role="status" aria-live="polite"></p>
          <button class="lead-submit" type="submit">連絡を希望する</button>
        </form>
      </section>
      <div class="turnstile-slot" aria-hidden="true"></div>
    </section>
    <button class="launcher" type="button" aria-label="オリにゃんに相談" aria-expanded="false">
      <span class="launcher-ring"><span class="cat cat-launcher" data-cat-state="idle" aria-hidden="true"></span></span>
      <span class="launcher-label">オリにゃんに相談</span>
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
  .source-links { display: grid; gap: 7px; margin-top: 8px; }
  .source-link { display: grid; gap: 2px; padding: 9px 11px; color: var(--orient-ink); border: 1px solid #ffd1b6; border-radius: 10px; background: #fffaf7; text-decoration: none; }
  .source-link:hover, .source-link:focus-visible { border-color: var(--orient-primary); background: #fff5ef; outline: 2px solid rgba(255,104,11,.18); outline-offset: 1px; }
  .source-title { overflow: hidden; font-size: 11px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
  .source-action { color: var(--orient-primary-strong); font-size: 10px; font-weight: 800; }
  .typing { display: flex; gap: 5px; align-items: center; height: 24px; }
  .typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--orient-muted); animation: typing 1s infinite ease-in-out; }
  .typing i:nth-child(2) { animation-delay: .12s; }
  .typing i:nth-child(3) { animation-delay: .24s; }
  .suggestions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; padding: 9px 14px 11px; border-top: 1px solid var(--orient-border); }
  .suggestions button { min-width: 0; min-height: 42px; padding: 8px 6px; border: 1px solid var(--orient-primary); border-radius: 10px; background: #fff; font-size: 11px; font-weight: 700; cursor: pointer; }
  .suggestions button span { display: block; color: var(--orient-primary); font-size: 17px; line-height: 1; }
  .suggestions button:hover, .suggestions button:focus-visible { background: #fff5ef; outline: 2px solid rgba(255,104,11,.25); outline-offset: 1px; }
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
  .escalation p { margin: 0 0 8px; text-align: center; color: var(--orient-muted); font-size: 10px; }
  .escalation > div { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .escalation a, .lead-trigger { min-height: 38px; display: grid; place-items: center; border: 1px solid; border-radius: 9px; background: #fff; font-size: 12px; font-weight: 800; text-decoration: none; cursor: pointer; }
  .line-link { color: var(--orient-line); }
  .contact-link { color: var(--orient-primary); }
  .lead-trigger { grid-column: 1 / -1; color: #fff; border-color: var(--orient-ink); background: var(--orient-ink); }
  .lead-sheet { position: absolute; inset: 84px 0 0; z-index: 4; overflow: auto; padding: 20px; background: #fff; }
  .lead-sheet[hidden] { display: none; }
  .lead-heading { display: grid; grid-template-columns: 1fr 36px; gap: 12px; align-items: start; margin-bottom: 18px; }
  .lead-heading h3 { margin: 0; font-size: 18px; }
  .lead-heading p { margin: 4px 0 0; color: var(--orient-muted); font-size: 12px; }
  .lead-close { width: 36px; height: 36px; border: 0; border-radius: 9px; color: var(--orient-muted); background: var(--orient-soft); font-size: 23px; cursor: pointer; }
  .lead-form { display: grid; gap: 13px; }
  .lead-form > label:not(.consent) { display: grid; gap: 5px; font-size: 12px; font-weight: 800; }
  .lead-form input:not([type="checkbox"]) { width: 100%; min-height: 43px; padding: 9px 11px; border: 1px solid #cfd0d7; border-radius: 9px; color: var(--orient-ink); background: #fff; }
  .lead-form input:focus-visible { outline: 3px solid rgba(255,104,11,.18); border-color: var(--orient-primary); }
  .consent { display: grid; grid-template-columns: 20px 1fr; gap: 8px; align-items: start; color: var(--orient-muted); font-size: 11px; font-weight: 500; }
  .consent input { width: 18px; height: 18px; margin: 1px 0 0; accent-color: var(--orient-primary); }
  .lead-status { min-height: 20px; margin: 0; color: #b34116; font-size: 12px; }
  .lead-status.success { color: #137c45; }
  .lead-submit { min-height: 46px; border: 0; border-radius: 10px; color: #fff; background: var(--orient-primary); font-weight: 800; cursor: pointer; }
  .lead-submit:disabled { opacity: .55; cursor: wait; }
  .turnstile-slot { position: absolute; left: 12px; bottom: 12px; z-index: 8; }
  .cat { background-image: var(--orient-asset); background-repeat: no-repeat; background-size: 200% 200%; background-position: 0 0; }
  .cat[data-cat-state="listening"] { background-position: 100% 0; }
  .cat[data-cat-state="speaking"] { background-position: 0 100%; }
  .cat[data-cat-state="thinking"] { background-position: 100% 100%; }
  .cat-avatar { width: 52px; height: 52px; border: 3px solid rgba(255,255,255,.88); border-radius: 50%; background-color: #fff; }
  .launcher { display: grid; justify-items: center; border: 0; background: transparent; cursor: pointer; filter: drop-shadow(0 8px 13px rgba(41,41,58,.2)); }
  .launcher-ring { width: 102px; height: 102px; display: block; overflow: hidden; border: 4px solid #fff; border-radius: 50%; background: var(--orient-primary); }
  .cat-launcher { width: 122px; height: 122px; margin: 8px 0 0 -10px; animation: breathe 3.2s ease-in-out infinite; }
  .launcher-label { margin-top: -6px; padding: 5px 11px; color: #fff; border-radius: 7px; background: var(--orient-ink); font-size: 11px; font-weight: 800; }
  .launcher:hover .cat-launcher { transform: translateY(-5px) rotate(-2deg); }
  .launcher[aria-expanded="true"] { display: none; }
  .cat[data-cat-state="listening"] { animation: listen 1.4s ease-in-out infinite; }
  .cat[data-cat-state="speaking"] { animation: speak .42s ease-in-out infinite alternate; }
  .cat[data-cat-state="thinking"] { animation: think 1.5s ease-in-out infinite; }
  @keyframes panel-in { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }
  @keyframes message-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes breathe { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-3px) scale(1.012); } }
  @keyframes listen { 0%,100% { transform: rotate(0); } 50% { transform: rotate(2deg); } }
  @keyframes speak { from { transform: translateY(0); } to { transform: translateY(-2px); } }
  @keyframes think { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px) rotate(-1deg); } }
  @keyframes typing { 0%,60%,100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }
  @media (max-width: 520px) {
    :host { inset: auto 10px 10px 10px; }
    .root { width: 100%; }
    .panel { width: 100%; height: min(690px, calc(100dvh - 24px)); min-height: 480px; border-radius: 16px; }
    .launcher-ring { width: 88px; height: 88px; }
    .cat-launcher { width: 106px; height: 106px; }
    .suggestions { grid-template-columns: 1fr 1fr 1fr; }
    .suggestions button { font-size: 10px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
  }
`;

class OrientChat extends HTMLElement {
  private readonly root: ShadowRoot;
  private messages: ChatMessage[] = [];
  private conversationId = '';
  private sessionToken = '';
  private catState: CatState = 'idle';
  private sending = false;
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
    const privacyCopy = this.root.querySelector<HTMLElement>('.privacy-copy');
    if (privacyCopy && this.demoMode) privacyCopy.textContent = 'プレビューで入力した内容は保存されません。';
    this.bindEvents();
    this.messages = [{
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '住まい探しのご質問をどうぞ。\nサイトの情報をもとにご案内します。',
    }];
    this.renderMessages();
    if (this.hasAttribute('open')) this.open();
  }

  attributeChangedCallback(name: string) {
    if (!this.isConnected || name !== 'open') return;
    if (this.hasAttribute('open')) this.open(); else this.close();
  }

  private get apiUrl() { return (this.getAttribute('api-url') || '').replace(/\/$/, ''); }
  private get demoMode() { return this.getAttribute('demo-mode') === 'true' || !this.apiUrl; }

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
    if (line) line.href = this.getAttribute('line-url') || 'https://line.me/';
    if (contact) contact.href = this.getAttribute('contact-url') || 'https://orijyu.com/contact/';
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
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form?.requestSubmit();
      }
    });
    this.root.querySelector('.lead-trigger')?.addEventListener('click', () => this.showLeadForm());
    this.root.querySelector('.lead-close')?.addEventListener('click', () => this.hideLeadForm());
    const leadForm = this.root.querySelector<HTMLFormElement>('.lead-form');
    leadForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submitLead(leadForm);
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

  private async ensureSession() {
    if (this.demoMode || this.conversationId) return;
    const turnstileToken = await this.getTurnstileToken();
    const response = await fetch(`${this.apiUrl}/api/chat/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourcePage: location.href, turnstileToken }),
    });
    if (!response.ok) {
      this.turnstilePromise = null;
      if (this.turnstileWidgetId && window.turnstile) window.turnstile.reset(this.turnstileWidgetId);
      throw new Error('セッションを開始できませんでした。もう一度お試しください。');
    }
    const data = await response.json() as { conversationId: string; sessionToken: string };
    this.conversationId = data.conversationId;
    this.sessionToken = data.sessionToken;
  }

  private async getTurnstileToken() {
    if (this.demoMode) return '';
    const sitekey = this.getAttribute('turnstile-site-key');
    if (!sitekey) throw new Error('セキュリティ設定が未完了です。サイト管理者へお問い合わせください。');
    if (this.turnstilePromise) return this.turnstilePromise;

    this.turnstilePromise = new Promise<string>((resolve, reject) => {
      const startedAt = Date.now();
      const waitForApi = () => {
        const api = window.turnstile;
        const container = this.root.querySelector<HTMLElement>('.turnstile-slot');
        if (!api || !container) {
          if (Date.now() - startedAt > 12_000) {
            this.turnstilePromise = null;
            reject(new Error('セキュリティ確認を開始できませんでした。ページを再読み込みしてください。'));
            return;
          }
          window.setTimeout(waitForApi, 100);
          return;
        }

        const fail = () => {
          this.turnstilePromise = null;
          if (this.turnstileWidgetId) api.reset(this.turnstileWidgetId);
          reject(new Error('セキュリティ確認に失敗しました。もう一度お試しください。'));
        };
        this.turnstileWidgetId = api.render(container, {
          sitekey,
          action: 'chat_session',
          execution: 'execute',
          appearance: 'interaction-only',
          callback: (token: string) => resolve(token),
          'error-callback': fail,
          'expired-callback': fail,
          'timeout-callback': fail,
        });
        api.execute(this.turnstileWidgetId);
      };
      waitForApi();
    });
    return this.turnstilePromise;
  }

  private showLeadForm() {
    const sheet = this.root.querySelector<HTMLElement>('.lead-sheet');
    const status = this.root.querySelector<HTMLElement>('.lead-status');
    if (sheet) sheet.hidden = false;
    if (status) { status.textContent = ''; status.classList.remove('success'); }
    window.setTimeout(() => this.root.querySelector<HTMLInputElement>('.lead-form input[name="name"]')?.focus(), 0);
  }

  private hideLeadForm() {
    const sheet = this.root.querySelector<HTMLElement>('.lead-sheet');
    if (sheet) sheet.hidden = true;
    this.root.querySelector<HTMLButtonElement>('.lead-trigger')?.focus();
  }

  private async submitLead(form: HTMLFormElement) {
    const status = this.root.querySelector<HTMLElement>('.lead-status');
    const button = this.root.querySelector<HTMLButtonElement>('.lead-submit');
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    const consent = data.get('consent') === 'on';
    if (!email && !phone) {
      if (status) status.textContent = 'メールアドレスまたは電話番号を入力してください。';
      return;
    }
    if (!consent) {
      if (status) status.textContent = '連絡先の保存と営業連絡への同意が必要です。';
      return;
    }

    if (button) button.disabled = true;
    if (status) { status.textContent = '登録しています…'; status.classList.remove('success'); }
    try {
      await this.ensureSession();
      if (!this.demoMode) {
        const response = await fetch(`${this.apiUrl}/api/chat/lead`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            conversationId: this.conversationId,
            sessionToken: this.sessionToken,
            name: name || undefined,
            email: email || undefined,
            phone: phone || undefined,
            marketingConsent: true,
          }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || '連絡先を登録できませんでした。');
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
      }
      form.reset();
      if (status) { status.textContent = '承りました。担当者からご連絡します。'; status.classList.add('success'); }
      if (button) button.textContent = '登録済み';
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : '連絡先を登録できませんでした。';
    } finally {
      if (button && button.textContent !== '登録済み') button.disabled = false;
    }
  }

  private async sendMessage(content: string) {
    if (this.sending) return;
    this.sending = true;
    this.messages.push({ id: crypto.randomUUID(), role: 'user', content });
    const pendingId = crypto.randomUUID();
    this.messages.push({ id: pendingId, role: 'assistant', content: '', pending: true });
    const input = this.root.querySelector<HTMLTextAreaElement>('textarea');
    if (input) { input.value = ''; input.style.height = 'auto'; }
    this.setCatState('thinking');
    this.renderMessages();
    this.setDisabled(true);

    try {
      await this.ensureSession();
      const result = this.demoMode ? await this.demoResponse(content) : await this.remoteResponse(content);
      const message = this.messages.find((item) => item.id === pendingId);
      if (message) { message.pending = false; message.content = ''; message.sources = result.sources; }
      this.renderMessages();
      this.setCatState('speaking');
      await this.typeAnswer(pendingId, result.answer);
    } catch (error) {
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

  private async remoteResponse(content: string) {
    const response = await fetch(`${this.apiUrl}/api/chat/message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId: this.conversationId, sessionToken: this.sessionToken, message: content }),
    });
    const data = await response.json() as { answer?: string; sources?: Source[]; error?: string };
    if (!response.ok) throw new Error(data.error || '回答を取得できませんでした');
    return { answer: data.answer || '', sources: data.sources || [] };
  }

  private async demoResponse(content: string) {
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    if (/値引|価格交渉|法的|重要事項/u.test(content)) {
      return { answer: '価格交渉、法的判断、重要事項説明に代わる回答はできません。担当店舗またはお問い合わせフォームへご相談ください。', sources: [] };
    }
    return {
      answer: 'オリエントグループでは、新築・中古住宅や土地、家づくりに関する情報をご案内しています。最新の物件情報は公式サイトの物件一覧からご確認ください。[1]',
      sources: [{ index: 1, title: 'オリエントホールディングス 公式サイト', url: 'https://orijyu.com/' }],
    };
  }

  private async typeAnswer(id: string, answer: string) {
    const message = this.messages.find((item) => item.id === id);
    if (!message) return;
    answer = answer.replace(/\s*\[\d+\]/gu, '').trim();
    const item = Array.from(this.root.querySelectorAll<HTMLElement>('.message'))
      .find((candidate) => candidate.dataset.messageId === id);
    const bubble = item?.querySelector<HTMLElement>('.bubble');
    const container = this.root.querySelector<HTMLElement>('.messages');
    if (!bubble) {
      message.content = answer;
      this.renderMessages();
      return;
    }

    const updateBubble = (content: string) => {
      message.content = content;
      bubble.replaceChildren(document.createTextNode(content));
      if (container) container.scrollTop = container.scrollHeight;
    };

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      updateBubble(answer);
      return;
    }
    for (let index = 0; index < answer.length; index += 2) {
      updateBubble(answer.slice(0, index + 2));
      await new Promise((resolve) => window.setTimeout(resolve, 18));
    }
    updateBubble(answer);
  }

  private setDisabled(disabled: boolean) {
    this.root.querySelectorAll<HTMLButtonElement>('.suggestions button, .send').forEach((button) => { button.disabled = disabled; });
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
      const typing = document.createElement('span');
      typing.className = 'typing';
      typing.setAttribute('aria-label', '回答を考えています');
      typing.innerHTML = '<i></i><i></i><i></i>';
      bubble.append(typing);
    } else {
      bubble.append(document.createTextNode(message.content));
    }
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.append(bubble);
    if (message.role === 'assistant' && message.sources?.length) {
      const links = document.createElement('nav');
      links.className = 'source-links';
      links.setAttribute('aria-label', '関連する公式ページ');
      for (const source of message.sources.slice(0, 2)) {
        if (!source.url) continue;
        const link = document.createElement('a');
        link.className = 'source-link';
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener';
        const title = document.createElement('span');
        title.className = 'source-title';
        title.textContent = source.title;
        const action = document.createElement('span');
        action.className = 'source-action';
        action.textContent = '物件詳細を見る ↗';
        link.append(title, action);
        links.append(link);
      }
      if (links.childElementCount) messageContent.append(links);
    }
    item.append(messageContent);
    return item;
  }

}

if (!customElements.get('orient-chat')) customElements.define('orient-chat', OrientChat);

export { OrientChat };
