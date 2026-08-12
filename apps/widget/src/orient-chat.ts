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
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  rawContent?: string;
  sources?: Source[];
  choices?: ChatChoice[];
  pending?: boolean;
}

interface StoredChatSession {
  conversationId: string;
  sessionToken: string;
  expiresAt: number;
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
const propertySections = new Set(['buy', 'rent', 'property', 'house']);

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
        <button type="button" data-question="物件を探す"><span>⌕</span>物件を探す</button>
        <button type="button" data-question="オリエントホームの良さ"><span>⌂</span>オリエントホームの良さ</button>
      </div>
      <form class="composer">
        <label class="sr-only" for="orient-chat-input">メッセージを入力</label>
        <textarea id="orient-chat-input" rows="1" maxlength="2000" placeholder="メッセージを入力"></textarea>
        <button class="send" type="submit" aria-label="送信">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11.5 17-8-6.5 17-2.8-6.2L3 11.5Z"/><path d="m10.7 14.3 4-4"/></svg>
        </button>
      </form>
      <p class="privacy">
        <a class="privacy-link" target="_blank" rel="noopener">プライバシーポリシー・免責事項</a>
      </p>
      <div class="escalation">
        <p>個別のご相談は、公式の問い合わせページをご利用ください。</p>
        <div>
          <a class="line-link" target="_blank" rel="noopener">公式LINE</a>
          <a class="contact-link" target="_blank" rel="noopener noreferrer">問い合わせページへ</a>
        </div>
      </div>
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
  .inline-source { display: inline-flex; align-items: center; margin: 3px 0 3px 5px; padding: 3px 8px; color: var(--orient-primary-strong); border: 1px solid #ffb98d; border-radius: 999px; background: #fffaf7; font-size: 10px; font-weight: 800; line-height: 1.5; text-decoration: none; vertical-align: middle; white-space: nowrap; }
  .inline-source:hover, .inline-source:focus-visible { border-color: var(--orient-primary); background: #fff1e8; outline: 2px solid rgba(255,104,11,.18); outline-offset: 1px; }
  .answer-url { color: var(--orient-primary-strong); font-weight: 700; text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 2px; overflow-wrap: anywhere; word-break: break-all; }
  .answer-url:hover, .answer-url:focus-visible { color: var(--orient-primary); outline: 2px solid rgba(255,104,11,.18); outline-offset: 1px; }
  .thinking-label { display: inline-flex; align-items: center; min-height: 24px; color: var(--orient-muted); font-size: 12px; font-weight: 700; letter-spacing: .01em; }
  .message-choices { margin-top: 9px; animation: choices-in 180ms ease-out both; }
  .choice-label { margin: 0 0 6px; color: var(--orient-muted); font-size: 10px; font-weight: 700; letter-spacing: .03em; }
  .choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .choice-button { min-width: 0; min-height: 40px; padding: 8px 9px; border: 1px solid #ffc49f; border-radius: 10px; color: #5a3522; background: #fffaf7; font-size: 12px; font-weight: 800; line-height: 1.35; cursor: pointer; transition: transform 120ms ease, border-color 120ms ease, background 120ms ease; }
  .choice-button[data-tone="primary"] { border-color: var(--orient-primary); color: var(--orient-primary-strong); background: #fff3eb; }
  .choice-button:hover, .choice-button:focus-visible { transform: translateY(-1px); border-color: var(--orient-primary); background: #ffede2; outline: 2px solid rgba(255,104,11,.2); outline-offset: 1px; }
  .choice-button:active { transform: translateY(0); }
  .choice-button:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .choice-button:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .suggestions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; padding: 9px 14px 11px; border-top: 1px solid var(--orient-border); }
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
  .escalation > div { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .escalation a { min-height: 38px; display: grid; place-items: center; border: 1px solid; border-radius: 9px; background: #fff; font-size: 12px; font-weight: 800; text-decoration: none; cursor: pointer; }
  .line-link { color: var(--orient-line); }
  .escalation .contact-link { color: #fff; border-color: var(--orient-primary); background: var(--orient-primary); }
  .escalation .contact-link:hover, .escalation .contact-link:focus-visible { border-color: var(--orient-primary-strong); background: var(--orient-primary-strong); outline: 2px solid rgba(255,104,11,.25); outline-offset: 1px; }
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
  @keyframes choices-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes breathe { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-3px) scale(1.012); } }
  @keyframes listen { 0%,100% { transform: rotate(0); } 50% { transform: rotate(2deg); } }
  @keyframes speak { from { transform: translateY(0); } to { transform: translateY(-2px); } }
  @keyframes think { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px) rotate(-1deg); } }
  @media (max-width: 520px) {
    :host { inset: auto 10px 10px 10px; }
    .root { width: 100%; }
    .panel { width: 100%; height: min(690px, calc(100dvh - 24px)); min-height: 480px; border-radius: 16px; }
    .launcher-ring { width: 88px; height: 88px; }
    .cat-launcher { width: 106px; height: 106px; }
    .suggestions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .suggestions button { font-size: 10px; }
    .choice-button { min-height: 42px; font-size: 12px; }
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
    this.bindEvents();
    this.messages = [{
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'こんにちは、オリにゃんだよ！\nお部屋探しや住まいのこと、気軽に聞いてにゃん。',
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

  private get sessionStorageKey() {
    try {
      return `orient-chat.session.v1:${new URL(this.apiUrl).origin}`;
    } catch {
      return '';
    }
  }

  private restoreStoredSession() {
    const key = this.sessionStorageKey;
    if (!key || this.demoMode) return false;
    try {
      const value = window.sessionStorage.getItem(key);
      if (!value) return false;
      const stored = JSON.parse(value) as Partial<StoredChatSession>;
      const { conversationId, sessionToken, expiresAt } = stored;
      const isValid = typeof conversationId === 'string'
        && typeof sessionToken === 'string'
        && typeof expiresAt === 'number'
        && expiresAt > Date.now();
      if (!isValid) {
        window.sessionStorage.removeItem(key);
        return false;
      }
      this.conversationId = conversationId;
      this.sessionToken = sessionToken;
      return true;
    } catch {
      return false;
    }
  }

  private storeSession(expiresIn: number) {
    const key = this.sessionStorageKey;
    if (!key || this.demoMode || !this.conversationId || !this.sessionToken) return;
    try {
      // Keep this tab-only session slightly shorter than the server-side token.
      const lifetime = Math.max(1, Math.min(expiresIn - 60, 86_340));
      const stored: StoredChatSession = {
        conversationId: this.conversationId,
        sessionToken: this.sessionToken,
        expiresAt: Date.now() + lifetime * 1_000,
      };
      window.sessionStorage.setItem(key, JSON.stringify(stored));
    } catch {
      // Browsers may disable sessionStorage; the in-memory session still works.
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
    if (line) line.href = this.getAttribute('line-url') || 'https://line.me/';
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
    if (this.restoreStoredSession()) return;
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
    const data = await response.json() as { conversationId: string; sessionToken: string; expiresIn?: number };
    this.conversationId = data.conversationId;
    this.sessionToken = data.sessionToken;
    this.storeSession(data.expiresIn || 86_400);
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

  private async sendMessage(content: string) {
    if (this.sending) return;
    this.sending = true;
    this.messages.forEach((message) => { message.choices = []; });
    this.root.querySelectorAll('.message-choices').forEach((element) => element.remove());
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
      if (message) {
        message.pending = false;
        message.content = this.displayAnswer(result.answer).slice(0, 1);
        message.sources = result.sources;
        message.choices = result.choices;
      }
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
    const data = await response.json() as { answer?: string; sources?: Source[]; choices?: ChatChoice[]; error?: string };
    if (response.status === 401) this.clearStoredSession();
    if (!response.ok) throw new Error(data.error || '回答を取得できませんでした');
    return { answer: data.answer || '', sources: data.sources || [], choices: data.choices || [] };
  }

  private async demoResponse(content: string) {
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    if (/値引|価格交渉|法的|重要事項/u.test(content)) {
      return { answer: 'ごめんね、その内容はオリにゃんでは案内できないにゃん。お部屋探しや住まいのことを聞いてにゃん。', sources: [], choices: [] };
    }
    return {
      answer: 'オリにゃんは、物件探し・住まい・店舗のことを案内できるにゃん。気になるエリアや条件を教えてね。[1]',
      sources: [{ index: 1, title: 'オリエントホールディングス 公式サイト', url: 'https://orijyu.com/' }],
      choices: [],
    };
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
      message.content = content;
      textNode.data = content;
      if (container) container.scrollTop = container.scrollHeight;
    };

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      updateBubble(displayAnswer);
      this.renderAnswerWithSources(bubble, answer, message.sources || []);
      if (item) this.renderChoices(item, message.choices || []);
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
    if (item) this.renderChoices(item, message.choices || []);
  }

  private renderChoices(item: HTMLElement, choices: ChatChoice[]) {
    item.querySelector('.message-choices')?.remove();
    if (choices.length === 0) return;
    const messageContent = item.querySelector<HTMLElement>('.message-content');
    if (!messageContent) return;

    const section = document.createElement('div');
    section.className = 'message-choices';
    section.setAttribute('aria-label', '回答候補');
    const label = document.createElement('p');
    label.className = 'choice-label';
    label.textContent = 'タップして選べるにゃん';
    const grid = document.createElement('div');
    grid.className = 'choice-grid';
    choices.forEach((choice) => {
      const button = document.createElement('button');
      button.className = 'choice-button';
      button.type = 'button';
      button.dataset.tone = choice.tone || 'default';
      button.textContent = choice.label;
      button.addEventListener('click', () => { void this.sendMessage(choice.value); });
      grid.append(button);
    });
    section.append(label, grid);
    messageContent.append(section);
    const container = this.root.querySelector<HTMLElement>('.messages');
    if (container) container.scrollTop = container.scrollHeight;
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
        && titleVariants.some((title) => normalizedAnswer.includes(title));
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
    this.root.querySelectorAll<HTMLButtonElement>('.suggestions button, .choice-button, .send').forEach((button) => { button.disabled = disabled; });
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
      thinkingLabel.textContent = 'おりにゃんが考えています';
      bubble.append(thinkingLabel);
    } else if (message.role === 'assistant' && message.rawContent) {
      this.renderAnswerWithSources(bubble, message.rawContent, message.sources || []);
    } else {
      bubble.append(document.createTextNode(message.content));
    }
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.append(bubble);
    if (message.role === 'assistant' && !message.pending && message.rawContent && message.choices?.length) {
      item.append(messageContent);
      this.renderChoices(item, message.choices);
      return item;
    }
    item.append(messageContent);
    return item;
  }

}

if (!customElements.get('orient-chat')) customElements.define('orient-chat', OrientChat);

export { OrientChat };
