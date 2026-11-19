var OrientChat=(function(D){"use strict";const j="#click_to_call_bar, .ctc_bar, [data-orient-chat-avoid]";function W(d,e=0){return d>0?d+e:0}function _(d){if(d==null)return null;const e=d.trim();if(!e)return null;const t=Number.parseFloat(e);return Number.isFinite(t)&&t>=0?t:null}function G(d,e,t){return t.display==="none"||t.visibility==="hidden"||Number.parseFloat(t.opacity||"1")===0||t.position!=="fixed"&&t.position!=="sticky"||d.height<8||d.width<40||e-d.bottom>32||d.top>=e-4?0:Math.ceil(d.height+Math.max(0,e-d.bottom))}function K(d,e,t){let o=0;for(const r of d){if(!(r instanceof Element))continue;const i=r.getBoundingClientRect();o=Math.max(o,G(i,e,t(r)))}return o}const V=[{label:"男性",value:"male"},{label:"女性",value:"female"},{label:"そのほか",value:"other"}],H=[{label:"10代",value:"teens"},{label:"20代",value:"20s"},{label:"30代",value:"30s"},{label:"40代",value:"40s"},{label:"50代",value:"50s"},{label:"60代以上",value:"60s_plus"}],R={male:"男性",female:"女性",other:"そのほか"},q={teens:"10代","20s":"20代","30s":"30代","40s":"40代","50s":"50代","60s_plus":"60代以上"};function J(d){return d in R}function Q(d){return d in q}const N=[[`あけましておめでとう、オリにゃんだよ！
今年もいいお部屋と、いい日々に出会えますようにだにゃん。`,`お正月、こたつから出られないオリにゃんだよ。
「こたつ付き」の物件があったら、たぶん内見から帰らないにゃん。`,`新しい年だにゃん！
初夢に出てきた理想のお部屋、いっしょに正夢にしよっか。`],[`こんにちは、オリにゃんだよ！
梅が咲いたら春まであとちょっと。ぽかぽかのお部屋、探そっか。`,`2月22日は猫の日だにゃん。
オリにゃん的には、毎月22日でもいいと思ってるにゃん。`,`寒い日は、猫を見れば家でいちばん暖かい場所がわかるらしいにゃん。
オリにゃんの後ろ、ついてくる？`],[`桜がそわそわ、オリにゃんもうきうきだにゃん！
春のお部屋探し、いっしょに始めよっか。`,`引っ越しの段ボールを見ると、猫はとりあえず入るにゃん。
荷造りより先に、オリにゃんのお城が完成だにゃん。`,`春風ふわり、こんにちは！
新生活の「こんなお部屋がいい」、オリにゃんに聞かせてにゃん。`],[`新生活、ちゃんと息抜きできてる？
オリにゃんとお部屋の話でもして、ひと休みするにゃん。`,`桜の花びらがお部屋までついてきたにゃん。
家賃は払わないけど、かわいい同居人だにゃん。`,`ぽかぽかの窓辺は、猫界の一等地だにゃん。
人間界のいい物件も、オリにゃんにまかせてにゃん。`],[`新緑きらきら、窓を開けるといい風だにゃん。
こんな日は、お部屋探しものんびりいこっか。`,`鯉のぼりは泳いで、オリにゃんはお昼寝だにゃん。
住まいの相談がきたら、ちゃんと起きるにゃん！`,`日当たりは方角だけじゃなく、窓の前の景色でも変わるにゃん。
オリにゃん、意外と物件を見る目があるでしょ？`],[`あじさいがきれいな季節だにゃん。
雨音を聞きながら、居心地いいお部屋の話しよっか。`,`雨の日は、おうちがいちばんの遊び場だにゃん。
オリにゃんは今、カーテンの影と戦ってるにゃん。`,`梅雨どきは、クローゼットもたまに風を通すと喜ぶにゃん。
お部屋探しも湿気対策も、風通しが大事だにゃん。`],[`七夕のお願い、もう決めた？
オリにゃんは「涼しくて素敵なお部屋」に一票だにゃん。`,`夏の窓辺はぽかぽかを通り越して、あちあちだにゃん。
涼しい場所から、お部屋探し始めよっか。`,`窓が二方向にあると、風の通り道をつくりやすいにゃん。
猫の通り道もあると、なお最高だにゃん。`],[`暑いね〜。オリにゃん、床でぺたんこになってるにゃん。
花火の話でも、お部屋の話でも、ひと休みしよっか。`,`夏休みの宿題は後回しでも、お部屋の相談は今すぐ聞くにゃん！
オリにゃんにまかせてにゃん。`,`畳のいい香りは「い草」からするにゃん。
ごろんとしたくなるのは、猫だけじゃないはずだにゃん。`],[`ちょっと涼しくなって、オリにゃんの食欲が戻ってきたにゃん。
秋のお部屋探しも、もりもり手伝うにゃん！`,`お月見だにゃん。
月がきれいに見える窓、オリにゃんの特等席に予約していい？`,`赤とんぼを見つけたにゃん！
秋風にのって、いい住まいも見つけにいこっか。`],[`きんもくせい、いい香りだにゃん。
つい遠回りしたくなる季節、お部屋探しも寄り道歓迎だにゃん。`,`ハロウィンだにゃん！
お菓子をくれなくても、物件情報はちゃんと教えるにゃん。`,`猫は頭が通れば、体も通れることが多いらしいにゃん。
でも内見では、ちゃんと玄関から入るにゃん。`],[`落ち葉がカサカサ、猫心をくすぐるにゃん。
追いかける前に、住まいの相談を聞くにゃん！`,`お日さまが低くなる冬は、部屋の奥まで光が届きやすいにゃん。
日なたチェックが楽しい季節だにゃん。`,`そろそろ毛布の出番だにゃん。
くるまる派？ かぶる派？ オリにゃんは中にもぐる派だにゃん。`],[`もう年末だにゃん！
大掃除は未来のオリにゃんに任せて、今日はお部屋の話しよっか。`,`こたつ、みかん、オリにゃん。冬の三点セットだにゃん。
あったかい住まいも加えたら完璧だにゃん。`,`窓辺がひんやりする日は、厚手のカーテンも頼れるにゃん。
オリにゃんは毛皮でぬくぬくだけどね。`]];function X(d=new Date){return new Date(d.getTime()+324e5).getUTCMonth()}function T(d=0,e=new Date){const t=new Date(e.getTime()+324e5),o=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate()+d));return`${o.getUTCFullYear()}-${String(o.getUTCMonth()+1).padStart(2,"0")}-${String(o.getUTCDate()).padStart(2,"0")}`}function C(d){const e=/^(\d{4})-(\d{2})-(\d{2})$/u.exec(d);if(!e)return;const t=Number(e[1]),o=Number(e[2]),r=Number(e[3]),i=new Date(Date.UTC(t,o-1,r));if(!(i.getUTCFullYear()!==t||i.getUTCMonth()!==o-1||i.getUTCDate()!==r))return{y:t,m:o,d:r}}function Z(d,e,t){return`${d}-${String(e).padStart(2,"0")}-${String(t).padStart(2,"0")}`}function I(d,e,t){return new Date(Date.UTC(d,e-1,t)).getUTCDay()}function ee(d,e){return new Date(Date.UTC(d,e,0)).getUTCDate()}function O(d,e,t){const o=new Date(Date.UTC(d,e-1+t,1));return{y:o.getUTCFullYear(),m:o.getUTCMonth()+1}}function te(d){if(!d||typeof d!="object"||Array.isArray(d))return;const e=d;if(e.type==="datetime"&&!(typeof e.min!="string"||typeof e.max!="string"||typeof e.prefix!="string")&&!(!C(e.min)||!C(e.max)||!e.prefix.trim()))return{type:"datetime",min:e.min,max:e.max,prefix:e.prefix}}function P(d){const e=(d||"").trim();return/session expired|unauthorized/i.test(e)||e.includes("有効期限")?"チャットの有効期限が切れました。もう一度送信してにゃん。":/conversation not found/i.test(e)?"会話を再開できませんでした。もう一度送ってにゃん。":/stored response unavailable/i.test(e)?"回答を取り出せませんでした。もう一度送ってにゃん。":/[\u3040-\u30ff\u4e00-\u9fff]/u.test(e)?e:"回答を取得できませんでした。もう一度お試しください。"}const $=["日","月","火","水","木","金","土"];function oe(d=new Date){const e=N[X(d)]||N[0];return`${e[Math.floor(Math.random()*e.length)]}
あなたに会えて、とってもうれしいにゃん。`}const B=document.currentScript?.src,re=B?new URL("assets/orinyan-states.png",B).href:"/assets/orinyan-states.png",ie=new Set(["orijyu.com","www.orijyu.com","orichin.com","www.orichin.com","origumi.jp","www.origumi.jp","oriho.com","www.oriho.com"]),ne=new Set(["buy","rent","pri2","property","house"]),se=/(?:販売価格|物件価格|賃料|家賃|所在地)\s*(?:[：:]|は|\d)|\d+(?:\.\d+)?\s*万円/u,F=document.createElement("template");F.innerHTML=`
  <style></style>
  <div class="root">
    <section class="panel" role="dialog" aria-labelledby="orient-chat-title" aria-modal="false" tabindex="-1" hidden>
      <header class="panel-header">
        <div class="lang-switch">
          <button class="lang-button" type="button" aria-label="言語" aria-expanded="false" aria-haspopup="listbox">
            <span class="lang-current">JA</span>
          </button>
          <div class="lang-menu" role="listbox" hidden>
            <button type="button" data-lang="ja" role="option">日本語</button>
            <button type="button" data-lang="en" role="option">English</button>
            <button type="button" data-lang="zh" role="option">中文</button>
            <button type="button" data-lang="ko" role="option">한국어</button>
          </div>
        </div>
        <div class="cat cat-avatar" data-cat-state="idle" aria-hidden="true"></div>
        <div class="header-copy">
          <h2 id="orient-chat-title">オリにゃんに相談</h2>
        </div>
        <button class="icon-button minimize" type="button" aria-label="チャットを閉じる">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18" /></svg>
        </button>
      </header>
      <div class="campaign-bar" hidden>
        <p class="campaign-timer">
          <span class="campaign-timer-copy">10分キャンペーン終了まで</span>
          <span class="campaign-timer-clock" aria-label="残り時間"><span data-campaign-clock>10:00</span></span>
        </p>
        <p class="campaign-late">
          <span class="campaign-late-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M8.2 3.8c.4-.4 1-.5 1.5-.2l2.1 1.2c.5.3.7.9.5 1.4L11.4 8c-.2.5 0 1.1.4 1.4 1.1.9 2.3 2.1 3.2 3.2.3.4.9.6 1.4.4l1.8-.9c.5-.2 1.1 0 1.4.5l1.2 2.1c.3.5.2 1.1-.2 1.5l-1.2 1.2c-.5.5-1.2.7-1.9.6-1.9-.3-4.6-1.8-7.1-4.3S5.6 8.4 5.3 6.5c-.1-.7.1-1.4.6-1.9z"/></svg>
          </span>
          <span class="campaign-late-text">
            <span class="campaign-late-kicker">10分過ぎても</span>
            <span class="campaign-late-copy">まだ間に合うにゃ！</span>
          </span>
          <a class="campaign-call" href="tel:0120338101">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 3.8c.4-.4 1-.5 1.5-.2l2.1 1.2c.5.3.7.9.5 1.4L11.4 8c-.2.5 0 1.1.4 1.4 1.1.9 2.3 2.1 3.2 3.2.3.4.9.6 1.4.4l1.8-.9c.5-.2 1.1 0 1.4.5l1.2 2.1c.3.5.2 1.1-.2 1.5l-1.2 1.2c-.5.5-1.2.7-1.9.6-1.9-.3-4.6-1.8-7.1-4.3S5.6 8.4 5.3 6.5c-.1-.7.1-1.4.6-1.9z"/></svg>
            今すぐ電話！
          </a>
        </p>
      </div>
      <div class="messages" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="suggestions" aria-label="よくある質問">
        <button type="button" data-question="分譲の特典を見る"><span>🎁</span>特典を見る</button>
        <button type="button" data-question="物件を探す"><span>⌕</span>物件を探す</button>
      </div>
      <form class="composer">
        <label class="sr-only" for="orient-chat-input">メッセージを入力</label>
        <textarea id="orient-chat-input" rows="1" maxlength="2000" placeholder="メッセージを入力"></textarea>
        <button class="send" type="submit" aria-label="送信" disabled>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11.5 17-8-6.5 17-2.8-6.2L3 11.5Z"/><path d="m10.7 14.3 4-4"/></svg>
        </button>
      </form>
      <p class="privacy">
        <a class="privacy-link" target="_blank" rel="noopener">プライバシーポリシー・免責事項</a>
      </p>
      <div class="escalation">
        <a class="call-link" href="tel:0120338101">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 3.8c.4-.4 1-.5 1.5-.2l2.1 1.2c.5.3.7.9.5 1.4L11.4 8c-.2.5 0 1.1.4 1.4 1.1.9 2.3 2.1 3.2 3.2.3.4.9.6 1.4.4l1.8-.9c.5-.2 1.1 0 1.4.5l1.2 2.1c.3.5.2 1.1-.2 1.5l-1.2 1.2c-.5.5-1.2.7-1.9.6-1.9-.3-4.6-1.8-7.1-4.3S5.6 8.4 5.3 6.5c-.1-.7.1-1.4.6-1.9z"/></svg>
          <span class="call-label">電話する</span>
        </a>
        <a class="mail-link" href="mailto:hankyo@orijyu.com?subject=%E3%82%AA%E3%83%AA%E3%81%AB%E3%82%83%E3%82%93%E3%81%B8%E3%81%AE%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B">
          <span class="mail-label">メールでお問い合わせ</span>
        </a>
      </div>
      <div class="turnstile-slot" aria-hidden="true"><slot name="turnstile"></slot></div>
    </section>
    <div class="launcher-dock">
      <span class="launcher-scene" aria-hidden="true">
        <span class="launcher-ring-clip"><span class="launcher-ring"></span></span>
        <span class="launcher-character"><span class="cat cat-launcher" data-cat-state="idle"></span></span>
      </span>
      <button class="launcher" type="button" aria-label="オリにゃんAIに聞くにゃ！" aria-expanded="false">
        <span class="launcher-label">オリにゃんAIに聞くにゃ！</span>
      </button>
    </div>
  </div>
`;const ae=`
  :host {
    --orient-primary: #ff680b;
    --orient-primary-strong: #fd680a;
    --orient-ink: #1f1f2c;
    --orient-muted: #5a5b66;
    --orient-border: #e8e9ee;
    --orient-soft: #f6f6f6;
    --orient-success: #20b866;
    --orient-line: #06c755;
    --orient-asset: url("${re}");
    --orient-gutter-x: 20px;
    --orient-gutter-y: 18px;
    --orient-offset-bottom: 0px;
    display: block;
    position: fixed;
    top: auto;
    right: var(--orient-gutter-x);
    bottom: calc(var(--orient-offset-bottom) + var(--orient-gutter-y));
    left: auto;
    z-index: 2147483000;
    overflow: visible;
    color: var(--orient-ink);
    font-family: "Noto Sans JP", "Yu Gothic", "Hiragino Kaku Gothic ProN", system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.65;
    text-rendering: optimizeLegibility;
  }
  :host(:not([open])) {
    right: 0;
    bottom: var(--orient-offset-bottom);
    width: 312px;
    height: 148px;
    overflow: hidden;
    pointer-events: none;
  }
  :host([open]) {
    width: auto;
    height: auto;
    overflow: visible;
    pointer-events: auto;
  }
  *, *::before, *::after { box-sizing: border-box; }
  button, textarea, a { font: inherit; }
  button, a { -webkit-tap-highlight-color: transparent; }
  button { color: inherit; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  .root { display: grid; justify-items: end; gap: 12px; overflow: visible; }
  .panel {
    width: min(360px, calc(100dvw - 24px));
    max-width: min(360px, calc(100dvw - 24px));
    min-width: 0;
    height: min(640px, calc(100dvh - 16px - var(--orient-offset-bottom) - var(--orient-gutter-y)));
    min-height: 0;
    max-height: calc(100dvh - 16px - var(--orient-offset-bottom) - var(--orient-gutter-y));
    display: grid;
    grid-template-rows: auto auto minmax(160px, 1fr) auto auto auto auto;
    grid-template-areas:
      "header"
      "campaign"
      "messages"
      "suggestions"
      "composer"
      "privacy"
      "escalation";
    overflow: hidden;
    background: #fff;
    border: 1px solid var(--orient-border);
    border-radius: 18px;
    box-shadow: 0 22px 65px rgba(41, 41, 58, .2), 0 4px 16px rgba(41, 41, 58, .08);
    transform-origin: bottom right;
    animation: panel-in 220ms cubic-bezier(.2,.8,.2,1) both;
    position: relative;
  }
  .panel:focus, .panel:focus-visible { outline: none; }
  .panel[hidden] { display: none; }
  .panel-header {
    grid-area: header;
    min-height: 84px;
    display: grid;
    grid-template-columns: auto 54px minmax(0, 1fr) 42px;
    position: relative;
    align-items: center;
    gap: 10px;
    padding: 13px 15px;
    color: #fff;
    background: var(--orient-primary);
  }
  .campaign-bar {
    grid-area: campaign;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    padding: 7px 12px;
    line-height: 1.2;
    color: #6b2800;
    background: linear-gradient(180deg, #fff8f1 0%, #ffe9d4 100%);
    border-bottom: 1px solid #ffd2b5;
  }
  .campaign-timer {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: nowrap;
    line-height: 1.2;
    color: #6b2800;
    font-family: ui-rounded, "Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic", "Trebuchet MS", sans-serif;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: .02em;
  }
  .campaign-timer-copy { line-height: 1.2; white-space: nowrap; }
  .campaign-timer-clock {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 4.2em;
    min-height: 26px;
    padding: 2px 10px;
    line-height: 1;
    border-radius: 999px;
    color: #c44a00;
    background: #fff;
    border: 1.5px solid #ff9d62;
    box-shadow: 0 1px 0 #ffd8bf;
  }
  [data-campaign-clock] {
    display: block;
    color: #c44a00;
    font-family: ui-rounded, "Hiragino Maru Gothic ProN", "Trebuchet MS", "Segoe UI", sans-serif;
    font-size: 18px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: .04em;
    line-height: 1;
  }
  .campaign-bar[data-expired="true"] {
    min-height: 58px;
    padding: 8px 10px;
    color: #24160f;
    background: #fff7f2;
    border-bottom: 1px solid #ffd8c2;
    box-shadow: none;
  }
  .campaign-bar[data-expired="true"] .campaign-timer { display: none; }
  .campaign-late {
    display: none;
    width: 100%;
    margin: 0;
    align-items: stretch;
    justify-content: space-between;
    gap: 0;
    min-width: 0;
    min-height: 46px;
    padding: 0 0 0 14px;
    overflow: hidden;
    border: 1px solid #ffd0b4;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 8px 18px rgba(255, 104, 11, .08);
  }
  .campaign-bar[data-expired="true"] .campaign-late { display: flex; }
  .campaign-late-icon { display: none; }
  .campaign-call svg {
    width: 15px;
    height: 15px;
    fill: currentColor;
  }
  .campaign-late-text {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
    min-width: 0;
    flex: 1 1 auto;
    padding: 6px 10px 6px 0;
    font-family: ui-rounded, "Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic", "Trebuchet MS", sans-serif;
  }
  .campaign-late-kicker {
    color: #ff680b;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .02em;
    line-height: 1.2;
  }
  .campaign-late-copy {
    color: #24160f;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: .01em;
    line-height: 1.2;
  }
  .campaign-call {
    display: inline-flex;
    flex: 0 0 auto;
    align-self: stretch;
    min-height: 46px;
    padding: 0 14px;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: 0;
    color: #fff;
    background: #ff680b;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: .02em;
    text-decoration: none;
    white-space: nowrap;
  }
  .campaign-call:hover, .campaign-call:focus-visible {
    color: #fff;
    background: #f25a00;
    outline: 2px solid rgba(255, 104, 11, .35);
    outline-offset: -2px;
  }
  .header-copy h2 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: .02em; }
  .lang-switch { position: relative; }
  .lang-button { min-width: 36px; height: 32px; padding: 0 8px; border: 1px solid rgba(255,255,255,.5); border-radius: 999px; color: #fff; background: rgba(255,255,255,.16); font-size: 12px; font-weight: 800; letter-spacing: .04em; cursor: pointer; }
  .lang-button:hover, .lang-button:focus-visible { background: rgba(255,255,255,.28); outline: none; }
  .lang-menu { position: absolute; top: calc(100% + 8px); left: 0; z-index: 6; display: grid; gap: 4px; min-width: 120px; padding: 6px; border-radius: 12px; background: #fff; box-shadow: 0 12px 28px rgba(41,41,58,.2); }
  .lang-menu[hidden] { display: none; }
  .lang-menu button { min-height: 36px; padding: 0 10px; border: 0; border-radius: 8px; color: #24160f; background: #fff7f2; font-size: 13px; font-weight: 800; text-align: left; cursor: pointer; }
  .lang-menu button[aria-selected="true"] { color: #fff; background: var(--orient-primary); }
  .lang-menu button:focus-visible { outline: 2px solid rgba(255,104,11,.35); outline-offset: 1px; }
  .icon-button { width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 10px; color: #fff; background: transparent; cursor: pointer; }
  .icon-button:hover, .icon-button:focus-visible { background: rgba(255,255,255,.18); outline: none; }
  .icon-button svg { width: 25px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .messages { grid-area: messages; min-height: 0; overflow-anchor: none; overflow: auto; overscroll-behavior: contain; padding: 16px 12px 12px; background: #d5e4f3; scrollbar-width: thin; scrollbar-color: #9eb6cc transparent; }
  .message { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 12px; animation: message-in 180ms ease-out both; }
  .message.user { justify-content: flex-end; padding-left: 42px; }
  .message:not(.user) { align-items: flex-start; padding-right: 18px; }
  .message .cat { width: 36px; height: 36px; flex: 0 0 36px; border: 2px solid #fff; border-radius: 50%; background-color: #fff; box-shadow: 0 1px 2px rgba(31, 45, 61, .12); }
  .bubble { isolation: isolate; position: relative; width: fit-content; max-width: 100%; padding: 10px 12px; color: var(--orient-ink); background: #fff; border-radius: 6px 18px 18px 18px; font-size: 16px; font-weight: 500; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; box-shadow: 0 1px 1px rgba(31, 45, 61, .08); }
  .bubble::after { content: ""; position: absolute; z-index: -1; width: 12px; height: 16px; border: 0; background: #fff; }
  .message:not(.user) .bubble::after { top: 10px; left: -7px; border-top-left-radius: 12px; border-bottom-left-radius: 12px; }
  .answer-em { font-weight: 800; color: #1a1a24; }
  .user .bubble { color: #fff; background: #ff680b; border-radius: 18px; }
  .user .bubble::after { content: none; }
  .message-content { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; max-width: calc(100% - 44px); }
  .message:not(.user) .message-content { flex: 1 1 auto; width: 100%; }
  .message-choices, .message-picker, .more-results { align-self: stretch; max-width: 100%; }
  .message-call { align-self: flex-start; max-width: 100%; }
  .user .message-content { flex: 0 1 auto; align-items: flex-end; width: auto; max-width: 78%; }
  .inline-source { display: inline-flex; align-items: center; margin: 3px 0 3px 5px; padding: 3px 8px; color: var(--orient-primary-strong); border: 1px solid #ffb98d; border-radius: 999px; background: #fffaf7; font-size: 10px; font-weight: 800; line-height: 1.5; text-decoration: none; vertical-align: middle; white-space: nowrap; }
  .inline-source:hover, .inline-source:focus-visible { border-color: var(--orient-primary); background: #fff1e8; outline: 2px solid rgba(255,104,11,.18); outline-offset: 1px; }
  .answer-url { color: var(--orient-primary-strong); font-weight: 700; text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 2px; overflow-wrap: anywhere; word-break: break-all; }
  .answer-url:hover, .answer-url:focus-visible { color: var(--orient-primary); outline: 2px solid rgba(255,104,11,.18); outline-offset: 1px; }
  .message-call { display: inline-flex; align-items: center; gap: 8px; margin-top: 8px; min-height: 44px; padding: 8px 14px 8px 8px; border-radius: 999px; color: #fff; background: #ff680b; font-size: 13px; font-weight: 800; line-height: 1.35; text-decoration: none; box-shadow: 0 1px 0 rgba(180, 62, 0, .35); }
  .message-call svg { width: 28px; height: 28px; padding: 6px; box-sizing: border-box; border-radius: 50%; background: rgba(255,255,255,.22); fill: currentColor; flex: 0 0 28px; overflow: visible; }
  .message-call-num { white-space: nowrap; }
  .message-call:hover, .message-call:focus-visible { color: #fff; background: #f25a00; outline: 2px solid rgba(255,104,11,.35); outline-offset: 2px; }
  .more-results { margin-top: 9px; }
  .more-results-button { min-height: 36px; padding: 7px 14px; border: 1px solid #ffc49f; border-radius: 999px; color: var(--orient-primary-strong); background: #fffaf7; font-size: 13px; font-weight: 800; cursor: pointer; transition: transform 120ms ease, border-color 120ms ease, background 120ms ease; }
  .more-results-button:focus-visible { transform: translateY(-1px); border-color: var(--orient-primary); background: #ffede2; outline: 2px solid rgba(255,104,11,.2); outline-offset: 1px; }
  .more-results-button:active { transform: translateY(0); }
  .more-results-button:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .thinking-label { display: inline-flex; align-items: center; min-height: 24px; color: var(--orient-muted); font-size: 13px; font-weight: 700; letter-spacing: .01em; }
  .thinking-copy { white-space: nowrap; }
  .thinking-dots {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 6px;
    height: 12px;
  }
  .thinking-dots span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--orient-primary);
    opacity: .45;
  }
  .message-choices { margin-top: 9px; animation: choices-in 180ms ease-out both; }
  .choice-label { margin: 0 0 6px; color: var(--orient-muted); font-size: 12px; font-weight: 700; letter-spacing: .03em; }
  .choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; scrollbar-width: thin; }
  .choice-grid[data-count="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .choice-grid[data-count="1"] { grid-template-columns: minmax(0, 1fr); }
  .choice-button { min-width: 0; min-height: 42px; padding: 8px 9px; border: 1px solid #ffc49f; border-radius: 10px; color: #4a2a1a; background: #fffaf7; font-size: 14px; font-weight: 800; line-height: 1.4; overflow-wrap: anywhere; cursor: pointer; transition: transform 120ms ease, border-color 120ms ease, background 120ms ease; }
  .choice-button[data-tone="primary"] { border-color: var(--orient-primary); color: var(--orient-primary-strong); background: #fff3eb; }
  .choice-button:focus-visible { transform: translateY(-1px); border-color: var(--orient-primary); background: #ffede2; outline: 2px solid rgba(255,104,11,.2); outline-offset: 1px; }
  .choice-button:focus:not(:focus-visible) { outline: none; transform: none; }
  .choice-button:active { transform: translateY(0); }
  .choice-button:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .choice-button:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .choice-grid[data-count="3"] .choice-button:last-child:nth-child(odd) { grid-column: auto; }
  .choice-compact { display: flex; justify-content: center; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .choice-grid + .choice-compact { margin-top: 8px; }
  .choice-button.compact {
    min-height: 32px;
    padding: 5px 13px;
    border-color: #e0e1e6;
    border-radius: 999px;
    color: var(--orient-muted);
    background: #fff;
    font-size: 13px;
    font-weight: 700;
  }
  .choice-button.compact:focus-visible {
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
  .oc-cal-nav button:focus-visible { background: #ffede2; outline: 2px solid rgba(255,104,11,.2); outline-offset: 1px; }
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
  .oc-cal-day:focus-visible:not(:disabled) { background: #fff5ef; outline: 2px solid rgba(255,104,11,.18); outline-offset: 0; }
  .oc-cal-day:disabled { color: #d0d1d7; cursor: default; }
  .oc-cal-day[data-selected="true"] { color: #fff; background: var(--orient-primary); }
  .oc-cal-day[data-selected="true"]:focus-visible:not(:disabled) { background: var(--orient-primary-strong); }
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
  .oc-cal-submit:focus-visible { background: var(--orient-primary-strong); outline: 2px solid rgba(255,104,11,.2); outline-offset: 1px; }
  .oc-cal-submit:disabled { opacity: .45; cursor: not-allowed; }
  .suggestions { grid-area: suggestions; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; padding: 9px 14px 11px; border-top: 1px solid var(--orient-border); overflow: visible; }
  .composer.locked { opacity: .55; }
  .suggestions button { position: relative; min-width: 0; min-height: 42px; padding: 8px 6px; border: 0; border-radius: 12px; background: transparent; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 180ms ease, box-shadow 180ms ease; }
  .suggestions button span { display: block; color: var(--orient-primary); font-size: 17px; line-height: 1; }
  .suggestions button:focus-visible { background: #fff5ef; outline: 2px solid rgba(255,104,11,.25); outline-offset: 1px; }
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
  }
  .suggestions button.ready-pop span {
    display: block;
  }
  .chunky {
    position: relative;
    border-color: transparent;
    background: transparent;
    background-image: none;
    box-shadow: none;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .chunky__svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }
  .chunky__label {
    position: absolute;
    top: 40%;
    left: 50%;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(100% - 14px);
    max-width: calc(100% - 14px);
    pointer-events: none;
    text-align: center;
    color: inherit;
    font: inherit;
    line-height: 1.35;
    transform: translate(-50%, -50%);
    overflow-wrap: anywhere;
  }
  .chunky[data-pressed="1"] > .chunky__label { top: 48.4%; }
  .choice-button.compact > .chunky__label,
  .more-results-button > .chunky__label {
    width: max-content;
    max-width: none;
    white-space: nowrap;
  }
  .suggestions button > .chunky__label,
  .suggestions button.ready-pop > .chunky__label {
    flex-direction: column;
    gap: 1px;
    width: max-content;
    max-width: calc(100% - 8px);
    color: inherit;
    font-size: inherit;
    font-weight: inherit;
    line-height: 1.2;
    white-space: nowrap;
  }
  .suggestions button > .chunky__label > span { margin-right: 0; }
  .chunky:focus-visible {
    outline: 2px solid rgba(255,104,11,.45);
    outline-offset: 3px;
    background: transparent;
    transform: none;
  }
  .chunky:focus:not(:focus-visible),
  .chunky:active { outline: none; background: transparent; transform: none; }
  .composer { grid-area: composer; display: grid; grid-template-columns: minmax(0, 1fr) 54px; gap: 8px; align-items: end; margin: 0 14px 4px; padding: 0; border: 0; border-radius: 0; background: transparent; }
  .composer:focus-within { box-shadow: none; }
  textarea { width: 100%; min-width: 0; max-height: 92px; min-height: 46px; resize: none; padding: 10px 12px; border: 1px solid #d9dce3; border-radius: 12px; outline: 0; color: var(--orient-ink); background: #fff; line-height: 1.5; }
  textarea:focus { border-color: #b7bcc6; }
  textarea::placeholder { color: #a7a8b0; }
  .send { width: 54px; min-width: 54px; max-width: 54px; height: 54px; min-height: 54px; max-height: 54px; display: grid; place-items: center; align-self: end; padding: 0; border: 0; border-radius: 12px; color: var(--orient-primary); background: transparent; cursor: pointer; }
  .send:disabled { opacity: .45; cursor: not-allowed; }
  .send .chunky__label svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .privacy { grid-area: privacy; margin: 4px 18px 6px; color: var(--orient-muted); font-size: 10px; }
  .privacy::before { content: "▣"; margin-right: 5px; }
  .privacy-link { color: var(--orient-ink); font-weight: 700; text-decoration: underline; text-decoration-color: var(--orient-primary); text-underline-offset: 2px; }
  .privacy-link:hover, .privacy-link:focus-visible { color: var(--orient-primary-strong); outline: none; }
  .escalation {
    grid-area: escalation;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 0 16px 10px;
  }
  .call-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: auto;
    min-width: 0;
    min-height: 36px;
    padding: 4px 8px;
    border: 0;
    border-radius: 10px;
    color: #fff;
    background: #ff680b;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: .02em;
    line-height: 1.2;
    text-decoration: none;
  }
  .call-link svg {
    width: 22px;
    height: 22px;
    padding: 4px;
    box-sizing: border-box;
    border-radius: 50%;
    background: rgba(255,255,255,.22);
    fill: currentColor;
    flex: 0 0 22px;
    overflow: visible;
  }
  .call-link:hover, .call-link:focus-visible {
    color: #fff;
    background: #f25a00;
    outline: 2px solid rgba(255, 104, 11, .28);
    outline-offset: 2px;
  }
  .mail-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 36px;
    padding: 4px 8px;
    border-radius: 10px;
    color: #fff;
    background: #ff680b;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .01em;
    line-height: 1.25;
    text-align: center;
    text-decoration: none;
  }
  .mail-link:hover, .mail-link:focus-visible {
    color: #fff;
    background: #f25a00;
    outline: 2px solid rgba(255, 104, 11, .28);
    outline-offset: 2px;
  }
  .call-label, .mail-label { min-width: 0; }
  .turnstile-slot { position: absolute; inset: 0; z-index: 40; display: none; }
  .turnstile-slot.is-active { display: grid; place-items: center; pointer-events: none; }
  .turnstile-slot.is-visible { pointer-events: auto; background: rgba(31, 31, 44, .55); }
  .turnstile-slot slot { display: block; width: 300px; max-width: calc(100% - 32px); min-height: 65px; }
  .cat { background-image: var(--orient-asset); background-repeat: no-repeat; background-size: 200% 200%; background-position: 0 0; }
  .cat[data-cat-state="listening"] { background-position: 100% 0; }
  .cat[data-cat-state="speaking"] { background-position: 0 100%; }
  .cat[data-cat-state="thinking"] { background-position: 100% 100%; }
  .cat-avatar { width: 52px; height: 52px; border: 3px solid rgba(255,255,255,.88); border-radius: 50%; background-color: #fff; }
  .launcher-dock { width: 312px; height: 148px; position: relative; overflow: hidden; }
  .launcher { width: 100%; height: 100%; position: absolute; inset: 0; z-index: 3; overflow: visible; border: 0; background: transparent; cursor: pointer; appearance: none; -webkit-appearance: none; pointer-events: auto; }
  .launcher-scene { position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
  .launcher-ring-clip { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .launcher-ring {
    width: 296px;
    height: 296px;
    position: absolute;
    right: -148px;
    bottom: -148px;
    z-index: 1;
    display: block;
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--orient-primary);
    box-shadow: none;
  }
  .launcher-character {
    width: 152px;
    height: 152px;
    position: absolute;
    right: -6px;
    bottom: -18px;
    z-index: 2;
    filter: drop-shadow(0 6px 8px rgba(41,41,58,.22));
    transform-origin: 52% 92%;
    animation: launcher-peek 3.6s cubic-bezier(.45,0,.25,1) infinite;
    will-change: transform;
  }
  .cat-launcher { width: 100%; height: 100%; display: block; }
  .launcher-label {
    min-height: 34px;
    position: absolute;
    right: 118px;
    bottom: 58px;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    padding: 8px 14px;
    color: #fff;
    border: 1px solid rgba(255,255,255,.2);
    border-radius: 999px;
    background: var(--orient-ink);
    box-shadow: 0 7px 16px rgba(41,41,58,.22);
    font-size: 12px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: .01em;
    white-space: nowrap;
    transition: transform 180ms ease, background 180ms ease, box-shadow 180ms ease;
  }
  .launcher-label::after {
    content: "";
    width: 0;
    height: 0;
    position: absolute;
    right: -8px;
    top: 50%;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-left: 9px solid var(--orient-ink);
    transform: translateY(-50%);
    transition: border-left-color 180ms ease;
  }
  .launcher-dock:hover .launcher-character, .launcher-dock:focus-within .launcher-character { animation: launcher-greet .72s cubic-bezier(.2,.8,.2,1) both; }
  .launcher-dock:hover .cat-launcher, .launcher-dock:focus-within .cat-launcher { background-position: 0 100%; }
  .launcher-dock:hover .launcher-label { transform: translateX(-3px); background: #20202f; box-shadow: 0 9px 20px rgba(41,41,58,.26); }
  .launcher-dock:hover .launcher-label::after { border-left-color: #20202f; }
  .launcher:focus-visible { outline: none; }
  .launcher:focus-visible .launcher-label { box-shadow: 0 0 0 4px rgba(255,104,11,.26), 0 7px 16px rgba(41,41,58,.22); }
  :host([open]) .launcher-dock { display: none; }
  .cat[data-cat-state="listening"] { animation: listen 1.4s ease-in-out infinite; }
  .cat[data-cat-state="speaking"] { animation: speak .42s ease-in-out infinite alternate; }
  .cat[data-cat-state="thinking"] { animation: think 1.5s ease-in-out infinite; }
  @keyframes panel-in { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }
  @keyframes message-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes choices-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes launcher-peek { 0%,100% { transform: translateY(1px) rotate(-1deg); } 42% { transform: translateY(-3px) rotate(.6deg); } 62% { transform: translateY(-1px) rotate(-.3deg); } }
  @keyframes launcher-greet { 0% { transform: translateY(2px) rotate(0); } 30% { transform: translateY(2px) rotate(5deg); } 58% { transform: translateY(2px) rotate(-4deg); } 78% { transform: translateY(2px) rotate(3deg); } 100% { transform: translateY(2px) rotate(0); } }
  @keyframes listen { 0%,100% { transform: rotate(0); } 50% { transform: rotate(2deg); } }
  @keyframes speak { from { transform: translateY(0); } to { transform: translateY(-2px); } }
  @keyframes think { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px) rotate(-1deg); } }
  @media (hover: hover) and (pointer: fine) {
    .oc-cal-nav button:hover { background: #ffede2; }
    .oc-cal-day:hover:not(:disabled) { background: #fff5ef; }
    .oc-cal-day[data-selected="true"]:hover:not(:disabled) { background: var(--orient-primary-strong); }
    .oc-cal-submit:hover { background: var(--orient-primary-strong); }
  }
  @media (max-width: 736px) {
    :host {
      --orient-gutter-x: 0px;
      --orient-gutter-y: 0px;
      --orient-offset-bottom: 50px;
      left: auto;
      right: 0;
    }
    :host(:not([open])) {
      bottom: 0;
      width: 268px;
      height: calc(104px + var(--orient-offset-bottom));
      overflow: hidden;
      pointer-events: none;
      z-index: 9999;
    }
    :host([open]) {
      width: auto;
      height: auto;
      right: 8px;
      bottom: calc(var(--orient-offset-bottom) + var(--orient-gutter-y));
      overflow: visible;
      pointer-events: auto;
      z-index: 2147483000;
    }
    :host([open]) .root { height: auto; overflow: visible; }
    .root { width: 100%; height: 100%; overflow: hidden; }
    .launcher-dock {
      width: 268px;
      height: 100%;
      overflow: hidden;
      pointer-events: none;
    }
    .launcher {
      top: 0;
      right: 0;
      left: 0;
      bottom: var(--orient-offset-bottom);
      width: auto;
      height: auto;
      pointer-events: auto;
    }
    .launcher-scene, .launcher-ring-clip { overflow: hidden; }
    .launcher-ring-clip { inset: 0; }
    .launcher-ring {
      width: 208px;
      height: 208px;
      right: -104px;
      bottom: calc(var(--orient-offset-bottom) - 104px);
      border: 2px solid #fff;
      box-shadow: none;
    }
    .launcher-character {
      width: 100px;
      height: 100px;
      right: -2px;
      bottom: calc(var(--orient-offset-bottom) - 4px);
      animation: launcher-peek-mobile 3.6s cubic-bezier(.45,0,.25,1) infinite;
    }
    .launcher-label {
      right: 76px;
      bottom: 44px;
      font-size: 11px;
      font-weight: 800;
      padding: 7px 12px;
      min-height: 28px;
    }
    .launcher-label::after {
      right: -7px;
      top: 50%;
      bottom: auto;
      transform: translateY(-50%);
    }
    @keyframes launcher-peek-mobile {
      0%,100% { transform: translateY(1px) rotate(-1deg); }
      42% { transform: translateY(-3px) rotate(.5deg); }
      62% { transform: translateY(-1px) rotate(-.3deg); }
    }
    .panel-header { min-height: 52px; padding: 7px 10px; gap: 8px; grid-template-columns: auto 34px minmax(0, 1fr) 34px; }
    .header-copy h2 { font-size: 14px; }
    .lang-button { min-width: 32px; height: 28px; padding: 0 6px; font-size: 11px; }
    .cat-avatar { width: 34px; height: 34px; border-width: 2px; }
    .icon-button { width: 34px; height: 34px; }
    .icon-button svg { width: 20px; }
    .messages { padding: 12px 12px 8px; }
    .message { gap: 6px; margin-bottom: 10px; }
    .message .cat { width: 32px; height: 32px; flex-basis: 32px; }
    .message:not(.user) .bubble::after { top: 8px; left: -5px; }
    .campaign-bar { min-height: 36px; padding: 6px 10px; }
    .campaign-timer { font-size: 12px; }
    [data-campaign-clock] { font-size: 17px; }
    .campaign-timer-clock { min-height: 24px; }
    .campaign-bar[data-expired="true"] { min-height: 54px; padding: 7px 8px; }
    .campaign-late { min-height: 42px; padding-left: 12px; border-radius: 12px; }
    .campaign-late-kicker { font-size: 10px; }
    .campaign-late-copy { font-size: 15px; }
    .campaign-call { min-height: 42px; font-size: 12px; padding: 0 12px; }
    .bubble { padding: 10px 12px; font-size: 15px; }
    .suggestions { padding: 6px 10px 5px; gap: 6px; }
    .suggestions button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 4px 8px;
      font-size: 13px;
      line-height: 1.2;
      white-space: nowrap;
    }
    .suggestions button span,
    .suggestions button.ready-pop span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 13px;
      height: 13px;
      margin-right: 4px;
      font-size: 12px;
      line-height: 1;
      flex: 0 0 auto;
    }
    .suggestions button > .chunky__label,
    .suggestions button.ready-pop > .chunky__label {
      flex-direction: row;
      gap: 4px;
      width: max-content;
      height: auto;
      margin-right: 0;
      font-size: inherit;
    }
    .composer { margin: 0 10px 2px; gap: 6px; grid-template-columns: minmax(0, 1fr) 48px; }
    textarea { min-height: 42px; padding: 8px 10px; font-size: 16px; }
    .send { width: 48px; min-width: 48px; max-width: 48px; height: 48px; min-height: 48px; max-height: 48px; }
    .send .chunky__label svg { width: 20px; height: 20px; }
    .privacy { margin: 2px 12px 4px; font-size: 9px; }
    .escalation { padding: 0 10px 8px; }
    .call-link, .mail-link { min-height: 34px; font-size: 11px; padding: 4px 6px; }
    .call-link svg { width: 20px; height: 20px; flex-basis: 20px; padding: 3px; }
  }
  @media (max-width: 520px) {
    :host {
      --orient-gutter-x: 0px;
      --orient-gutter-y: 0px;
      left: auto;
      right: 0;
    }
    :host(:not([open])) { overflow: hidden; }
    :host([open]) {
      left: auto;
      right: 8px;
      overflow: visible;
    }
    .root { width: auto; justify-items: end; }
    .panel {
      width: min(360px, calc(100dvw - 16px));
      height: min(640px, calc(100dvh - 12px - var(--orient-offset-bottom) - var(--orient-gutter-y)));
      min-height: 0;
      max-height: calc(100dvh - 12px - var(--orient-offset-bottom) - var(--orient-gutter-y));
      border-radius: 16px;
    }
    .panel-header { min-height: 46px; padding: 5px 8px; gap: 6px; grid-template-columns: auto 30px minmax(0, 1fr) 30px; }
    .header-copy h2 { font-size: 13px; }
    .lang-button { min-width: 30px; height: 26px; font-size: 10px; }
    .cat-avatar { width: 30px; height: 30px; }
    .icon-button { width: 30px; height: 30px; }
    .icon-button svg { width: 18px; }
    .messages { padding: 8px 10px 6px; }
    .suggestions { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 5px 8px 4px; gap: 5px; }
    .suggestions button { font-size: 12px; min-height: 36px; padding: 4px 6px; }
    .choice-grid[data-count="3"] { gap: 5px; }
    .choice-grid[data-count="6"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .choice-button { min-height: 40px; padding-inline: 6px; font-size: 13px; }
    .choice-button.compact { min-height: 32px; padding: 5px 12px; font-size: 12px; }
    .oc-cal-day { min-height: 42px; }
    .oc-picker-datetime { padding: 8px; }
    .composer { margin: 0 8px; }
    .privacy { margin: 1px 10px 3px; }
    .escalation { padding: 0 8px 7px; }
    .call-link, .mail-link { min-height: 34px; font-size: 11px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .panel, .message, .message-choices, .message-picker, .launcher-character, .cat { animation: none !important; }
  }
`;const ORI_LANGS=["ja","en","zh","ko"];const ORI_UI={ja:{code:"JA",title:"オリにゃんに相談",close:"チャットを閉じる",timer:"10分キャンペーン終了まで",lateKicker:"10分過ぎても",lateCopy:"まだ間に合うにゃ！",call:"今すぐ電話！",perk:"特典を見る",search:"物件を探す",placeholder:"メッセージを入力",send:"送信",privacy:"プライバシーポリシー・免責事項",line:"公式LINE",mail:"メールでお問い合わせ",launcher:"オリにゃんAIに聞くにゃ！",lang:"言語",thinking:"オリにゃんが考えています",tap:"タップして選べるにゃん",guide:"会話の案内から選んでにゃん",input:"メッセージを入力",page:"公式ページを開く",lineAsk:"詳しくは 0120-338-101 に電話してにゃん",callButton:"電話する",more:"もっと見たい",detail:"詳細を見る ↗",choices:"回答候補",choiceItems:"回答候補の選択肢",otherActions:"その他の操作"},en:{code:"EN",title:"Ask Orinyan",close:"Close chat",timer:"10-minute offer ends in",lateKicker:"Past 10 minutes",lateCopy:"You can still make it!",call:"Call now",perk:"See offer",search:"Find a home",placeholder:"Type a message",send:"Send",privacy:"Privacy policy",line:"Official LINE",mail:"Email us",launcher:"Ask Orinyan!",lang:"Language",thinking:"Orinyan is thinking",tap:"Tap to choose",guide:"Please use the buttons",input:"Message",page:"Open the official page",lineAsk:"Call 0120-338-101 for the details",callButton:"Call",more:"See more",detail:"View details ↗",choices:"Reply options",choiceItems:"Choices",otherActions:"Other actions"},zh:{code:"中",title:"问问奥利喵",close:"关闭聊天",timer:"10分钟优惠剩余",lateKicker:"超过10分钟",lateCopy:"现在也来得及！",call:"立即致电",perk:"查看优惠",search:"找房",placeholder:"输入消息",send:"发送",privacy:"隐私政策",line:"官方LINE",mail:"邮件咨询",launcher:"问问奥利喵！",lang:"语言",thinking:"奥利喵正在想",tap:"点按选择",guide:"请使用按钮",input:"消息",page:"打开官方页面",lineAsk:"详情请致电 0120-338-101",callButton:"致电",more:"查看更多",detail:"查看详情 ↗",choices:"回答选项",choiceItems:"选项",otherActions:"其他操作"},ko:{code:"한",title:"오리냥에게 상담",close:"채팅 닫기",timer:"10분 혜택 종료까지",lateKicker:"10분이 지나도",lateCopy:"아직 늦지 않았어!",call:"지금 전화",perk:"혜택 보기",search:"매물 찾기",placeholder:"메시지를 입력",send:"보내기",privacy:"개인정보 처리방침",line:"공식 LINE",mail:"메일로 문의",launcher:"오리냥에게 물어봐!",lang:"언어",thinking:"오리냥이 생각 중",tap:"눌러서 선택",guide:"버튼을 골라 줘",input:"메시지",page:"공식 페이지 열기",lineAsk:"자세한 내용은 0120-338-101로 전화해",callButton:"전화",more:"더 보기",detail:"자세히 보기 ↗",choices:"답변 후보",choiceItems:"선택지",otherActions:"다른 조작"}};const ORI_PHRASES=[["待ち時間に、下のよくある質問を見ておけるにゃん。","While you wait, the common questions below are ready.","等待时可以先看下面的常见问题。","기다리는 동안 아래의 자주 묻는 질문을 볼 수 있어."],["よくある質問","Common questions","常见问题","자주 묻는 질문"],["自社物件は、**坪59万円**くらいからが目安だにゃん。\n土地や仕様で変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Company homes start around **590,000 yen per tsubo**. Land and specifications change the price, so ask the staff member who contacts you for the latest details.","自社房源大约从**每坪59万日元**起。土地和规格会改变价格，最新内容请向联系你的负责人确认。","자사 매물은 **평당 59만 엔** 정도가 기준이야. 땅과 사양에 따라 달라지니, 최신 내용은 연락하는 담당자에게 물어봐."],["**ZEH対応住宅**も相談できるにゃん。\nプランによって仕様が違うから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","**ZEH-ready homes** are available too. The specification depends on the plan, so ask the staff member who contacts you for the latest details.","也可以咨询**ZEH节能住宅**。规格因方案而异，最新内容请向联系你的负责人确认。","**ZEH 주택**도 상담할 수 있어. 플랜마다 사양이 다르니, 최신 내용은 연락하는 담당자에게 물어봐."],["**長期優良住宅**も相談できるにゃん。\n認定できるかはプランによるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","**Long-life quality homes** are available too. Certification depends on the plan, so ask the staff member who contacts you for the latest details.","也可以咨询**长期优良住宅**。能否认定因方案而异，最新内容请向联系你的负责人确认。","**장기우량주택**도 상담할 수 있어. 인정 가능 여부는 플랜에 따라 다르니, 최신 내용은 연락하는 담당자에게 물어봐."],["住宅ローンの相談もできるにゃん。\n金利や審査は時期で変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Mortgage advice is available too. Rates and screening change, so ask the staff member who contacts you for the latest details.","也可以咨询房贷。利率和审查会变化，最新内容请向联系你的负责人确认。","주택 대출 상담도 할 수 있어. 금리와 심사는 시기에 따라 달라지니, 최신 내용은 연락하는 담당자에게 물어봐."],["見学や内見の希望は伝えられるにゃん。\n空いている日時は変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","You can tell us when you would like to visit. Open times change, so ask the staff member who contacts you for the latest details.","可以告诉负责人希望的看房时间。空档会变化，最新内容请向联系你的负责人确认。","방문하고 싶은 일정을 전달할 수 있어. 빈 시간은 달라지니, 최신 내용은 연락하는 담당자에게 물어봐."],["初期費用は物件ごとに違うにゃん。\n敷金・礼金・仲介手数料の金額は変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Upfront costs differ by home. Deposits and brokerage fees change, so ask the staff member who contacts you for the latest details.","初期费用因房源而异。押金和中介费会变化，最新内容请向联系你的负责人确认。","초기 비용은 매물마다 달라. 보증금과 중개수수료는 변하니, 최신 내용은 연락하는 담당자에게 물어봐."],["あなたに会えて、とってもうれしいにゃん。","Nice to meet you.","很高兴见到你。","만나서 반가워."],["キャンペーン開催中だにゃん。","A campaign is on.","活动进行中。","캠페인 중이야."],["今から**10分以内**なら、**＋500円クオカード**がつくにゃん。","Apply within **10 minutes** and get an extra **500-yen QUO card**.","**10分钟内**申请，再加一张**500日元QUO卡**。","**10분 안에** 신청하면 **500엔 쿠오카드**가 더 붙어."],["まずは相談内容を1つ選んでにゃん。","Pick one topic to start.","先选一个咨询内容。","상담 내용을 하나 골라 줘."],["お問い合わせ完了で **500円クオカード**","**500-yen QUO card** when your inquiry is complete","咨询完成即送 **500日元QUO卡**","문의가 끝나면 **500엔 쿠오카드**"],["成約すると、家のオプションに **50万ポイント**","On contract, **500,000 points** go toward home options","成交后，把 **50万积分** 用在房屋选配上","계약하면 집 옵션에 **50만 포인트**"],["申し込むか、物件を探すか、選んでにゃん。","Apply, or look at homes.","申请，或者先看房。","신청할지, 매물을 볼지 골라 줘."],["【購入】","[Buy]","【购买】","【구매】"],["【賃貸】","[Rent] ","【租赁】","【임대】 "],["【注文住宅】","[Custom home]","【定制住宅】","【주문주택】"],["・成約 **10,000円クオカード**","- **10,000-yen QUO card** on contract","・成交 **10,000日元QUO卡**","・계약 시 **10,000엔 쿠오카드**"],["特典の申し込みだにゃん。\n**お名前**を教えてにゃん。","Let's apply.\nWhat's your **name**?","来申请优惠吧。\n请告诉我**姓名**。","혜택 신청이야.\n**이름**을 알려 줘."],["さんだにゃん。次にご住所を教えてにゃん。\n**番地まで**書ける範囲で大丈夫だにゃん。","— got it. Next, your address.\nThe **street number** is enough if you have it.","— 收到。接下来告诉我地址。\n能写到**门牌号**就可以。","님, 다음은 주소야.\n**번지**까지 쓸 수 있는 만큼이면 돼."],["**お電話番号**を教えてにゃん。担当からのご連絡に使うにゃん。","Your **phone number**, please. Staff will use it to reach you.","请告诉我**电话号码**。负责人会用来联系你。","**전화번호**를 알려 줘. 담당자가 연락할 때 써."],["お問い合わせ完了で**500円クオカード**だにゃん。","Your inquiry includes a **500-yen QUO card**.","咨询完成就有**500日元QUO卡**。","문의가 끝나면 **500엔 쿠오카드**야."],["**10分以内**だから**＋500円クオカード**もつくにゃん。","It's within **10 minutes**, so you also get **+500 yen QUO card**.","还在**10分钟内**，再加一张**500日元QUO卡**。","**10분 안**이라 **500엔 쿠오카드**가 더 붙어."],["今月の成約特典の対象だにゃん。","This month's contract offer still applies.","这个月的成交优惠仍然适用。","이번 달 계약 혜택 대상이야."],["希望のエリアや予算、間取りがあれば教えてにゃん。","Share an area, budget, or layout if you have one.","如果有想要的区域、预算或户型，告诉我。","원하는 지역, 예산, 구조가 있으면 알려 줘."],["担当からご連絡するにゃん。特典のこともあわせて説明するにゃん。","Staff will contact you and explain the offer too.","负责人会联系你，并一起说明优惠。","담당자가 연락해서 혜택도 설명할 거야."],["見学の予約や、先に物件を見ることもできるにゃん。","You can book a visit, or look at homes first.","也可以预约参观，或先看房。","견학 예약도, 먼저 매물을 보는 것도 가능해."],["自社物の場合は、**坪59万円**くらいが目安だにゃん。","For our own homes, about **590,000 yen per tsubo**.","自有房源大约是**每坪59万日元**。","자사 매물은 **평당 59만 엔** 정도가 기준이야."],["**長期優良住宅**や、**ZEH対応住宅**も可能だにゃん。","**Long-life quality housing** and **ZEH** homes are possible.","也可以做**长期优良住宅**和**ZEH住宅**。","**장기우량주택**과 **ZEH 주택**도 가능해."],["詳しくは担当者にご連絡ください。","Please contact staff for details.","详情请联系负责人。","자세한 내용은 담당자에게 연락해 줘."],["希望のエリアは、担当者にご連絡ください。","For the area you want, please contact staff.","想要的区域，请联系负责人。","원하는 지역은 담당자에게 연락해 줘."],["物件ごとに価格が違うにゃん。気になる物件の価格は、担当者にご連絡ください。","Prices differ by home. Ask staff about a home you like.","每套房价格不同。想了解的房价请联系负责人。","매물마다 가격이 달라. 궁금한 가격은 담당자에게 연락해 줘."],["住宅ローンの相談もできるにゃん。金利や審査のことは、担当者にご連絡ください。","We can talk through a mortgage. Ask staff about rates and screening.","也可以咨询房贷。利率和审核请联系负责人。","주택대출 상담도 가능해. 금리와 심사는 담당자에게 연락해 줘."],["内見、申し込み、ご契約の順で進むにゃん。","It goes viewing, application, then contract.","顺序是看房、申请、签约。","집 보기, 신청, 계약 순서야."],["敷金・礼金・仲介手数料は物件によって違うにゃん。","Deposit, key money, and fees differ by home.","押金、礼金和中介费因房而异。","보증금, 사례금, 중개수수료는 매물마다 달라."],["ペット可や楽器可などは、物件ごとに条件が違うにゃん。","Pets, instruments, and other rules differ by home.","是否可养宠物、乐器等，每套房条件不同。","반려동물, 악기 가능 여부는 매물마다 달라."],["入居できる時期は空き状況によるにゃん。希望の時期は、担当者にご連絡ください。","Move-in timing depends on availability. Tell staff the date you want.","入住时间看空房情况。希望的时间请联系负责人。","입주 시기는 공실에 따라 달라. 원하는 시기는 담당자에게 연락해 줘."],["**10分限定**の**＋500円クオカード**は終了したにゃん。今月の成約特典は変わらず使えるにゃん。","The **10-minute +500 yen QUO card** has ended. This month's contract offer is still available.","**限时10分钟的500日元QUO卡**已结束。这个月的成交优惠还可以用。","**10분 한정 500엔 쿠오카드**는 끝났어. 이번 달 계약 혜택은 그대로야."],["すぐ話したいときはお電話がいちばんだにゃん。","A phone call is the fastest way to talk.","想马上说的话，打电话最快。","바로 이야기하려면 전화가 가장 빨라."],["チャットで続けるなら、お名前を教えてにゃん。","To continue in chat, tell me your name.","如果继续在聊天里说，请告诉我姓名。","채팅으로 이어가려면 이름을 알려 줘."],["今から**10分以内**のお申し込みで、**＋500円クオカード**がつくにゃん。","Apply within **10 minutes** and get an extra **500-yen QUO card**.","**10分钟内**申请，再加一张**500日元QUO卡**。","**10분 안에** 신청하면 **500엔 쿠오카드**가 더 붙어."],["すぐ話したいときは、お電話がいちばんだにゃん。","A phone call is the fastest way to talk.","想马上说的话，打电话最快。","바로 이야기하려면 전화가 가장 빨라."],["見学やご相談の予約だにゃん。希望の日時をカレンダーから選んでにゃん。","This is a visit booking. Pick the date and time on the calendar.","这是看房预约。请在日历里选择日期和时间。","견학 예약이야. 날짜와 시간을 달력에서 골라 줘."],["特典の申し込み、受け付けたにゃん。","Your offer application is in.","优惠申请已受理。","혜택 신청을 받았어."],["チャットで住まいの相談を続けることもできるにゃん。","You can keep talking about a home in this chat.","也可以在聊天里继续咨询居住的事。","이 채팅에서 주거 상담을 이어갈 수도 있어."],["特典の申し込みをチャットで続けることもできるにゃん。","You can continue the offer application in this chat.","也可以在聊天里继续申请优惠。","혜택 신청을 이 채팅에서 이어갈 수도 있어."],["チャットで続けるなら、ご住所を教えてにゃん。","To continue in chat, tell me your address.","如果继续在聊天里说，请告诉我地址。","채팅으로 이어가려면 주소를 알려 줘."],["チャットで続けるなら、お電話番号を教えてにゃん。","To continue in chat, tell me your phone number.","如果继续在聊天里说，请告诉我电话号码。","채팅으로 이어가려면 전화번호를 알려 줘."],["特典の申し込みは受け付けてあるにゃん。","The offer application is already in.","优惠申请已经受理了。","혜택 신청은 이미 받았어."],["住まいの相談、何から聞くかにゃん。","What would you like to ask about a home?","居住的事，想先问什么？","주거 상담, 무엇부터 물어볼래?"],["**10分限定**の**＋500円クオカード**は終了したにゃん。","The **10-minute +500 yen QUO card** has ended. ","**限时10分钟的500日元QUO卡**已结束。","**10분 한정 500엔 쿠오카드**는 끝났어. "],["待ち時間に、購入のよくある質問を見ておけるにゃん。","While you wait, you can look at common questions about buying.","等待期间可以看看购买的常见问题。","기다리는 동안 구매의 자주 묻는 질문을 볼 수 있어."],["待ち時間に、賃貸のよくある質問を見ておけるにゃん。","While you wait, you can look at common questions about renting.","等待期间可以看看租赁的常见问题。","기다리는 동안 임대의 자주 묻는 질문을 볼 수 있어."],["待ち時間に、注文住宅のよくある質問を見ておけるにゃん。","While you wait, you can look at common questions about custom homes.","等待期间可以看看定制住宅的常见问题。","기다리는 동안 주문주택의 자주 묻는 질문을 볼 수 있어."],["購入のよくある質問","Common questions about buying","购买的常见问题","구매 자주 묻는 질문"],["賃貸のよくある質問","Common questions about renting","租赁的常见问题","임대 자주 묻는 질문"],["注文住宅のよくある質問","Common questions about custom homes","定制住宅的常见问题","주문주택 자주 묻는 질문"],["自社物件は、**坪59万円**くらいからが目安だにゃん。\n土地の条件や仕様で変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Company homes start around **590,000 yen per tsubo**.\nLand and specifications change the price, so ask the staff member who contacts you for the latest details. A specialist will help.","自有房源大约从**每坪59万日元**起。\n土地和规格会改变价格，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","자사 매물은 **평당 59만 엔** 정도가 기준이야.\n땅과 사양에 따라 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["**ZEH対応住宅**も相談できるにゃん。\nプランによって仕様が違うから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","**ZEH-ready homes** are available too.\nThe specification depends on the plan, so ask the staff member who contacts you for the latest details. A specialist will help.","也可以咨询**ZEH节能住宅**。\n规格因方案而异，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","**ZEH 주택**도 상담할 수 있어.\n사양은 플랜마다 다르니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["**長期優良住宅**も相談できるにゃん。\n認定できるかはプランによるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","**Long-life quality homes** are available too.\nCertification depends on the plan, so ask the staff member who contacts you for the latest details. A specialist will help.","也可以咨询**长期优良住宅**。\n能否认定取决于方案，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","**장기우량주택**도 상담할 수 있어.\n인정 여부는 플랜에 따라 다르니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["注文住宅は、間取りの相談ができるにゃん。\nできる範囲は土地とプランによるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","You can talk through the layout of a custom home.\nWhat is possible depends on the land and the plan, so ask the staff member who contacts you for the latest details. A specialist will help.","定制住宅可以商量户型。\n能做到什么取决于土地和方案，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","주문주택은 구조를 상담할 수 있어.\n가능한 범위는 땅과 플랜에 따라 다르니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["土地探しからの相談もできるにゃん。\nエリアの空き状況は変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","You can also start by looking for land.\nWhat is available changes by area, so ask the staff member who contacts you for the latest details. A specialist will help.","也可以从找土地开始咨询。\n各区域的空地情况会变，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","땅 찾기부터 상담할 수도 있어.\n지역별 공실은 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["着工から完成までの期間は、プランによって変わるにゃん。\n目安の時期は変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","The time from start of work to completion depends on the plan.\nThe likely timing changes, so ask the staff member who contacts you for the latest details. A specialist will help.","从开工到完成的时间因方案而异。\n大概的时间会变，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","착공부터 완성까지의 기간은 플랜에 따라 달라.\n예상 시기는 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["住宅ローンの相談もできるにゃん。\n金利や審査は時期で変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","You can also ask about a mortgage.\nRates and screening change over time, so ask the staff member who contacts you for the latest details. A specialist will help.","也可以咨询房贷。\n利率和审核会随时间变化，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","주택 대출 상담도 할 수 있어.\n금리와 심사는 시기에 따라 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["内見、申し込み、ご契約の順で進むにゃん。\n物件によって手順が変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","It goes in the order of viewing, application, then contract.\nThe steps can change by home, so ask the staff member who contacts you for the latest details. A specialist will help.","按看房、申请、签约的顺序进行。\n步骤会因房源而不同，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","임장, 신청, 계약 순서로 진행돼.\n절차는 매물마다 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["頭金の目安は、物件とローンの組み方で変わるにゃん。\nいくら必要かは変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","A down payment depends on the home and how the mortgage is arranged.\nThe amount needed changes, so ask the staff member who contacts you for the latest details. A specialist will help.","首付的大致金额取决于房源和贷款方式。\n需要多少会变，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","계약금의 기준은 매물과 대출 구성에 따라 달라.\n필요한 금액은 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["見学の希望は伝えられるにゃん。\n空いている日時は変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","You can tell us when you would like to visit.\nOpen times change, so ask the staff member who contacts you for the latest details. A specialist will help.","可以告诉负责人想看房的时间。\n空闲时间会变，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","견학 희망 시간을 전할 수 있어.\n빈 시간은 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["購入時の諸費用は、物件ごとに違うにゃん。\n登記や税金の金額は変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Purchase fees differ for each home.\nRegistration and taxes change, so ask the staff member who contacts you for the latest details. A specialist will help.","购买时的各项费用因房源而不同。\n登记和税金的金额会变，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","구매할 때의 부대비용은 매물마다 달라.\n등기와 세금은 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["中古の一戸建てやマンションも探せるにゃん。\n今出ている物件は変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Resale houses and condominiums can be searched too.\nWhat is listed now changes, so ask the staff member who contacts you for the latest details. A specialist will help.","也可以找二手独栋和公寓。\n现在在售的房源会变，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","중고 단독주택과 맨션도 찾을 수 있어.\n지금 나와 있는 매물은 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["初期費用は、物件ごとに違うにゃん。\n敷金・礼金・仲介手数料の金額は変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Move-in costs differ for each home.\nDeposit, key money, and the agency fee change, so ask the staff member who contacts you for the latest details. A specialist will help.","初期费用因房源而不同。\n押金、礼金和中介费会变，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","초기 비용은 매물마다 달라.\n보증금, 사례금, 중개 수수료는 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["敷金と礼金の有無は、物件ごとに違うにゃん。\n今の募集条件は変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Whether there is a deposit or key money differs for each home.\nThe current terms change, so ask the staff member who contacts you for the latest details. A specialist will help.","有没有押金和礼金因房源而不同。\n现在的募集条件会变，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","보증금과 사례금의 유무는 매물마다 달라.\n지금 모집 조건은 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["入居できる時期は、空き状況によるにゃん。\n希望の時期に入れるかは変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","When you can move in depends on availability.\nWhether your preferred date is open changes, so ask the staff member who contacts you for the latest details. A specialist will help.","能入住的时间取决于空房情况。\n希望的时间能不能入住会变，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","입주할 수 있는 시기는 공실에 따라 달라.\n원하는 때에 들어갈 수 있는지는 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["ペット可かどうかは、物件ごとに違うにゃん。\n飼えるかは物件で変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Whether pets are allowed differs for each home.\nIt changes by home, so ask the staff member who contacts you for the latest details. A specialist will help.","能不能养宠物因房源而不同。\n能不能养取决于房源，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","반려동물 가능 여부는 매물마다 달라.\n키울 수 있는지는 매물마다 다르니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["内見の希望は伝えられるにゃん。\n空いている日時は変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","You can tell us when you would like a viewing.\nOpen times change, so ask the staff member who contacts you for the latest details. A specialist will help.","可以告诉负责人想内看的时间。\n空闲时间会变，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","임장 희망 시간을 전할 수 있어.\n빈 시간은 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["保証人や保証会社の条件は、物件ごとに違うにゃん。\n何が必要かは変わるから、最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Guarantor and guarantee-company terms differ for each home.\nWhat is required changes, so ask the staff member who contacts you for the latest details. A specialist will help.","担保人和担保公司的条件因房源而不同。\n需要什么会变，最新内容请向联系你的负责人确认。会由熟悉的人来对应。","보증인과 보증회사 조건은 매물마다 달라.\n무엇이 필요한지는 달라지니, 최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["自社物件は、**坪59万円**くらいからが目安だにゃん。土地の条件や仕様によって変わるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Company homes start around **590,000 yen per tsubo**. The price changes with the land and the specifications.\nAsk the staff member who contacts you for the latest details. A specialist will help.","自有房源大约从**每坪59万日元**起。价格会随土地和规格变化。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","자사 매물은 **평당 59만 엔** 정도가 기준이야. 땅과 사양에 따라 가격이 달라져.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["**ZEH対応住宅**の相談もできるにゃん。仕様はプランによって違うにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","You can also ask about **ZEH-ready homes**. The specification depends on the plan.\nAsk the staff member who contacts you for the latest details. A specialist will help.","也可以咨询**ZEH节能住宅**。规格因方案而不同。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","**ZEH 주택**도 상담할 수 있어. 사양은 플랜마다 달라.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["**長期優良住宅**の相談もできるにゃん。認定を受けられるかは、プランによるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","You can also ask about **long-life quality homes**. Whether it can be certified depends on the plan.\nAsk the staff member who contacts you for the latest details. A specialist will help.","也可以咨询**长期优良住宅**。能否获得认定取决于方案。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","**장기우량주택**도 상담할 수 있어. 인정받을 수 있는지는 플랜에 따라 달라.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["注文住宅は、間取りを相談しながら決められるにゃん。どこまで自由にできるかは、土地とプランによるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","For a custom home, you can decide the layout together. How free that can be depends on the land and the plan.\nAsk the staff member who contacts you for the latest details. A specialist will help.","定制住宅可以一边商量一边定户型。能自由到什么程度，取决于土地和方案。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","주문주택은 구조를 상담하면서 정할 수 있어. 어디까지 자유로운지는 땅과 플랜에 따라 달라.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["土地が決まっていなくても、土地探しから相談できるにゃん。空いている土地は、エリアによって変わるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","You can start with a land search even if the land is not chosen yet. What is available changes by area.\nAsk the staff member who contacts you for the latest details. A specialist will help.","土地还没定，也可以从找土地开始咨询。空地情况会因区域而不同。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","땅이 정해지지 않아도 땅 찾기부터 상담할 수 있어. 빈 땅은 지역마다 달라.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["着工から完成までは、プランによって期間が変わるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","The time from the start of work to completion changes with the plan.\nAsk the staff member who contacts you for the latest details. A specialist will help.","从开工到完成的时间会因方案而不同。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","착공부터 완성까지의 기간은 플랜에 따라 달라.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["住宅ローンの相談もできるにゃん。金利や審査の内容は、時期によって変わるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","You can also ask about a mortgage. Rates and screening change over time.\nAsk the staff member who contacts you for the latest details. A specialist will help.","也可以咨询房贷。利率和审核内容会随时间变化。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","주택 대출 상담도 할 수 있어. 금리와 심사 내용은 시기에 따라 달라.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["内見のあと、申し込み、ご契約と進むにゃん。手順は物件によって変わることもあるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","After a viewing, it moves on to the application and then the contract. The steps can change by home.\nAsk the staff member who contacts you for the latest details. A specialist will help.","看房之后进入申请，然后签约。步骤有时会因房源而不同。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","임장 뒤에 신청, 계약으로 진행돼. 절차는 매물에 따라 달라지기도 해.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["頭金がいくらかは、物件とローンの組み方で変わるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","The down payment changes with the home and how the mortgage is arranged.\nAsk the staff member who contacts you for the latest details. A specialist will help.","首付多少取决于房源和贷款的组合方式。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","계약금이 얼마인지는 매물과 대출 구성에 따라 달라.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["見学の希望日時は伝えられるにゃん。空いている日時は、そのときによって変わるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","You can tell us when you would like to visit. Open times change.\nAsk the staff member who contacts you for the latest details. A specialist will help.","可以告诉负责人想看房的时间。空闲时间会变。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","견학하고 싶은 시간을 전할 수 있어. 빈 시간은 그때그때 달라.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["購入時の諸費用は、物件ごとに違うにゃん。登記や税金の金額も変わるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Purchase fees differ for each home. Registration and taxes change too.\nAsk the staff member who contacts you for the latest details. A specialist will help.","购买时的各项费用因房源而不同。登记和税金也会变。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","구매할 때의 부대비용은 매물마다 달라. 등기와 세금도 달라져.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["中古の一戸建てやマンションも探せるにゃん。いま出ている物件は変わるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Resale houses and condominiums can be searched too. What is listed now changes.\nAsk the staff member who contacts you for the latest details. A specialist will help.","也可以找二手独栋和公寓。现在在售的房源会变。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","중고 단독주택과 맨션도 찾을 수 있어. 지금 나와 있는 매물은 달라져.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["初期費用は、物件ごとに違うにゃん。敷金、礼金、仲介手数料の金額も変わるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Move-in costs differ for each home. The deposit, key money, and agency fee change too.\nAsk the staff member who contacts you for the latest details. A specialist will help.","初期费用因房源而不同。押金、礼金和中介费也会变。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","초기 비용은 매물마다 달라. 보증금, 사례금, 중개 수수료도 달라져.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["敷金と礼金があるかどうかは、物件ごとに違うにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Whether there is a deposit or key money differs for each home.\nAsk the staff member who contacts you for the latest details. A specialist will help.","有没有押金和礼金，因房源而不同。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","보증금과 사례금이 있는지는 매물마다 달라.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["入居できる時期は、そのときの空き状況によるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","When you can move in depends on what is vacant at the time.\nAsk the staff member who contacts you for the latest details. A specialist will help.","能入住的时间取决于当时的空房情况。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","입주할 수 있는 시기는 그때의 공실 상황에 따라 달라.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["ペットを飼えるかどうかは、物件ごとに違うにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Whether you can keep a pet differs for each home.\nAsk the staff member who contacts you for the latest details. A specialist will help.","能不能养宠物，因房源而不同。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","반려동물을 키울 수 있는지는 매물마다 달라.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["内見の希望日時は伝えられるにゃん。空いている日時は、そのときによって変わるにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","You can tell us when you would like a viewing. Open times change.\nAsk the staff member who contacts you for the latest details. A specialist will help.","可以告诉负责人想内看的时间。空闲时间会变。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","임장하고 싶은 시간을 전할 수 있어. 빈 시간은 그때그때 달라.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["保証人や保証会社が必要かどうかは、物件ごとに違うにゃん。\n最新の内容は、連絡してくる担当者に聞いてにゃん。詳しい人が対応するにゃん。","Whether a guarantor or a guarantee company is required differs for each home.\nAsk the staff member who contacts you for the latest details. A specialist will help.","是否需要担保人或担保公司，因房源而不同。\n最新内容请向联系你的负责人确认。会由熟悉的人来对应。","보증인이나 보증회사가 필요한지는 매물마다 달라.\n최신 내용은 연락하는 담당자에게 물어봐. 자세한 사람이 대응해."],["下の入力欄から入力してにゃん。","Type it in the field below.","请在下面的输入栏填写。","아래 입력란에 입력해 줘."]];const ORI_CHOICES={"坪単価の目安":["坪単価の目安","Price per tsubo","每坪单价","평당 가격"],"ZEH対応住宅":["ZEH対応住宅","ZEH-ready homes","ZEH节能住宅","ZEH 주택"],"長期優良住宅":["長期優良住宅","Long-life quality homes","长期优良住宅","장기우량주택"],"間取りは自由？":["間取りは自由？","Is the layout flexible?","户型自由吗？","구조는 자유로워?"],"土地探し":["土地探し","Land search","找土地","땅 찾기"],"工期の目安":["工期の目安","Build time","工期","공사 기간"],"ローンの相談":["ローンの相談","Mortgage advice","房贷咨询","대출 상담"],"購入の流れ":["購入の流れ","How buying works","购买流程","구매 절차"],"頭金の目安":["頭金の目安","Down payment","首付","계약금"],"見学はできる？":["見学はできる？","Can I visit?","可以看房吗？","견학 가능해?"],"諸費用の目安":["諸費用の目安","Purchase fees","各项费用","부대비용"],"中古も探せる？":["中古も探せる？","Can I look at resale homes?","也能找二手房吗？","중고도 찾을 수 있어?"],"初期費用の目安":["初期費用の目安","Move-in costs","初期费用","초기 비용"],"敷金と礼金":["敷金と礼金","Deposit and key money","押金和礼金","보증금과 사례금"],"入居の時期":["入居の時期","Move-in timing","入住时间","입주 시기"],"ペットは可能？":["ペットは可能？","Are pets allowed?","可以养宠物吗？","반려동물 가능해?"],"内見はできる？":["内見はできる？","Can I view it?","可以内看吗？","임장 가능해?"],"保証人は必要？":["保証人は必要？","Is a guarantor needed?","需要担保人吗？","보증인 필요해?"],"坪単価は？":["坪単価は？","Price per tsubo?","每坪单价？","평당 가격은?"],"ZEH対応？":["ZEH対応？","ZEH ready?","能做ZEH吗？","ZEH 가능해?"],"長期優良？":["長期優良？","Long-life quality?","长期优良？","장기우량?"],"間取り自由？":["間取り自由？","Free layout?","户型自由？","구조는 자유?"],"土地探し？":["土地探し？","Find land?","找土地？","땅 찾기?"],"工期の目安？":["工期の目安？","How long to build?","工期多久？","공사 기간은?"],"ローン相談？":["ローン相談？","Ask about a mortgage?","可以咨询房贷？","대출 상담?"],"購入の流れ？":["購入の流れ？","How buying works?","购买流程？","구매 절차는?"],"頭金の目安？":["頭金の目安？","How much down?","首付大概多少？","계약금은?"],"見学できる？":["見学できる？","Can I visit?","可以看房吗？","견학 가능해?"],"諸費用は？":["諸費用は？","What are the fees?","各项费用？","부대비용은?"],"中古も探す？":["中古も探す？","Search resale too?","也找二手房？","중고도 찾나?"],"初期費用は？":["初期費用は？","Upfront costs?","初期费用？","초기 비용은?"],"敷金礼金は？":["敷金礼金は？","Deposit and key money?","押金和礼金？","보증금·사례금은?"],"入居時期は？":["入居時期は？","When can I move in?","何时入住？","입주는 언제?"],"ペット可能？":["ペット可能？","Are pets allowed?","可以养宠物？","반려동물 가능해?"],"内見できる？":["内見できる？","Can I view it?","可以内看吗？","임장 가능해?"],"保証人は？":["保証人は？","Is a guarantor needed?","需要担保人吗？","보증인 필요해?"],"坪59万円から":["坪59万円から","From 590,000 yen/tsubo","每坪59万日元起","평당 59만 엔부터"],"ZEH対応住宅":["ZEH対応住宅","ZEH-ready homes","ZEH节能住宅","ZEH 주택"],"長期優良住宅":["長期優良住宅","Long-life quality homes","长期优良住宅","장기우량주택"],"住宅ローン":["住宅ローン","Mortgage","房贷","주택 대출"],"見学の日程":["見学の日程","Visit times","看房时间","방문 일정"],"初期費用":["初期費用","Upfront costs","初期费用","초기 비용"],"分譲の特典を見る":["購入","Buy","购买","구매"],"購入":["購入","Buy","购买","구매"],"賃貸の特典を見る":["賃貸","Rent","租赁","임대"],"賃貸":["賃貸","Rent","租赁","임대"],"注文住宅の特典を見る":["注文住宅","Custom home","定制住宅","주문주택"],"注文住宅":["注文住宅","Custom home","定制住宅","주문주택"],"物件を探す":["物件を探す","Find a home","找房","매물 찾기"],"物件も見てみる":["物件も見てみる","See homes too","也看看房源","매물도 보기"],"特典に申し込む":["特典に申し込む","Apply for the offer","申请优惠","혜택 신청"],"希望条件はあとで相談":["あとで相談","Decide later","以后再说","나중에 상담"],"見学・相談を予約する":["見学・相談を予約","Book a visit","预约参观","견학 예약"],"見学・相談を予約":["見学・相談を予約","Book a visit","预约参观","견학 예약"],"担当から電話してほしい":["担当から電話してほしい","Ask staff to call","请负责人打电话","담당자 전화 요청"],"今すぐ電話する":["今すぐ電話する","Call now","立即致电","지금 전화"],"価格について":["価格について","Price","价格","가격"],"仕様について":["仕様について","Specs","规格","사양"],"希望エリアについて":["希望エリアについて","Preferred area","希望区域","희망 지역"],"住宅ローンについて":["住宅ローンについて","Mortgage","房贷","주택대출"],"購入の流れについて":["購入の流れについて","Buying steps","购买流程","구매 절차"],"初期費用について":["初期費用について","Upfront costs","初期费用","초기 비용"],"条件について":["条件について","Conditions","条件","조건"],"入居時期について":["入居時期について","Move-in timing","入住时间","입주 시기"],"もう一度試す":["もう一度試す","Try again","再试一次","다시 시도"],"戻る":["戻る","Back","返回","뒤로"]};function oriPack(lang){return lang==="zh"?1:lang==="ko"?2:0}
const ORI_HELLO={en:"Nice to meet you. I can help with buying, renting, and finding a home.",zh:"很高兴见到你。买房、租房、找房，都可以问我。",ko:"만나서 반가워요. 구매, 임대, 매물 찾기, 무엇이든 물어보세요."};
const ORI_MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const ORI_PREF={
"大阪府":["Osaka","大阪府","오사카부"],
"兵庫県":["Hyogo","兵库县","효고현"],
"京都府":["Kyoto","京都府","교토부"],
"奈良県":["Nara","奈良县","나라현"],
"和歌山県":["Wakayama","和歌山县","와카야마현"],
"滋賀県":["Shiga","滋贺县","시가현"],
"茨城県":["Ibaraki","茨城县","이바라키현"],
"千葉県":["Chiba","千叶县","지바현"],
"広島県":["Hiroshima","广岛县","히로시마현"],
"高知県":["Kochi","高知县","고치현"],
"福岡県":["Fukuoka","福冈县","후쿠오카현"]
};
const ORI_TYPES={
"新築一戸建て":["New house","新建独栋","신축 주택"],
"新築戸建て":["New house","新建独栋","신축 주택"],
"中古一戸建て":["Pre-owned house","二手独栋","중고 주택"],
"中古戸建て":["Pre-owned house","二手独栋","중고 주택"],
"中古マンション":["Pre-owned condo","二手公寓","중고 아파트"],
"マンション":["Condo","公寓","아파트"],
"アパート":["Apartment","公寓","아파트"],
"貸家":["House for rent","出租住宅","임대 주택"],
"テラスハウス":["Terrace house","联排住宅","테라스하우스"],
"土地":["Land","土地","토지"],
"収益物件":["Investment property","收益型房产","수익형 매물"],
"店舗・事務所":["Shop / office","商铺・办公室","점포·사무실"],
"店舗・事務所付き住宅":["Home with a shop","带商铺的住宅","점포 겸용 주택"],
"その他・事業用":["Other / commercial","其他・商用","기타·사업용"],
"その他":["Other","其他","기타"]
};
const ORI_SENTENCES=[
["住まい探しだね。購入・注文住宅・賃貸のどれを考えているか選んでにゃん。",["Looking for a home. Choose buy, custom home, or rent.", "找房子吧。请选择购买、定制住宅或租赁。","집을 찾는구나. 구매, 주문주택, 임대 중에서 골라 줘."]],
["まず、購入・注文住宅・賃貸のどれを考えているか選んでにゃん。",["First, choose buy, custom home, or rent.","请先选择购买、定制住宅或租赁。","먼저 구매, 주문주택, 임대 중에서 골라 줘."]],
["購入物件を一緒に探すにゃん。まず、希望の都道府県を選んでにゃん。",["Let's look for a home to buy. First, pick a prefecture.","一起找购房房源吧。请先选都道府县。","같이 구매 매물을 찾아볼게. 먼저 도도부현을 골라 줘."]],
["掲載物件のある都道府県を選んでにゃん。",["Pick a prefecture that has listings.","请选择有在售房源的都道府县。","매물이 있는 도도부현을 골라 줘."]],
["登録物件のある都道府県を選んでにゃん。",["Pick a prefecture that has listings.","请选择有在售房源的都道府县。","매물이 있는 도도부현을 골라 줘."]],
["掲載物件のある市区町村を選んでにゃん。",["Pick a city or ward that has listings.","请选择有房源的市区町村。","매물이 있는 시구정촌을 골라 줘."]],
["登録物件のある市区町村を選んでにゃん。",["Pick a city or ward that has listings.","请选择有房源的市区町村。","매물이 있는 시구정촌을 골라 줘."]],
["購入する物件の種類を選んでにゃん。まだ決まっていなければ、こだわりなしでも探せるにゃん。",["What kind of home do you want to buy? Choose no preference if you are not sure.","想买哪种房子？还没决定的话，选“不限”也可以。","어떤 집을 살지 골라 줘. 아직 정하지 않았으면 상관없음도 괜찮아."]],
["購入予算の上限を選んでにゃん。諸費用を除いた物件価格の目安で大丈夫にゃん。",["Choose a maximum purchase budget. The property price, before extra fees, is enough.","请选择购房预算上限。不含杂费的房价就行。","구매 예산 상한을 골라 줘. 부대비용을 뺀 매물 가격 기준으로 괜찮아."]],
["購入物件の希望間取りを選んでにゃん。決まっていなければ、こだわりなしで大丈夫にゃん。",["Choose a layout. No preference is fine if you have not decided.","请选择希望的户型。还没决定就选“不限”。","원하는 구조를 골라 줘. 정하지 않았으면 상관없어도 괜찮아."]],
["新しい購入予算の上限を選んでにゃん。",["Choose a new maximum budget.","请选择新的预算上限。","새 예산 상한을 골라 줘."]],
["新しい希望の都道府県を選んでにゃん。",["Pick a new prefecture.","请重新选择都道府县。","새 도도부현을 골라 줘."]],
["希望する駅徒歩の上限を「徒歩10分以内」のように教えてにゃん。",["Tell me the longest walk from a station, like “within 10 minutes”.","请告诉我车站步行时间上限，例如“步行10分钟以内”。","역에서 도보 상한을 “도보 10분 이내”처럼 알려 줘."]],
["条件に合う購入物件は見つからなかったにゃん。予算、物件種別、間取りのどれかを広げて探してみてにゃん。",["No homes for sale match that. Try a wider budget, type, or layout.","没有符合条件的购房房源。放宽预算、类型或户型再找找。","조건에 맞는 구매 매물이 없었어. 예산, 종류, 구조 중 하나를 넓혀 보자."]],
["条件に合う居住用の賃貸物件は見つからなかったにゃん。家賃上限、間取り、駅からの徒歩分数のどれを広げられるか教えてにゃん。",["No rentals match that. Tell me which to widen: rent, layout, or the walk from the station.","没有符合条件的租赁房。请告诉我可以放宽租金、户型，还是车站步行时间。","조건에 맞는 임대 매물이 없었어. 월세, 구조, 역 도보 중 무엇을 넓힐지 알려 줘."]],
["次に、家賃の上限を教えてにゃん。共益費込みか別かも分かれば探しやすいにゃん。",["Next, tell me your maximum rent. It helps to know if that includes the common fee.","接下来请告诉我租金上限。如果知道是否含共益费，会更好找。","다음으로 월세 상한을 알려 줘. 공익비 포함인지 알면 더 찾기 쉬워."]],
["新しい家賃の上限を教えてにゃん。",["Tell me a new maximum rent.","请告诉我新的租金上限。","새 월세 상한을 알려 줘."]],
["気に入った物件はあったかにゃ？資料請求・電話・見学から選んでにゃん。",["Did a home catch your eye? Choose documents, a call, or a visit.","有喜欢的房子吗？可选索取资料、电话或看房。","마음에 드는 매물이 있었어? 자료 요청, 전화, 견학 중에서 골라 줘."]],
["オリにゃんは、物件探し・住まい・店舗のことを案内できるにゃん。気になるエリアや条件を教えてね。",["I can help you find a home, talk about housing, or look at shops. Tell me an area or what you need.","我可以介绍找房、居住和店铺。告诉我想看的区域或条件吧。","매물 찾기, 주거, 점포를 안내할 수 있어. 궁금한 지역이나 조건을 알려 줘."]],
["チャットの有効期限が切れました。もう一度送信してにゃん。",["This chat expired. Please send it again.","聊天已过期。请再发送一次。","채팅 시간이 끝났어. 다시 보내 줘."]],
["会話を再開できませんでした。もう一度送ってにゃん。",["I could not resume the conversation. Please send it again.","无法继续对话。请再发送一次。","대화를 다시 열지 못했어. 한 번 더 보내 줘."]],
["回答を取り出せませんでした。もう一度送ってにゃん。",["I could not load that reply. Please send it again.","无法取出回答。请再发送一次。","답변을 불러오지 못했어. 다시 보내 줘."]],
["回答を取得できませんでした。もう一度お試しください。",["I could not get a reply. Please try again.","无法取得回答。请再试一次。","답변을 받지 못했어. 다시 시도해 줘."]],
["セッションを開始できませんでした。もう一度お試しください。",["I could not start the chat. Please try again.","无法开始会话。请再试一次。","대화를 시작하지 못했어. 다시 시도해 줘."]],
["セッション情報を確認できませんでした。もう一度お試しください。",["I could not confirm the session. Please try again.","无法确认会话信息。请再试一次。","세션 정보를 확인하지 못했어. 다시 시도해 줘."]],
["通信に失敗しました。しばらくしてからお試しください。",["The connection failed. Please try again in a moment.","通信失败。请稍后再试。","통신에 실패했어. 잠시 후 다시 시도해 줘."]],
["日付を選んでにゃん",["Pick a date","请选择日期","날짜를 골라 줘"]],
["ローカル開発モードだにゃん。AI Gateway 未設定のときは、物件を探す案内から動作確認してにゃん。",["Local preview mode. Use Find a home while AI Gateway is off.","本地预览模式。未设置 AI Gateway 时，请从找房开始确认。","로컬 미리보기야. AI Gateway가 없으면 매물 찾기로 확인해 줘."]],
["ローカル開発モードだにゃん。住まいの相談なら「物件を探す」から案内できるにゃん。",["Local preview mode. For housing questions, start with Find a home.","本地预览模式。居住咨询请从“找房”开始。","로컬 미리보기야. 주거 상담은 “매물 찾기”에서 안내할 수 있어."]],
["条件に合うほかの賃貸物件は、現在の登録情報では見つからなかったにゃん。",["No other rentals match in the current listings.","当前刊登信息里没有其他符合条件的租赁房。","현재 등록 정보에는 조건에 맞는 다른 임대 매물이 없었어."]],
["条件に合うほかの購入物件は、現在の登録情報では見つからなかったにゃん。",["No other homes for sale match in the current listings.","当前刊登信息里没有其他符合条件的购房房源。","현재 등록 정보에는 조건에 맞는 다른 구매 매물이 없었어."]],
["オリエントホームが得意な注文住宅の相談だね。まず、土地を持っているか教えてにゃん。分からなければ「未定」でも大丈夫にゃん。",["This is a custom-home consult. First, do you already have land? “Not sure yet” is fine.","这是定制住宅咨询。请先告诉我有没有土地。不确定也可以选“未定”。","주문주택 상담이야. 먼저 땅이 있는지 알려 줘. 모르겠으면 “미정”도 괜찮아."]],
["土地をお持ちなんだね。土地の所在地を市区町村まで教えてにゃん。分からなければ「未定」で大丈夫にゃん。",["You have land. Tell me the city, or “Not sure yet”.","已经有土地。请告诉我到市区町村的位置，不确定就说“未定”。","땅이 있구나. 시구정촌까지 위치를 알려 줘. 모르겠으면 “미정”도 괜찮아."]],
["土地の広さを教えてにゃん。㎡または坪で大丈夫にゃん。まだ分からなければ「未定」でも大丈夫。戸建てなら30〜40坪前後が一つの目安だけど、希望の暮らし方で変わるにゃん。",["How large is the land? Square meters or tsubo is fine. “Not sure yet” is fine too. A house is often about 30–40 tsubo, depending on how you want to live.","请告诉我土地面积，平方米或坪都可以。还不知道就说“未定”。独栋大约30到40坪，但会随生活方式变化。","땅 넓이를 알려 줘. ㎡나 평이면 돼. 아직 모르면 “미정”도 괜찮아. 주택은 보통 30–40평이지만, 살고 싶은 방식에 따라 달라."]],
["土地探しからだね。建てたいエリア（市区町村や沿線）を教えてにゃん。まだ決まっていなければ「未定」で大丈夫にゃん。",["We'll look for land. Tell me the area or train line, or “Not sure yet”.","从找地开始。请告诉我想建的区域或线路，还没定就说“未定”。","땅 찾기부터구나. 짓고 싶은 지역이나 노선을 알려 줘. 아직이면 “미정”도 괜찮아."]],
["ご家族の人数や構成を教えてにゃん。まだ決まっていなければ「未定」で大丈夫にゃん。",["How many people will live there? “Not sure yet” is fine.","请告诉我家庭人数。还没定就说“未定”。","가족 인원이나 구성을 알려 줘. 아직이면 “미정”도 괜찮아."]],
["希望する間取りや住まい方を教えてにゃん。例：3LDK、平屋、二世帯などにゃん。未定でも大丈夫にゃん。",["What layout do you want? For example 3LDK, a single-story house, or two households. “Not sure yet” is fine.","请告诉我希望的户型，例如3LDK、平屋或两代同堂。未定也可以。","원하는 구조나 사는 방식을 알려 줘. 예: 3LDK, 단층, 2세대. 미정도 괜찮아."]],
["建物と諸費用を含めた予算の目安を教えてにゃん。土地代は除いた金額で大丈夫にゃん。未定・相談したいでも大丈夫にゃん。",["A budget for the building and extra costs is enough. Land cost can be left out. “Not sure yet” is fine.","请告诉我含建筑和杂费的预算。不含土地款也可以。未定或想商量也行。","건물과 부대비용을 포함한 예산이면 돼. 땅값은 빼도 괜찮아. 미정이나 상담도 괜찮아."]],
["土地と建物を含めた総予算の目安を教えてにゃん。例：4,000万円まで、未定、相談したいなどで大丈夫にゃん。",["A total budget for land and building is enough. For example, up to 40 million yen, or “Not sure yet”.","请告诉我土地加建筑的总预算。例如最多4000万日元，或未定、想商量。","땅과 건물을 합친 총예산이면 돼. 예: 4,000만 엔까지, 미정, 상담."]],
["いつ頃の完成・入居を希望しているか教えてにゃん。未定でも大丈夫にゃん。",["When do you hope to move in? “Not sure yet” is fine.","希望何时完工入住？未定也可以。","완공이나 입주는 언제쯤을 원해? 미정도 괜찮아."]],
["住まいで重視したいことを教えてにゃん。性能・デザイン・家事動線・収納など、複数あっても大丈夫にゃん。未定や相談したいでも大丈夫にゃん。",["What matters most in the home? Performance, design, housework flow, storage — more than one is fine. “Not sure yet” is fine too.","住房最看重什么？性能、设计、家务动线、收纳，可以多选。未定或想商量也行。","주거에서 중요한 점을 알려 줘. 성능, 디자인, 가사 동선, 수납 등 여러 개도 괜찮아. 미정이나 상담도 괜찮아."]],
["ここまでの内容を担当者に相談するため、お名前を教えてにゃん。入力内容はご相談対応のために利用するにゃん。",["To pass this to staff, what's your name? We use it only to handle the consult.","为了交给负责人，请告诉我姓名。填写内容只用于咨询。","여기까지를 담당자에게 넘기려면 이름을 알려 줘. 입력 내용은 상담에만 사용해."]],
["担当者からご連絡するため、お電話番号を教えてにゃん。",["Your phone number, so staff can reach you.","请告诉我电话号码，方便负责人联系。","담당자가 연락할 전화번호를 알려 줘."]],
["お名前をこのチャットで入力しない場合は、0120-338-101 に電話して相談してにゃん。チャットで続ける場合は、お名前を入力してにゃん。",["If you would rather not type your name here, call 0120-338-101. To continue in chat, enter your name.","如果不想在这里填姓名，请致电 0120-338-101。继续聊天的话，请输入姓名。","여기서 이름을 입력하지 않으려면 0120-338-101로 전화해 줘. 채팅을 이어가려면 이름을 입력해 줘."]],
["電話番号をこのチャットで入力しない場合は、0120-338-101 に電話して相談してにゃん。チャットで続ける場合は、電話番号を入力してにゃん。",["If you would rather not type your phone number here, call 0120-338-101. To continue in chat, enter it.","如果不想在这里填电话，请致电 0120-338-101。继续聊天的话，请输入电话号码。","여기서 전화번호를 입력하지 않으려면 0120-338-101로 전화해 줘. 채팅을 이어가려면 전화번호를 입력해 줘."]],
["戸建てなら30〜40坪前後が一つの目安だけど、希望の暮らし方で変わるにゃん。土地を持っているかは、未定でも大丈夫なので教えてにゃん。",["A house is often about 30–40 tsubo, depending on how you want to live. Do you have land? “Not sure yet” is fine.","独栋大约30到40坪，但会随生活方式变化。有没有土地？未定也可以。","주택은 보통 30–40평이지만 사는 방식에 따라 달라. 땅이 있는지는 미정이어도 괜찮으니 알려 줘."]],
["どの物件の資料が必要かにゃ？候補から選んでにゃん。",["Which home should we send documents for? Pick one.","需要哪套房的资料？请从候选里选。","어느 매물 자료가 필요해? 후보에서 골라 줘."]],
["どの物件について相談したいかにゃ？候補から選んでにゃん。",["Which home do you want to talk about? Pick one.","想咨询哪套房？请从候选里选。","어느 매물을 상담하고 싶어? 후보에서 골라 줘."]],
["どの物件を見学したいにゃ？候補から選んでにゃん。",["Which home do you want to visit? Pick one.","想看哪套房？请从候选里选。","어느 매물을 견학하고 싶어? 후보에서 골라 줘."]],
["見学の希望日を選んでにゃん。ボタンから選べるにゃん。",["Pick a day to visit. The buttons are enough.","请选择希望看房的日期。点按钮即可。","견학하고 싶은 날을 골라 줘. 버튼으로 고를 수 있어."]],
["その日の希望時間を選んでにゃん。",["Pick a time that day.","请选择当天的时间。","그날 원하는 시간을 골라 줘."]],
["見学の希望日時を、日付と時間つきで教えてにゃん。",["Tell me the visit date and time.","请告诉我看房的日期和时间。","견학 날짜와 시간을 알려 줘."]],
["見学の希望日時を、カレンダーから選んでにゃん。",["Pick the visit date and time on the calendar.","请在日历里选择看房日期和时间。","견학 일시를 달력에서 골라 줘."]],
["資料をお届けするにゃん。お名前を教えてにゃん。",["We'll send the documents. What's your name?","我们会把资料寄给你。请告诉我姓名。","자료를 보내 줄게. 이름을 알려 줘."]],
["担当者からお電話するにゃん。お名前を教えてにゃん。",["Staff will call you. What's your name?","负责人会打电话。请告诉我姓名。","담당자가 전화할 거야. 이름을 알려 줘."]],
["資料をお届けする住所を、番地まで教えてにゃん。",["The address for the documents, including the street number.","请告诉我寄资料的地址，写到门牌号。","자료를 보낼 주소를 번지까지 알려 줘."]],
["現在のご住所を、番地まで教えてにゃん。",["Your current address, including the street number.","请告诉我现在的地址，写到门牌号。","현재 주소를 번지까지 알려 줘."]],
["連絡用の電話番号を教えてにゃん。",["A phone number we can use to reach you.","请告诉我联系用的电话号码。","연락할 전화번호를 알려 줘."]],
["お名前と電話番号がないと、担当者からご連絡できないにゃん。入力できる範囲で教えてにゃん。チャットで入力しない場合は、0120-338-101 に電話して相談してにゃん。",["Staff cannot call without a name and phone number. Share what you can, or call 0120-338-101.","没有姓名和电话，负责人无法联系。能填多少填多少，也可以致电 0120-338-101。","이름과 전화번호가 없으면 담당자가 연락할 수 없어. 입력할 수 있는 만큼 알려 주거나, 0120-338-101로 전화해 줘."]],
["その日時は見学の予約では選べないにゃん。カレンダーから選んでにゃん。",["That date and time cannot be booked. Please use the calendar.","这个时间不能预约看房。请从日历选择。","그 일시는 견학 예약으로 고를 수 없어. 달력에서 골라 줘."]],
["見学の日付と時間の両方を、カレンダーから選んでにゃん。",["Pick both the date and the time on the calendar.","请在日历里同时选择日期和时间。","날짜와 시간을 둘 다 달력에서 골라 줘."]],
["お電話番号を確認できなかったにゃん。数字を続けてもう一度入力してにゃん。",["I could not read that phone number. Please enter the digits again.","没能确认电话号码。请把数字连续再输入一次。","전화번호를 확인하지 못했어. 숫자를 이어서 다시 입력해 줘."]],
["ご相談を受け付けたにゃん。担当者からご連絡するので、少し待っていてにゃん。",["Your consult is in. Staff will contact you.","咨询已受理。负责人会联系你，请稍等。","상담을 받았어. 담당자가 연락할 테니 조금만 기다려 줘."]],
["ご相談は受け付けたにゃん。確認のため、0120-338-101 にも電話して内容を伝えてにゃん。",["Your consult is in. Please also call 0120-338-101 so we can confirm.","咨询已受理。为了确认，也请致电 0120-338-101 说明内容。","상담은 받았어. 확인을 위해 0120-338-101로도 전화해서 내용을 전해 줘."]],
["お問い合わせを受け付けたにゃん。担当者からご連絡するので、少し待っていてにゃん。",["Your inquiry is in. Staff will contact you.","咨询已受理。负责人会联系你，请稍等。","문의를 받았어. 담당자가 연락할 테니 조금만 기다려 줘."]],
["お問い合わせは受け付けたにゃん。確認のため、0120-338-101 にも電話して内容を伝えてにゃん。",["Your inquiry is in. Please also call 0120-338-101 so we can confirm.","咨询已受理。为了确认，也请致电 0120-338-101 说明内容。","문의는 받았어. 확인을 위해 0120-338-101로도 전화해서 내용을 전해 줘."]],
["ごめんね、価格交渉や値引きの判断は案内できないにゃん。0120-338-101 に電話して相談してにゃん。",["I can't decide a discount. Please call 0120-338-101.","抱歉，我不能判断议价或折扣。请致电 0120-338-101 联系负责人。","미안, 가격 협상이나 할인은 안내할 수 없어. 0120-338-101로 전화해서 상담해 줘."]],
["ごめんね、重要事項説明に代わる案内はできないにゃん。0120-338-101 に電話して、担当の宅地建物取引士への確認を依頼してにゃん。",["I can't replace the important-matters explanation. Please call 0120-338-101 and ask for the licensed agent.","抱歉，我不能代替重要事项说明。请致电 0120-338-101，请负责人确认。","미안, 중요사항 설명을 대신할 수는 없어. 0120-338-101로 전화해서 담당 중개사에게 확인해 줘."]],
["ごめんね、法的な判断はオリにゃんでは案内できないにゃん。0120-338-101 に電話して相談し、必要に応じて専門家に確認してにゃん。",["I can't give a legal opinion. Please call 0120-338-101, and a specialist if needed.","抱歉，我不能做法律判断。请致电 0120-338-101 联系负责人，必要时再请专家确认。","미안, 법적 판단은 안내할 수 없어. 0120-338-101로 전화해서 상담하고, 필요하면 전문가에게 확인해 줘."]],
["お腹がすいたんだね。ごめんね、飲食店やグルメの案内はできないにゃん。お部屋探しや住まいのことなら手伝えるにゃん。",["I can't suggest restaurants. I can help you find a home.","抱歉，我不能介绍餐厅。找房和居住的事可以帮你。","미안, 맛집 안내는 못 해. 집 찾기와 주거는 도와줄 수 있어."]],
["ごめんね、そのことは登録されている物件情報では分からないにゃん。0120-338-101 に電話して聞いてみてにゃん。",["That is not in the listing data. Please call 0120-338-101.","这件事在已登记的房源信息里查不到。请致电 0120-338-101 问负责人。","그건 등록된 매물 정보로는 모르겠어. 0120-338-101로 전화해서 물어봐 줘."]],
["こんにちは、オリにゃんだよ。お部屋探しや住まいのことを気軽に聞いてにゃん。",["Hi, I'm Orinyan. Ask me about finding a home.","你好，我是奥利喵。找房和居住的事，尽管问。","안녕, 오리냥이야. 집 찾기나 주거를 편하게 물어봐."]],
["どういたしましてにゃん。住まいの相談があればいつでも聞いてにゃん。",["You're welcome. Ask anytime about a home.","不客气。居住的事随时可以问。","천만에. 주거 상담은 언제든 물어봐."]],
["了解にゃん。物件探しを最初からやり直すなら「物件を探す」と送ってにゃん。",["Got it. To start the search over, send “Find a home”.","知道了。想从头找房，请发送“找房”。","알겠어. 매물 찾기를 처음부터 하려면 “매물 찾기”라고 보내 줘."]],
["オリエントホームのこだわりは、暮らしに合う「世界に一軒だけの家」を一緒につくることにゃん。一級建築士と相談しながら、間取り・デザイン・仕様まで細かく選べるオールオーダーの家づくりが特徴にゃん。新築だけでなく、中古住宅・リフォーム・土地活用までまとめて相談できるにゃん。",["Orient Home builds one house for the way you live. With a first-class architect, you can choose the layout, design, and specs. New homes, pre-owned homes, renovations, and land use can all be discussed together.","Orient Home 的坚持，是一起做一栋适合生活的房子。可以和一级建筑师商量户型、设计和规格。新房、二手房、装修和土地活用都能一起咨询。","오리엔트홈은 생활에 맞는 단 한 채를 같이 만드는 데 집중해. 1급 건축사와 구조, 디자인, 사양까지 고를 수 있어. 신축뿐 아니라 중고, 리모델링, 토지 활용도 함께 상담할 수 있어."]],
["回答データを確認できませんでした。もう一度お試しください。",["I could not check that reply. Please try again.","无法确认回答。请再试一次。","답변을 확인하지 못했어. 다시 시도해 줘."]],
["通信が混み合っています。少し時間をおいて、もう一度お試しください。",["The connection is busy. Please try again in a moment.","通信繁忙。请稍后再试。","통신이 붐비고 있어. 잠시 후 다시 시도해 줘."]],
["通信に失敗しました。ネットワークを確認して、もう一度お試しください。",["The connection failed. Check the network and try again.","通信失败。请确认网络后再试。","통신에 실패했어. 네트워크를 확인하고 다시 시도해 줘."]],
["セキュリティ確認に失敗しました。もう一度試してにゃん。",["The security check failed. Try again.","安全确认失败。请再试一次。","보안 확인에 실패했어. 다시 시도해 줘."]],
["セキュリティ確認に時間がかかっています。もう一度試してにゃん。",["The security check is taking a while. Try again.","安全确认耗时较久。请再试一次。","보안 확인이 오래 걸리고 있어. 다시 시도해 줘."]],
["セキュリティ確認を開始できませんでした。もう一度試してにゃん。",["The security check could not start. Try again.","无法开始安全确认。请再试一次。","보안 확인을 시작하지 못했어. 다시 시도해 줘."]],
["試行回数が多すぎます。1分ほど待ってからお試しください",["Too many tries. Please wait about a minute.","尝试次数过多。请等一分钟左右再试。","시도가 너무 많아. 1분쯤 기다렸다가 다시 시도해 줘."]],
["本日のチャット受付上限に達しました。0120-338-101 へお電話ください。",["Today's chat limit has been reached. Please call 0120-338-101.","今天的聊天已达上限。请致电 0120-338-101。","오늘 채팅 접수 한도에 도달했어. 0120-338-101로 전화해 줘."]],
["本日のAI回答上限に達しました。0120-338-101 へお電話ください。",["Today's reply limit has been reached. Please call 0120-338-101.","今天的回答已达上限。请致电 0120-338-101。","오늘 답변 한도에 도달했어. 0120-338-101로 전화해 줘."]],
["今月のAI利用上限に達しました。0120-338-101 へお電話ください。",["This month's limit has been reached. Please call 0120-338-101.","本月使用已达上限。请致电 0120-338-101。","이번 달 이용 한도에 도달했어. 0120-338-101로 전화해 줘."]],
["戻る操作の履歴が長くなりました。ページを再読み込みして検索を開始してください。",["The back history is too long. Reload the page and start the search again.","返回记录太长了。请重新加载页面后再搜索。","뒤로 가기 기록이 길어졌어. 페이지를 다시 불러와 검색을 시작해 줘."]],
["条件に合うほかの賃貸物件は、現在の登録情報では見つからなかったにゃん。条件を変えて探すか、最新情報は 0120-338-101 に電話して聞いてにゃん。",["No other rentals match in the current listings. Change the filters, or call 0120-338-101 for the latest.","当前刊登信息里没有其他符合条件的租赁房。可以改条件再找，或致电 0120-338-101 询问最新信息。","현재 등록 정보에는 조건에 맞는 다른 임대 매물이 없었어. 조건을 바꾸거나 0120-338-101로 전화해서 최신 정보를 물어봐."]],
["条件に合うほかの購入物件は、現在の登録情報では見つからなかったにゃん。条件を変えて探すか、最新情報は 0120-338-101 に電話して聞いてにゃん。",["No other homes for sale match in the current listings. Change the filters, or call 0120-338-101 for the latest.","当前刊登信息里没有其他符合条件的购房房源。可以改条件再找，或致电 0120-338-101 询问最新信息。","현재 등록 정보에는 조건에 맞는 다른 구매 매물이 없었어. 조건을 바꾸거나 0120-338-101로 전화해서 최신 정보를 물어봐."]],
["見学のお申し込みだにゃん。お名前を教えてにゃん。",["This is a visit request. What's your name?","这是看房申请。请告诉我姓名。","견학 신청이야. 이름을 알려 줘."]],
["ごめんね、その内容はオリにゃんでは案内できないにゃん。お部屋探しや住まいのことを聞いてにゃん。",["I can't help with that. Ask me about finding a home.","抱歉，这件事我没法介绍。找房和居住的事可以问我。","미안, 그 내용은 안내할 수 없어. 집 찾기나 주거를 물어봐."]],
["オリにゃんだよ。オリエントグループの住まい・物件探しをお手伝いする不動産案内AIにゃん。",["I'm Orinyan, the housing guide for Orient Group.","我是奥利喵，Orient集团的找房向导。","오리냥이야. 오리엔트 그룹의 집 찾기를 돕는 안내야."]],
["購入物件の希望間取りを選んでにゃん。",["Choose a layout.","请选择希望的户型。","원하는 구조를 골라 줘."]],
["ありがとう！つづいて年代を教えてにゃん。",["Thanks! Next, about how old are you?","谢谢！接下来请告诉我年龄段。","고마워! 이어서 연령대를 알려 줘."]],
["連絡先情報を確認できませんでした。お問い合わせフォームをご利用ください。",["I could not confirm the contact details. Please use the inquiry form.","无法确认联系方式。请使用咨询表单。","연락처를 확인하지 못했어. 문의 양식을 이용해 줘."]],
["（案内中の物件なし）",["(No home selected)","（没有正在介绍的房源）","(안내 중인 매물 없음)"]],
["（内容を読み取れませんでした）",["(Could not read that)","（无法读取内容）","(내용을 읽지 못했어)"]],
["（物件情報を読み取れませんでした）",["(Could not read the listing)","（无法读取房源信息）","(매물 정보를 읽지 못했어)"]],
["前のメッセージを処理中です。少し待ってからお試しください。",["The previous message is still being handled. Please wait a moment and try again.","上一条消息还在处理。请稍等后再试。","이전 메시지를 처리 중이야. 잠시 기다렸다가 다시 시도해 줘."]],
["少し時間をおいてからお試しください",["Please try again in a moment.","请稍后再试。","잠시 후 다시 시도해 줘."]],
["処理中にエラーが発生しました",["Something went wrong while handling that.","处理时发生了错误。","처리 중에 오류가 발생했어."]]
];
function oriYenCap(raw, lang){
  const n=Number(String(raw).replace(/,/g,""));
  if(!Number.isFinite(n))return raw;
  const yen=n*10000;
  if(lang==="en")return yen>=1000000&&yen%1000000===0?`Up to ${yen/1000000} million yen`:`Up to ${yen.toLocaleString("en-US")} yen`;
  if(lang==="zh")return `最多${raw}万日元`;
  return `최대 ${raw}만 엔`;
}
function oriFilterLabel(word, lang){
  const table={
    "インターネット無料":["free internet","免费上网","인터넷 무료"],
    "ネット無料":["free internet","免费上网","인터넷 무료"],
    "オートロック":["auto-lock","自动锁","자동 잠금"],
    "バス・トイレ":["bath and toilet","浴室和卫生间","욕실·화장실"],
    "女性限定":["women only","仅限女性","여성 전용"],
    "駐輪場":["bicycle parking","自行车停放处","자전거 주차장"],
    "駐車場":["parking","停车场","주차장"],
    "南向き":["south-facing","朝南","남향"],
    "角部屋":["corner unit","角房","코너 방"],
    "ペット":["pets","宠物","반려동물"],
    "ワンルーム":["studio","单间","원룸"],
    "保証人":["a guarantor","担保人","보증인"],
    "敷金":["a deposit","押金","보증금"],
    "礼金":["key money","礼金","사례금"],
    "築浅":["a newer building","较新的房子","신축에 가까운 집"],
    "築年":["the year built","建成年份","건축 연도"],
    "楽器":["musical instruments","乐器","악기"],
    "犬":["dogs","狗","개"],
    "猫":["cats","猫","고양이"]
  };
  return table[word]?table[word][oriPack(lang)]:word;
}
function oriSubject(subject, lang){
  if(subject==="賃貸")return ["a rental","租赁","임대"][oriPack(lang)];
  if(subject==="一人暮らし向けの賃貸")return ["a rental for one","一个人住的租赁","혼자 사는 임대"][oriPack(lang)];
  if(subject==="購入物件")return ["a home to buy","购房房源","구매 매물"][oriPack(lang)];
  const people=subject.match(/^(\d+)人で暮らす賃貸$/);
  if(people){
    const n=people[1];
    return [`a rental for ${n} people`,`${n}人一起住的租赁`,`${n}명이 사는 임대`][oriPack(lang)];
  }
  return subject;
}
const ORI_PLACES={"ライオンズマンション本山":["Raionzumanshon Honzan","ライオンズマンション本山","라이온즈만숀혼잔"],"エレガントライフ新大阪":["Ereganto Raifu Shinosaka","エレントライフ新大阪","에레간토라이후신오사카"],"深江ロイヤルマンション":["Fukae Roiyaru Manshon","深江ロイヤルマンション","후카에로이야루만숀"],"泉陽丘マンション":["Izumi Yo Oka Manshon","泉阳丘マンション","이즈미요우오카만숀"],"東牟婁郡古座川町":["Kozagawa","东牟娄郡古座川町","고자가와초"],"三軒家東貸戸建":["Sangenyahigashi Kashi To Ken","三轩家东贷户建","산겐야히가시카시토켄"],"山本マンション":["Yamamoto Manshon","山本マンション","야마모토만숀"],"紫野西藤ノ森町":["Murasakinonishifujinomori","紫野西藤ノ森町","무라사키노니시후지노모리"],"上野芝向ヶ丘町":["Uenoshibamukogaoka","上野芝向丘町","우에노시바무코우가오카"],"浜寺諏訪森町中":["Hamaderasuwanomorichonaka","滨寺诹访森町中","하마데라수와노모리쵸우나카"],"北葛城郡広陵町":["Koryo","北葛城郡广陵町","고료초"],"北葛城郡上牧町":["Kanmaki","北葛城郡上牧町","간마키초"],"有田郡有田川町":["Aridagawa","有田郡有田川町","아리다가와초"],"ポラス城ケ堀":["Po Rasu Jogabori","ポラス城堀","포라수죠우가보리"],"安芸郡東洋町":["Toyo","安艺郡东洋町","도요초"],"五色町鳥飼浦":["Goshiki Machi Torikaiura","五色町鸟饲浦","고시키마치토리카이우라"],"御陵前ハイツ":["Goryomae Haitsu","御陵前ハイツ","고료우마에하이츠"],"山口町下山口":["Yamaguchichoshimoyamaguchi","山口町下山口","야마구치쵸우시모야마구치"],"紫竹北大門町":["Shichikukitadaimon","紫竹北大门町","시치쿠키타다이몬"],"紫野上御輿町":["Murasakinokamimikoshi","紫野上御舆町","무라사키노카미미코시"],"紫野北舟岡町":["Murasakinokitafunaoka","紫野北舟冈町","무라사키노키타후나오카"],"篠山城城下町":["Sasayama Jo Joka","筿山城城下町","사사야마죠우죠우카"],"信楽町上朝宮":["Shigaraki Machi Kamiasamiya","信乐町上朝宫","시가라키마치카미아사미야"],"仁川月見ガ丘":["Nigawatsukimigaoka","仁川月见丘","니가와츠키미가오카"],"仁川百合野町":["Nigawayurino","仁川百合野町","니가와유리노"],"泉南郡熊取町":["Kumatori","泉南郡熊取町","구마토리초"],"泉北郡忠岡町":["Tadaoka","泉北郡忠冈町","다다오카초"],"大宮一ノ井町":["Omiyaichinoi","大宫一ノ井町","오미야이치노이"],"百舌鳥夕雲町":["Mozusekiun","百舌鸟夕云町","모즈세키운"],"浜寺石津町西":["Hamaderaishizuchonishi","滨寺石津町西","하마데라이시즈쵸우니시"],"浜寺石津町東":["Hamaderaishizuchohigashi","滨寺石津町东","하마데라이시즈쵸우히가시"],"浜寺船尾町西":["Hamaderafunaochonishi","滨寺船尾町西","하마데라후나오쵸우니시"],"旭ヶ丘北町":["Asahigaokakita","旭丘北町","아사히가오카키타"],"下津町下津":["Shimotsu Machi Shimotsu","下津町下津","시모츠마치시모츠"],"河内長野市":["Kawachinagano","河内长野市","가와치나가노시"],"公園南矢田":["Koenminamiyata","公园南矢田","코우엔미나미야타"],"杭瀬北新町":["Kuisekitashin","杭濑北新町","쿠이세키타신"],"細川町中里":["Hosokawachonakazato","细川町中里","호소카와쵸우나카자토"],"山ノ内苗町":["Yamanochinae","山ノ内苗町","야마노우치나에"],"山南町井原":["Sannan Machi Ihara","山南町井原","산난마치이하라"],"上桂御正町":["Kamikatsuramisho","上桂御正町","카미카츠라미쇼우"],"新在家町西":["Shinzaikechonishi","新在家町西","신자이케쵸우니시"],"深井水池町":["Fukaimizugaike","深井水池町","후카이미즈가이케"],"神戸北野町":["Kobe Kitano","神户北野町","코우베키타노"],"泉南郡岬町":["Misaki","泉南郡岬町","미사키초"],"大阪狭山市":["Osakasayama","大阪狭山市","오사카사야마시"],"丹波篠山市":["Tambasasayama","丹波筿山市","단바사사야마시"],"中山五月台":["Nakayamasatsukidai","中山五月台","나카야마사츠키다이"],"朝日ヶ丘町":["Asahigaoka","朝日丘町","아사히가오카"],"朝日ケ丘町":["Asahigaoka","朝日丘町","아사히가오카"],"天王寺町北":["Tennojichokita","天王寺町北","텐노우지쵸우키타"],"天下茶屋東":["Tengachayahigashi","天下茶屋东","텐가챠야히가시"],"南旅篭町西":["Minamihatagochonishi","南旅篭町西","미나미하타고쵸우니시"],"日置荘北町":["Hikishokita","日置庄北町","히키쇼우키타"],"柏原町北中":["Kashiwara Machi Kitanaka","柏原町北中","카시와라마치키타나카"],"八田南之町":["Handaminamino","八田南之町","한다미나미노"],"氷上町稲継":["Hikami Machi Inatsugi","氷上町稻继","히카미마치이나츠기"],"氷上町成松":["Hikami Machi Narimatsu","氷上町成松","히카미마치나리마츠"],"氷上町大崎":["Hikami Machi Osaki","氷上町大崎","히카미마치오사키"],"浜寺昭和町":["Hamaderashowa","滨寺昭和町","하마데라쇼우와"],"北旅籠町西":["Kitahatagochonishi","北旅笼町西","키타하타고쵸우니시"],"緑ヶ丘北町":["Midorigaokakita","绿丘北町","미도리가오카키타"],"鈴蘭台南町":["Suzurandaiminami","铃兰台南町","수즈란다이미나미"],"鈴蘭台北町":["Suzurandaikita","铃兰台北町","수즈란다이키타"],"ドルミ第":["Doru Mi Dai","ドルミ第","도루미다이"],"ユニ船場":["Yuni Funaba","ユニ船场","유니후나바"],"阿倍野筋":["Abenosuji","阿倍野筋","아베노수지"],"阿倍野区":["Abeno Ward","阿倍野区","아베노구"],"稲田新町":["Inadashin","稻田新町","이나다신"],"羽曳野市":["Habikino","羽曳野市","하비키노시"],"遠里小野":["Oriono","远里小野","오리오노"],"横小路町":["Yokoshoji","横小路町","요코쇼우지"],"恩智南町":["Onjiminami","恩智南町","온지미나미"],"河内国分":["Kawauchi Kokubu","河内国分","카와우치코쿠부"],"花山東町":["Hanayamahigashi","花山东町","하나야마히가시"],"我孫子西":["Abikonishi","我孙子西","아비코니시"],"鴨子ヶ原":["Kamokogahara","鸭子原","카모코가하라"],"岸和田市":["Kishiwada","岸和田市","기시와다시"],"岩屋北町":["Iwayakita","岩屋北町","이와야키타"],"久宝寺口":["Kyuhoji Guchi","久宝寺口","큐우호우지구치"],"魚崎南町":["Uozakiminami","鱼崎南町","우오자키미나미"],"魚崎北町":["Uozakikita","鱼崎北町","우오자키키타"],"京阪本線":["Keihanhonsen","京阪本线","케이한혼센"],"玉串元町":["Tamakushimoto","玉串元町","타마쿠시모토"],"金楽寺町":["Kinrakuji","金乐寺町","킨라쿠지"],"恵美須東":["Ebisuhigashi","惠美须东","에비수히가시"],"古座川町":["Kozagawa","古座川町","고자가와초"],"五月ケ丘":["Satsukigaoka","五月丘","사츠키가오카"],"甲斐町西":["Kainochonishi","甲斐町西","카이노쵸우니시"],"紅葉ガ丘":["Momijigaoka","红叶丘","모미지가오카"],"香里ケ丘":["Korigaoka","香里丘","코우리가오카"],"高井田中":["Takaidanaka","高井田中","타카이다나카"],"三軒家西":["Sangenyanishi","三轩家西","산겐야니시"],"三軒家東":["Sangenyahigashi","三轩家东","산겐야히가시"],"三津屋南":["Mitsuyaminami","三津屋南","미츠야미나미"],"山中田町":["Yamachuda","山中田町","야마츄우다"],"四條畷市":["Shijonawate","四条畷市","시조나와테시"],"篠原北町":["Shinoharakita","筿原北町","시노하라키타"],"若江東町":["Waka Koto","若江东町","와카코우토우"],"若江南町":["Wakaeminami","若江南町","와카에미나미"],"若江本町":["Wakaehon","若江本町","와카에혼"],"住吉橋町":["Sumiyoshibashi","住吉桥町","수미요시바시"],"住道矢田":["Sunjiyata","住道矢田","순지야타"],"住之江区":["Suminoe Ward","住之江区","스미노에구"],"宿院町西":["Shukuinchonishi","宿院町西","슈쿠인쵸우니시"],"春日出中":["Kasugadenaka","春日出中","카수가데나카"],"春日出南":["Kasugademinami","春日出南","카수가데미나미"],"上本町ガ":["Uehon Machi Ga","上本町","우에혼마치가"],"上野口町":["Kaminoguchi","上野口町","카미노구치"],"城ケ堀町":["Jogabori","城堀町","죠우가보리"],"寝屋川市":["Neyagawa","寝屋川市","네야가와시"],"深井中町":["Fukainaka","深井中町","후카이나카"],"深井東町":["Fukaihigashi","深井东町","후카이히가시"],"深井北町":["Fukaikita","深井北町","후카이키타"],"深江本町":["Fukaehon","深江本町","후카에혼"],"西住之江":["Nishisuminoe","西住之江","니시수미노에"],"西上小阪":["Nishikamikosaka","西上小阪","니시카미코사카"],"西新涯町":["Nishishingai","西新涯町","니시신가이"],"西淀川区":["Nishiyodogawa Ward","西淀川区","니시요도가와구"],"泉佐野市":["Izumisano","泉佐野市","이즈미사노시"],"泉大津市":["Izumiotsu","泉大津市","이즈미오쓰시"],"船尾町西":["Senbi Machinishi","船尾町西","센비마치니시"],"大久保町":["Okubo","大久保町","오쿠보"],"大今里南":["Oimazatominami","大今里南","오이마자토미나미"],"大阪本町":["Osaka Hon","大阪本町","오사카혼"],"大字上牧":["Daiji Kanmaki","大字上牧","다이지칸마키"],"大石東町":["Oishihigashi","大石东町","오이시히가시"],"中之町西":["Nakanochonishi","中之町西","나카노쵸우니시"],"中野本町":["Nakanohon","中野本町","나카노혼"],"朝日ヶ丘":["Asahigaoka","朝日丘","아사히가오카"],"長居公園":["Nagaikoen","长居公园","나가이코우엔"],"長洲中通":["Nagasunakadori","长洲中通","나가수나카도오리"],"津之江町":["Tsunoe","津之江町","츠노에"],"天王寺区":["Tennoji Ward","天王寺区","덴노지구"],"天下茶屋":["Tengachaya","天下茶屋","텐가챠야"],"東園田町":["Higashisonoda","东园田町","히가시소노다"],"東住吉区":["Higashisumiyoshi Ward","东住吉区","히가시스미요시구"],"東尻池町":["Higashishiriike","东尻池町","히가시시리이케"],"東石切町":["Higashiishikiri","东石切町","히가시이시키리"],"東大阪市":["Higashiosaka","东大阪市","히가시오사카시"],"東白川台":["Higashishirakawadai","东白川台","히가시시라카와다이"],"東板持町":["Higashiitamochi","东板持町","히가시이타모치"],"東淀川区":["Higashiyodogawa Ward","东淀川区","히가시요도가와구"],"藤井寺市":["Fujiidera","藤井寺市","후지이데라시"],"南恩加島":["Minamiokajima","南恩加岛","미나미오카지마"],"南上小阪":["Minamikamikosaka","南上小阪","미나미카미코사카"],"南植松町":["Minamiuematsu","南植松町","미나미우에마츠"],"南中樫井":["Minaminakakashii","南中㭴井","미나미나카카시이"],"南半町東":["Minamihanchohigashi","南半町东","미나미한쵸우히가시"],"二丁通町":["Nichodori","二丁通町","니쵸우도오리"],"八田北町":["Handakita","八田北町","한다키타"],"樋之上町":["Hinoe","樋之上町","히노우에"],"浜甲子園":["Hamakoshien","滨甲子园","하마코우시엔"],"富田林市":["Tondabayashi","富田林市","돈다바야시시"],"服部南町":["Hattoriminami","服部南町","핫토리미나미"],"平野本町":["Hiranohon","平野本町","히라노혼"],"北大樋町":["Kitaohi","北大樋町","키타오히"],"北六甲台":["Kitarokkodai","北六甲台","키타롯코우다이"],"堀上緑町":["Horigami Midori","堀上绿町","호리가미미도리"],"本山南町":["Motoyamaminami","本山南町","모토야마미나미"],"有田川町":["Aridagawa","有田川町","아리다가와초"],"竜神橋町":["Ryujinbashi","龙神桥町","류우진바시"],"和泉橋本":["Izumi Hashimoto","和泉桥本","이즈미하시모토"],"ド塚本":["Do Tsukamoto","ド冢本","도츠카모토"],"芦屋市":["Ashiya","芦屋市","아시야시"],"安倉南":["Akuraminami","安仓南","아쿠라미나미"],"安土町":["Azuchi","安土町","아즈치"],"磯上町":["Isogami","矶上町","이소가미"],"茨木市":["Ibaraki","茨木市","이바라키시"],"引野町":["Hikino","引野町","히키노"],"右京区":["Ukyo Ward","右京区","우쿄구"],"瓜破西":["Uriwarinishi","瓜破西","우리와리니시"],"永代町":["Eitai","永代町","에이타이"],"王居殿":["Oiden","王居殿","오이덴"],"下瓦屋":["Shimokawaraya","下瓦屋","시모카와라야"],"下京区":["Shimogyo Ward","下京区","시모교구"],"下新庄":["Shimoshinjo","下新庄","시모신죠우"],"下板井":["Shimoitai","下板井","시모이타이"],"花山町":["Hanayama","花山町","하나야마"],"我孫子":["Abiko","我孙子","아비코"],"海山町":["Miyama","海山町","미야마"],"海南市":["Kainan","海南市","가이난시"],"貝塚駅":["Kaizuka Station","贝冢站","카이즈카역"],"貝塚市":["Kaizuka","贝冢市","가이즈카시"],"鴨谷台":["Kamotanidai","鸭谷台","카모타니다이"],"丸山通":["Maruyama Toru","丸山通","마루야마토오루"],"岸城町":["Kishiki","岸城町","키시키"],"岸里東":["Kishinosatohigashi","岸里东","키시노사토히가시"],"岸和田":["Kishiwada","岸和田","키시와다"],"菊丘町":["Kikuoka","菊丘町","키쿠오카"],"吉井町":["Yoshii","吉井町","요시이"],"吉田町":["Yoshida","吉田町","요시다"],"吉野郡":["Yoshino","吉野郡","요시노군"],"逆瀬川":["Sakasegawa","逆濑川","사카세가와"],"久保町":["Kubo","久保町","쿠보"],"久宝寺":["Kyuhoji","久宝寺","큐우호우지"],"宮山台":["Miyayamadai","宫山台","미야야마다이"],"宮川町":["Miyagawa","宫川町","미야가와"],"宮之阪":["Miyanosaka","宫之阪","미야노사카"],"魚屋町":["Sakanaya","鱼屋町","사카나야"],"京都市":["Kyoto City","京都市","교토시"],"橋本市":["Hashimoto","桥本市","하시모토시"],"玉串町":["Tamagushi","玉串町","타마구시"],"玉手町":["Tamate","玉手町","타마테"],"玉出中":["Tamadenaka","玉出中","타마데나카"],"近木町":["Kogi","近木町","코기"],"金閣寺":["Kinkakuji","金阁寺","킨카쿠지"],"苦楽園":["Kurakuen","苦乐园","쿠라쿠엔"],"熊取町":["Kumatori","熊取町","구마토리초"],"景勝町":["Keisho","景胜町","케이쇼우"],"月野瀬":["Tsukinose","月野濑","츠키노세"],"見野山":["Minoyama","见野山","미노야마"],"御厨東":["Mikuriyahigashi","御厨东","미쿠리야히가시"],"御厨南":["Mikuriyaminami","御厨南","미쿠리야미나미"],"御池台":["Miikedai","御池台","미이케다이"],"御幣島":["Mitejima","御币岛","미테지마"],"御坊市":["Gobo","御坊市","고보시"],"光明池":["Komyoike","光明池","코우묘우이케"],"光陽台":["Koyodai","光阳台","코우요우다이"],"広陵町":["Koryo","广陵町","고료초"],"甲賀市":["Koka","甲贺市","고카시"],"甲東園":["Kotoen","甲东园","코우토우엔"],"甲風園":["Kofuen","甲风园","코우후우엔"],"香芝市":["Kashiba","香芝市","가시바시"],"高師浜":["Takashinohama","高师滨","타카시노하마"],"高松南":["Takamatsuminami","高松南","타카마츠미나미"],"高石市":["Takaishi","高石市","다카이시시"],"高倉町":["Takakura","高仓町","타카쿠라"],"高槻市":["Takatsuki","高槻市","다카쓰키시"],"鴻池町":["Konoike","鸿池町","코우노이케"],"此花区":["Konohana Ward","此花区","고노하나구"],"左京区":["Sakyo Ward","左京区","사쿄구"],"阪南市":["Hannan","阪南市","한난시"],"桜ガ丘":["Sakuragaoka","樱丘","사쿠라가오카"],"桜ケ丘":["Sakuragaoka","樱丘","사쿠라가오카"],"三ツ松":["Mitsumatsu","三ツ松","미츠마츠"],"三ツ島":["Mitsujima","三ツ岛","미츠지마"],"三田市":["Sanda","三田市","산다시"],"三木市":["Miki","三木市","미키시"],"山科区":["Yamashina Ward","山科区","야마시나구"],"山武市":["Sanmu","山武市","산무시"],"自然田":["Jinenda","自然田","지넨다"],"若江南":["Wakaeminami","若江南","와카에미나미"],"若松台":["Wakamatsudai","若松台","와카마츠다이"],"若草町":["Wakakusa","若草町","와카쿠사"],"守口市":["Moriguchi","守口市","모리구치시"],"酒門町":["Sake Mon","酒门町","사케몬"],"洲本市":["Sumoto","洲本市","스모토시"],"住吉区":["Sumiyoshi Ward","住吉区","스미요시구"],"十八条":["Ju Hachi Jo","十八条","쥬우하치죠우"],"出島町":["Dejima","出岛町","데지마"],"春日丘":["Kasuga Takashi","春日丘","카수가타카시"],"勝山北":["Katsuyamakita","胜山北","카츠야마키타"],"小橋町":["Kohashi","小桥町","코하시"],"小林東":["Kobayashihigashi","小林东","코바야시히가시"],"小路町":["Koji","小路町","코우지"],"昭和通":["Showa Dori","昭和通","쇼우와도오리"],"松屋町":["Matsuya","松屋町","마츠야"],"松原市":["Matsubara","松原市","마쓰바라시"],"上祇園":["Kamigion","上祇园","카미기온"],"上京区":["Kamigyo Ward","上京区","가미교구"],"上新庄":["Kamishinjo","上新庄","카미신죠우"],"上池田":["Kamiikeda","上池田","카미이케다"],"上牧町":["Kanmaki","上牧町","간마키초"],"上野芝":["Uenoshiba","上野芝","우에노시바"],"城東区":["Joto Ward","城东区","조토구"],"新今里":["Shinimazato","新今里","신이마자토"],"新大阪":["Shinosaka","新大阪","신오사카"],"新長田":["Shinnagata","新长田","신나가타"],"森小路":["Morishoji","森小路","모리쇼우지"],"森北町":["Morikita","森北町","모리키타"],"深阪南":["Fukasakaminami","深阪南","후카사카미나미"],"神戸市":["Kobe","神户市","고베시"],"神戸南":["Kobe Minami","神户南","코우베미나미"],"神前町":["Shinzen","神前町","신젠"],"仁川町":["Nigawa","仁川町","니가와"],"須磨区":["Suma Ward","须磨区","스마구"],"吹田市":["Suita","吹田市","스이타시"],"垂水区":["Tarumi Ward","垂水区","다루미구"],"水戸市":["Mito","水户市","미토시"],"水木通":["Mizukidori","水木通","미즈키도오리"],"菅原町":["Sugawara","菅原町","수가와라"],"菅原通":["Sugawara Toru","菅原通","수가와라토오루"],"成田町":["Narita","成田町","나리타"],"晴美台":["Harumidai","晴美台","하루미다이"],"清水丘":["Shimizu Takashi","清水丘","시미즈타카시"],"生野区":["Ikuno Ward","生野区","이쿠노구"],"生野西":["Ikunonishi","生野西","이쿠노니시"],"西ノ京":["Nishinokyo","西ノ京","니시노쿄우"],"西宮原":["Nishimiyahara","西宫原","니시미야하라"],"西宮市":["Nishinomiya","西宫市","니시노미야시"],"西京区":["Saikyo Ward","西京区","사이쿄구"],"西古室":["Nishikomuro","西古室","니시코무로"],"西真美":["Nishimami","西真美","니시마미"],"西成区":["Nishinari Ward","西成区","니시나리구"],"西船橋":["Nishifunabashi","西船桥","니시후나바시"],"西中島":["Nishinakajima","西中岛","니시나카지마"],"石津町":["Ishizu","石津町","이시즈"],"赤坂台":["Akasaka Dai","赤坂台","아카사카다이"],"千本中":["Senbonnaka","千本中","센본나카"],"千本北":["Senbonkita","千本北","센본키타"],"川岸町":["Kawagishi","川岸町","카와기시"],"泉ケ丘":["Izumigaoka","泉丘","이즈미가오카"],"泉佐野":["Izumisano","泉佐野","이즈미사노"],"惣山町":["Soyama","惣山町","소우야마"],"多治井":["Tajii","多治井","타지이"],"太秦桜":["Uzumasa Sakura","太秦樱","우즈마사사쿠라"],"大冠町":["Daikan","大冠町","다이칸"],"大阪市":["Osaka City","大阪市","오사카시"],"大庄北":["Oshokita","大庄北","오쇼우키타"],"大正区":["Taisho Ward","大正区","다이쇼구"],"大道南":["Omichiminami","大道南","오미치미나미"],"大美野":["Omino","大美野","오미노"],"大蓮東":["Ohasuhigashi","大莲东","오하수히가시"],"谷口町":["Taniguchi","谷口町","타니구치"],"丹波市":["Tamba","丹波市","단바시"],"淡路町":["Awaji","淡路町","아와지"],"段上町":["Danjo","段上町","단죠우"],"池浦町":["Ikeura","池浦町","이케우라"],"池田市":["Ikeda","池田市","이케다시"],"竹城台":["Takeshirodai","竹城台","타케시로다이"],"竹渕東":["Takefuchihigashi","竹渕东","타케후치히가시"],"茶山台":["Chayamadai","茶山台","챠야마다이"],"中央区":["Chuo Ward","中央区","주오구"],"中京区":["Nakagyo Ward","中京区","나카교구"],"中尾町":["Nakao","中尾町","나카오"],"中北町":["Nakakita","中北町","나카키타"],"忠岡町":["Tadaoka","忠冈町","다다오카초"],"朝日町":["Asahi","朝日町","아사히"],"長栄寺":["Choeiji","长荣寺","쵸우에이지"],"長楽町":["Nagara","长乐町","나가라"],"長田区":["Nagata Ward","长田区","나가타구"],"塚口町":["Tsukaguchi","冢口町","츠카구치"],"鶴見橋":["Tsurumibashi","鹤见桥","츠루미바시"],"鶴見区":["Tsurumi Ward","鹤见区","쓰루미구"],"鶴山台":["Tsuruyamadai","鹤山台","츠루야마다이"],"庭代台":["Niwashirodai","庭代台","니와시로다이"],"天美東":["Amamihigashi","天美东","아마미히가시"],"田辺市":["Tanabe","田边市","다나베시"],"都島区":["Miyakojima Ward","都岛区","미야코지마구"],"土師町":["Haji","土师町","하지"],"土塔町":["Doto","土塔町","도토우"],"唐櫃台":["Karatodai","唐柜台","카라토다이"],"島江町":["Shimae","岛江町","시마에"],"東今里":["Higashiimazato","东今里","히가시이마자토"],"東山区":["Higashiyama Ward","东山区","히가시야마구"],"東山町":["Higashiyama","东山町","히가시야마"],"東新町":["Toshin","东新町","토우신"],"東成区":["Higashinari Ward","东成区","히가시나리구"],"東中島":["Higashinakashima","东中岛","히가시나카시마"],"東灘区":["Higashinada Ward","东滩区","히가시나다구"],"東板持":["Higashiitamochi","东板持","히가시이타모치"],"東粉浜":["Higashikohama","东粉滨","히가시코하마"],"東洋町":["Toyo","东洋町","도요초"],"藤ヶ丘":["Fujigaoka","藤丘","후지가오카"],"藤井寺":["Fujiidera","藤井寺","후지이데라"],"藤田町":["Fujita","藤田町","후지타"],"奈良市":["Nara City","奈良市","나라시"],"内本町":["Uchimoto","内本町","우치모토"],"南新町":["Minamishin","南新町","미나미신"],"南津守":["Minamitsumori","南津守","미나미츠모리"],"南野田":["Minaminoda","南野田","미나미노다"],"南余部":["Minamiamabe","南余部","미나미아마베"],"尼崎市":["Amagasaki","尼崎市","아마가사키시"],"日根野":["Hineno","日根野","히네노"],"能登町":["Noto","能登町","노토"],"背戸口":["Setoguchi","背户口","세토구치"],"伯太町":["Hakuta","伯太町","하쿠타"],"柏原市":["Kashiwara","柏原市","가시와라시"],"柏村町":["Kashiwa Mura","柏村町","카시와무라"],"八尾市":["Yao","八尾市","야오시"],"板宿町":["Itayado","板宿町","이타야도"],"尾崎町":["Ozaki","尾崎町","오자키"],"尾生町":["Obu","尾生町","오부"],"美原区":["Mihara Ward","美原区","미하라구"],"美作町":["Mimasaka","美作町","미마사카"],"浜口西":["Hamaguchinishi","滨口西","하마구치니시"],"浜中町":["Hamanaka","滨中町","하마나카"],"富秋町":["Tomiaki","富秋町","토미아키"],"武庫町":["Muko","武库町","무코"],"伏見区":["Fushimi Ward","伏见区","후시미구"],"伏尾台":["Fushiodai","伏尾台","후시오다이"],"福山市":["Fukuyama","福山市","후쿠야마시"],"福島区":["Fukushima Ward","福岛区","후쿠시마구"],"分銅町":["Fundo","分铜町","훈도우"],"兵庫区":["Hyogo Ward","兵库区","효고구"],"平岡町":["Hiraoka","平冈町","히라오카"],"平野区":["Hirano Ward","平野区","히라노구"],"米山台":["Yoneyamadai","米山台","요네야마다이"],"片山町":["Katayama","片山町","카타야마"],"菩提町":["Bodai","菩提町","보다이"],"宝塚市":["Takarazuka","宝冢市","다카라즈카시"],"豊岡市":["Toyooka","丰冈市","도요오카시"],"豊中市":["Toyonaka","丰中市","도요나카시"],"北信太":["Kitashinoda","北信太","키타시노다"],"北新町":["Kitashin","北新町","키타신"],"北野町":["Kitano","北野町","키타노"],"北野田":["Kitanoda","北野田","키타노다"],"堀上町":["Horigami","堀上町","호리가미"],"枚方市":["Hirakata","枚方市","히라카타시"],"末広町":["Suehiro","末广町","수에히로"],"箕面市":["Minoh","箕面市","미노오시"],"門真市":["Kadoma","门真市","가도마시"],"野尻町":["Nojiri","野尻町","노지리"],"淀川区":["Yodogawa Ward","淀川区","요도가와구"],"涼風町":["Suzukaze","凉风町","수즈카제"],"浪速区":["Naniwa Ward","浪速区","나니와구"],"和泉市":["Izumi","和泉市","이즈미시"],"茱萸木":["Kuminoki","茱萸木","쿠미노키"],"槇塚台":["Makizukadai","槇冢台","마키즈카다이"],"レ第":["Re Dai","レ第","레다이"],"阿保":["Aho","阿保","아호"],"旭区":["Asahi Ward","旭区","아사히구"],"芦屋":["Ashiya","芦屋","아시야"],"安立":["Adachi","安立","아다치"],"衣摺":["Kizuri","衣折","키즈리"],"瓜破":["Uriwari","瓜破","우리와리"],"王子":["Oji","王子","오지"],"沖渡":["Oki Wataru","冲渡","오키와타루"],"恩智":["Onji","恩智","온지"],"下松":["Kudamatsu","下松","쿠다마츠"],"下牧":["Shimomaki","下牧","시모마키"],"加美":["Kami","加美","카미"],"海塚":["Umizuka","海冢","우미즈카"],"貝塚":["Kaizuka","贝冢","카이즈카"],"学園":["Gakuen","学园","가쿠엔"],"岸城":["Kishiki","岸城","키시키"],"丘西":["Oka Nishi","丘西","오카니시"],"丘北":["Oka Kita","丘北","오카키타"],"久保":["Kubo","久保","쿠보"],"宮原":["Miyahara","宫原","미야하라"],"桑畑":["Kuwabatake","桑畑","쿠와바타케"],"元町":["Moto","元町","모토"],"原田":["Harada","原田","하라다"],"御崎":["Onzaki","御崎","온자키"],"公園":["Park","公园","공원"],"港区":["Minato Ward","港区","미나토구"],"香芝":["Kashiba","香芝","카시바"],"高丸":["Takamaru","高丸","타카마루"],"高鷲":["Takasu","高鹫","타카수"],"国府":["Kokufu","国府","코쿠후"],"今熊":["Imakuma","今熊","이마쿠마"],"堺駅":["Sakai Station","堺站","사카이역"],"堺区":["Sakai Ward","堺区","사카이구"],"堺市":["Sakai","堺市","사카이시"],"三先":["San Saki","三先","산사키"],"山王":["Sanno","山王","산노우"],"耳原":["Minohara","耳原","미노하라"],"七道":["Shichido","七道","시치도우"],"取石":["Toriishi","取石","토리이시"],"寿町":["Kotobuki","寿町","코토부키"],"初芝":["Hatsushiba","初芝","하츠시바"],"小山":["Koyama","小山","코야마"],"小瀬":["Kose","小濑","코세"],"小浜":["Obama","小滨","오바마"],"樟葉":["Kuzuha","樟叶","쿠즈하"],"上町":["Ue","上町","우에"],"上田":["Ueda","上田","우에다"],"上之":["Ueno","上之","우에노"],"食満":["Kema","食满","케마"],"深井":["Fukai","深井","후카이"],"深阪":["Fukasaka","深阪","후카사카"],"深日":["Fuke","深日","후케"],"水走":["Mizuhai","水走","미즈하이"],"菅原":["Sugawara","菅原","수가와라"],"西浦":["Nishiura","西浦","니시우라"],"西区":["Nishi Ward","西区","니시구"],"西脇":["Nishiwaki","西脇","니시와키"],"青木":["Aoki","青木","아오키"],"川北":["Kawakita","川北","카와키타"],"船岡":["Funaoka","船冈","후나오카"],"草部":["Kusakabe","草部","쿠사카베"],"太田":["Ota","太田","오타"],"大開":["Ohiraki","大开","오히라키"],"大宮":["Omiya","大宫","오미야"],"大原":["Ohara","大原","오하라"],"大国":["Taikoku","大国","타이코쿠"],"大黒":["Daikoku","大黑","다이코쿠"],"大道":["Daido","大道","다이도우"],"淡輪":["Tannowa","淡轮","탄노와"],"池田":["Ikeda","池田","이케다"],"築港":["Chikko","筑港","칫코우"],"竹島":["Takeshima","竹岛","타케시마"],"竹渕":["Takefuchi","竹渕","타케후치"],"茶屋":["Chaya","茶屋","챠야"],"中郷":["Nakago","中乡","나카고우"],"中区":["Naka Ward","中区","나카구"],"中庄":["Nakasho","中庄","나카쇼우"],"中川":["Nakagawa","中川","나카가와"],"中町":["Naka","中町","나카"],"中島":["Nakajima","中岛","나카지마"],"中本":["Nakamoto","中本","나카모토"],"中野":["Nakano","中野","나카노"],"忠岡":["Tadaoka","忠冈","타다오카"],"塚本":["Tsukamoto","冢本","츠카모토"],"辻之":["Tsujino","辻之","츠지노"],"蔦屋":["Tsuta Ya","茑屋","츠타야"],"鶴橋":["Tsuruhashi","鹤桥","츠루하시"],"鶴町":["Tsuru","鹤町","츠루"],"伝法":["Denbo","传法","덴보우"],"田川":["Tagawa","田川","타가와"],"島泉":["Shimaizumi","岛泉","시마이즈미"],"島頭":["Shimagashira","岛头","시마가시라"],"東区":["Higashi Ward","东区","히가시구"],"東山":["Higashiyama","东山","히가시야마"],"桃谷":["Momodani","桃谷","모모다니"],"酉島":["Torishima","酉岛","토리시마"],"灘区":["Nada Ward","滩区","나다구"],"南区":["Minami Ward","南区","미나미구"],"二色":["Nishiki","二色","니시키"],"梅香":["Ume Kaori","梅香","우메카오리"],"箱作":["Hakotsukuri","箱作","하코츠쿠리"],"半田":["Handa","半田","한다"],"板宿":["Itayado","板宿","이타야도"],"姫島":["Himeshima","姫岛","히메시마"],"姫里":["Himesato","姫里","히메사토"],"伏見":["Fushimi","伏见","후시미"],"福田":["Fukuda","福田","후쿠다"],"文里":["Mori","文里","모리"],"平尾":["Hirao","平尾","히라오"],"平野":["Hirano","平野","히라노"],"弁天":["Benten","辨天","벤텐"],"豊田":["Toyoda","丰田","토요다"],"豊里":["Toyosato","丰里","토요사토"],"北区":["Kita Ward","北区","기타구"],"北村":["Kitamura","北村","키타무라"],"北島":["Kitajima","北岛","키타지마"],"北畠":["Kitabatake","北畠","키타바타케"],"万代":["Bandai","万代","반다이"],"岬町":["Misaki","岬町","미사키초"],"名塩":["Najio","名盐","나지오"],"木戸":["Kido","木户","키도"],"野根":["None","野根","노네"],"野中":["Nonaka","野中","노나카"],"弥刀":["Mito","弥刀","미토"],"矢田":["Yada","矢田","야다"],"友井":["Tomoi","友井","토모이"],"流町":["Ryu","流町","류우"],"緑町":["Midori","绿町","미도리"],"林寺":["Hayashiji","林寺","하야시지"],"老原":["Oihara","老原","오이하라"],"六条":["Roku Jo","六条","로쿠죠우"],"脇浜":["Wakihama","脇滨","와키하마"]};
const ORI_PLACE_EXTRA={
"指定エリア":["the selected area","所选区域","선택한 지역"],
"選択した市":["the selected city","所选城市","선택한 시"],
"福知山市":["Fukuchiyama","福知山市","후쿠치야마시"],
"四条畷市":["Shijonawate","四条畷市","시조나와테시"],
"神石市之町":["Kamiishiichino","神石市之町","가미이시이치노"],
"静市市原町":["Shizuichi Ichihara","静市市原町","시즈이치이치하라"],
"三和町":["Miwa","三和町","미와초"],
"大身":["Omi","大身","오미"],
"市岡元町":["Ichiokamoto","市冈元町","이치오카모토"],
"市岡":["Ichioka","市冈","이치오카"],
"勝山":["Katsuyama","胜山","가츠야마"],
"諏訪森":["Suwanomori","诹访森","스와노모리"],
"諏訪":["Suwa","诹访","스와"],
"さくら台":["Sakuradai","樱台","사쿠라다이"],
"箱の浦":["Hakonoura","箱之浦","하코노우라"],
"市場西":["Ichibanishi","市场西","이치바니시"],
"滝の茶屋":["Takinochaya","泷之茶屋","타키노차야"],
"四天王寺":["Shitennoji","四天王寺","시텐노지"],
"野村":["Nomura","野村","노무라"],
"古市":["Furuichi","古市","후루이치"],
"宿院":["Shukuin","宿院","슈쿠인"],
"甲南灘":["Konan Nada","甲南滩","고난나다"],
"甲南":["Konan","甲南","고난"],
"佐伯":["Saeki","佐伯","사에키"],
"津久野台":["Tsukunodai","津久野台","츠쿠노다이"],
"尼崎":["Amagasaki","尼崎","아마가사키"],
"宝塚":["Takarazuka","宝冢","다카라즈카"],
"花山":["Hanayama","花山","하나야마"],
"諏訪ノ森":["Suwanomori","诹访之森","스와노모리"],
"太秦桜が丘":["Uzumasa Sakuragaoka","太秦樱丘","우즈마사사쿠라가오카"],
"桜が丘":["Sakuragaoka","樱丘","사쿠라가오카"]
};
const ORI_PLACE_LOOSE={
"堤":["Tsutsumi","堤","쓰쓰미"],
"澤":["Sawa","泽","사와"],
"堀":["Hori","堀","호리"],
"薗":["Sono","园","소노"],
"幸":["Saiwai","幸","사이와이"],
"松":["Matsu","松","마쓰"],
"橘":["Tachibana","橘","다치바나"],
"舞":["Mai","舞","마이"],
"堺":["Sakai","堺","사카이"],
"灘":["Nada","滩","나다"],
"上":["Ue","上","우에"],
"中":["Naka","中","나카"],
"駅":["Station","站","역"],
"森":["Mori","森","모리"],
"丘":["Oka","丘","오카"]
};
const ORI_TERMS=[["資材置き場",["Storage yard","材料堆场","자재 보관장"]],["貸戸建",["Detached rental","出租独栋","임대 주택"]],["駐車場",["Parking","停车场","주차장"]],["事務所",["Office","事务所","사무실"]],["【賃貸】",["[For rent] ","【出租】","【임대】 "]],["賃貸",["For rent","出租","임대"]],["貸家",["House for rent","出租住宅","임대 주택"]],["倉庫",["Warehouse","仓库","창고"]],["店舗",["Shop","店铺","가게"]],["部屋",["room","房间","방"]],["畳",["Tatami","榻榻米","다다미"]],["インターネット無料",["free internet","免费上网","인터넷 무료"]],["ネット無料",["free internet","免费上网","인터넷 무료"]],["オートロック",["auto-lock","自动锁","자동 잠금"]],["バス・トイレ",["bath and toilet","浴室和卫生间","욕실·화장실"]],["女性限定",["women only","仅限女性","여성 전용"]],["駐輪場",["bicycle parking","自行车停放处","자전거 주차장"]],["ワンルーム",["studio","单间","원룸"]],["南向き",["south-facing","朝南","남향"]],["角部屋",["corner unit","角房","코너 방"]],["ペット",["pets","宠物","반려동물"]]].sort((a,b)=>b[0].length-a[0].length);
const ORI_PLACE_RULES=Object.keys(ORI_PLACES).sort((a,b)=>b.length-a.length).map(name=>[name]);
const ORI_KATA=[["オリエントシティ",["Orient City","Orient City","오리엔트 시티"]],["サンライズ",["Sunrise","日出","선라이즈"]],["マンション",["Condo","公寓","맨션"]],["コーポラス",["Corpo","公寓","코포라스"]],["ハイツ",["Heights","高地住宅","하이츠"]],["ガーデン",["Garden","花园","가든"]],["グリーン",["Green","Green","그린"]],["オリエント",["Orient","Orient","오리엔트"]],["アパート",["Apartment","公寓","아파트"]],["メゾン",["Maison","住宅","메종"]],["タワー",["Tower","塔","타워"]],["コート",["Court","苑","코트"]],["パーク",["Park","公园","파크"]],["シティ",["City","城","시티"]],["プリッ",["Pri","Pri","프리"]],["ステュディオ",["Studio","工作室","스튜디오"]],["フェニックス",["Phoenix","凤凰","피닉스"]]].sort((a,b)=>b[0].length-a[0].length);
function oriHepburn(kana){const src=kana.normalize("NFKC"),mora=[];const digraphs=["キャ","キュ","キョ","シャ","シュ","ショ","チャ","チュ","チョ","ニャ","ニュ","ニョ","ヒャ","ヒュ","ヒョ","ミャ","ミュ","ミョ","リャ","リュ","リョ","ギャ","ギュ","ギョ","ジャ","ジュ","ジョ","ビャ","ビュ","ビョ","ピャ","ピュ","ピョ","ファ","フィ","フェ","フォ","ティ","ディ","ジェ","チェ"];for(let i=0;i<src.length;i+=1){const pair=src.slice(i,i+2);if(digraphs.includes(pair)){mora.push(pair);i+=1;continue}mora.push(src[i])}const map={ア:"a",イ:"i",ウ:"u",エ:"e",オ:"o",カ:"ka",キ:"ki",ク:"ku",ケ:"ke",コ:"ko",サ:"sa",シ:"shi",ス:"su",セ:"se",ソ:"so",タ:"ta",チ:"chi",ツ:"tsu",テ:"te",ト:"to",ナ:"na",ニ:"ni",ヌ:"nu",ネ:"ne",ノ:"no",ハ:"ha",ヒ:"hi",フ:"fu",ヘ:"he",ホ:"ho",マ:"ma",ミ:"mi",ム:"mu",メ:"me",モ:"mo",ヤ:"ya",ユ:"yu",ヨ:"yo",ラ:"ra",リ:"ri",ル:"ru",レ:"re",ロ:"ro",ワ:"wa",ヲ:"o",ン:"n",ガ:"ga",ギ:"gi",グ:"gu",ゲ:"ge",ゴ:"go",ザ:"za",ジ:"ji",ズ:"zu",ゼ:"ze",ゾ:"zo",ダ:"da",ヂ:"ji",ヅ:"zu",デ:"de",ド:"do",バ:"ba",ビ:"bi",ブ:"bu",ベ:"be",ボ:"bo",パ:"pa",ピ:"pi",プ:"pu",ペ:"pe",ポ:"po",ヴ:"vu",キャ:"kya",キュ:"kyu",キョ:"kyo",シャ:"sha",シュ:"shu",ショ:"sho",チャ:"cha",チュ:"chu",チョ:"cho",ニャ:"nya",ニュ:"nyu",ニョ:"nyo",ヒャ:"hya",ヒュ:"hyu",ヒョ:"hyo",ミャ:"mya",ミュ:"myu",ミョ:"myo",リャ:"rya",リュ:"ryu",リョ:"ryo",ギャ:"gya",ギュ:"gyu",ギョ:"gyo",ジャ:"ja",ジュ:"ju",ジョ:"jo",ビャ:"bya",ビュ:"byu",ビョ:"byo",ピャ:"pya",ピュ:"pyu",ピョ:"pyo",ファ:"fa",フィ:"fi",フェ:"fe",フォ:"fo",ティ:"ti",ディ:"di",ジェ:"je",チェ:"che"};let out="";for(let i=0;i<mora.length;i+=1){const item=mora[i];if(item==="ー")continue;if(item==="ッ"||item==="っ"){const next=map[mora[i+1]]||"";out+=next.startsWith("ch")?"t":(next[0]||"");continue}if((item==="ウ"||item==="う")&&/o$/.test(out))continue;const piece=map[item];if(!piece)return kana;if((piece==="o"&&out.endsWith("o"))||(piece==="u"&&out.endsWith("u"))||(piece==="e"&&out.endsWith("e"))||(piece==="a"&&out.endsWith("a")))continue;if(piece==="n"&&out.endsWith("n"))out+="'";out+=piece}return out?out[0].toUpperCase()+out.slice(1):kana}
function oriHangul(kana){const src=kana.normalize("NFKC").replace(/オウ/g,"オ").replace(/オオ/g,"オ").replace(/ウウ/g,"ウ");const units={ア:["ㅇ","ㅏ"],イ:["ㅇ","ㅣ"],ウ:["ㅇ","ㅜ"],エ:["ㅇ","ㅔ"],オ:["ㅇ","ㅗ"],カ:["ㅋ","ㅏ"],キ:["ㅋ","ㅣ"],ク:["ㅋ","ㅜ"],ケ:["ㅋ","ㅔ"],コ:["ㅋ","ㅗ"],サ:["ㅅ","ㅏ"],シ:["ㅅ","ㅣ"],ス:["ㅅ","ㅜ"],セ:["ㅅ","ㅔ"],ソ:["ㅅ","ㅗ"],タ:["ㅌ","ㅏ"],チ:["ㅊ","ㅣ"],ツ:["ㅊ","ㅡ"],テ:["ㅌ","ㅔ"],ト:["ㅌ","ㅗ"],ナ:["ㄴ","ㅏ"],ニ:["ㄴ","ㅣ"],ヌ:["ㄴ","ㅜ"],ネ:["ㄴ","ㅔ"],ノ:["ㄴ","ㅗ"],ハ:["ㅎ","ㅏ"],ヒ:["ㅎ","ㅣ"],フ:["ㅎ","ㅜ"],ヘ:["ㅎ","ㅔ"],ホ:["ㅎ","ㅗ"],マ:["ㅁ","ㅏ"],ミ:["ㅁ","ㅣ"],ム:["ㅁ","ㅜ"],メ:["ㅁ","ㅔ"],モ:["ㅁ","ㅗ"],ヤ:["ㅇ","ㅑ"],ユ:["ㅇ","ㅠ"],ヨ:["ㅇ","ㅛ"],ラ:["ㄹ","ㅏ"],リ:["ㄹ","ㅣ"],ル:["ㄹ","ㅜ"],レ:["ㄹ","ㅔ"],ロ:["ㄹ","ㅗ"],ワ:["ㅇ","ㅘ"],ヲ:["ㅇ","ㅗ"],ガ:["ㄱ","ㅏ"],ギ:["ㄱ","ㅣ"],グ:["ㄱ","ㅜ"],ゲ:["ㄱ","ㅔ"],ゴ:["ㄱ","ㅗ"],ザ:["ㅈ","ㅏ"],ジ:["ㅈ","ㅣ"],ズ:["ㅈ","ㅡ"],ゼ:["ㅈ","ㅔ"],ゾ:["ㅈ","ㅗ"],ダ:["ㄷ","ㅏ"],ヂ:["ㅈ","ㅣ"],ヅ:["ㅈ","ㅡ"],デ:["ㄷ","ㅔ"],ド:["ㄷ","ㅗ"],バ:["ㅂ","ㅏ"],ビ:["ㅂ","ㅣ"],ブ:["ㅂ","ㅜ"],ベ:["ㅂ","ㅔ"],ボ:["ㅂ","ㅗ"],パ:["ㅍ","ㅏ"],ピ:["ㅍ","ㅣ"],プ:["ㅍ","ㅜ"],ペ:["ㅍ","ㅔ"],ポ:["ㅍ","ㅗ"],キャ:["ㅋ","ㅑ"],キュ:["ㅋ","ㅠ"],キョ:["ㅋ","ㅛ"],シャ:["ㅅ","ㅑ"],シュ:["ㅅ","ㅠ"],ショ:["ㅅ","ㅛ"],チャ:["ㅊ","ㅑ"],チュ:["ㅊ","ㅠ"],チョ:["ㅊ","ㅛ"],ニャ:["ㄴ","ㅑ"],ニュ:["ㄴ","ㅠ"],ニョ:["ㄴ","ㅛ"],ヒャ:["ㅎ","ㅑ"],ヒュ:["ㅎ","ㅠ"],ヒョ:["ㅎ","ㅛ"],ミャ:["ㅁ","ㅑ"],ミュ:["ㅁ","ㅠ"],ミョ:["ㅁ","ㅛ"],リャ:["ㄹ","ㅑ"],リュ:["ㄹ","ㅠ"],リョ:["ㄹ","ㅛ"],ギャ:["ㄱ","ㅑ"],ギュ:["ㄱ","ㅠ"],ギョ:["ㄱ","ㅛ"],ジャ:["ㅈ","ㅑ"],ジュ:["ㅈ","ㅠ"],ジョ:["ㅈ","ㅛ"],ビャ:["ㅂ","ㅑ"],ビュ:["ㅂ","ㅠ"],ビョ:["ㅂ","ㅛ"],ピャ:["ㅍ","ㅑ"],ピュ:["ㅍ","ㅠ"],ピョ:["ㅍ","ㅛ"]};const cho=["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"],jung=["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"],jong=["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];const compose=(a,b,c="")=>String.fromCharCode(44032+(cho.indexOf(a)*21+jung.indexOf(b))*28+jong.indexOf(c));let out="",pending=null;const flush=j=>{if(!pending)return;out+=compose(pending[0],pending[1],j);pending=null};for(let i=0;i<src.length;i+=1){const pair=src.slice(i,i+2),item=units[pair]?pair:src[i];if(item===pair)i+=1;if(item==="ー")continue;if(item==="ッ"){flush("ㅅ");continue}if(item==="ン"){flush("ㄴ");continue}const unit=units[item];if(!unit)return"";flush();pending=unit}flush();return out}
function oriKana(kana, lang){if(lang==="ko"){const converted=oriHangul(kana);if(converted)return converted}return oriHepburn(kana)}
function oriYenText(raw, lang){const yen=Math.round(Number(String(raw).replace(/,/g,""))*10000);if(!Number.isFinite(yen))return raw;if(lang==="en"){if(yen>=1000000){const millions=yen/1000000;return (Number.isInteger(millions)?String(millions):millions.toFixed(1))+" million yen"}return yen.toLocaleString("en-US")+" yen"}if(lang==="zh")return raw+"万日元";return raw+"만 엔"}
function oriApplyPlaces(text, lang){if(!text||lang==="ja"||!ORI_HELLO[lang])return text;const pack=oriPack(lang);let out=text;const placeLabels=new Map(ORI_PLACE_RULES.map(([name])=>[name,ORI_PLACES[name]]));for(const [name,label] of Object.entries(ORI_PLACE_EXTRA))placeLabels.set(name,label);for(const name of Object.keys(ORI_PREF))placeLabels.has(name)||placeLabels.set(name,ORI_PREF[name]);for(const [name,label] of [...placeLabels]){if(!name.endsWith("区")||name.length<3)continue;const stem=name.slice(0,-1);if(stem.length<2||placeLabels.has(stem))continue;placeLabels.set(stem,label.map(item=>String(item).replace(/ Ward$/,"").replace(/区$/,"").replace(/구$/,"")))}for(const name of [...placeLabels.keys()].sort((a,b)=>b.length-a.length)){if(!out.includes(name))continue;out=out.split(name).join(placeLabels.get(name)[pack]+(lang==="zh"?"":" "))}out=out.replace(/(?<![\p{Script=Han}])東(?![\p{Script=Han}])/gu,lang==="en"?"East ":lang==="zh"?"东":"동 ");out=out.replace(/(?<![\p{Script=Han}])西(?![\p{Script=Han}])/gu,lang==="en"?"West ":lang==="zh"?"西":"서 ");out=out.replace(/(?<![\p{Script=Han}])南(?![\p{Script=Han}])/gu,lang==="en"?"South ":lang==="zh"?"南":"남 ");out=out.replace(/(?<![\p{Script=Han}])北(?![\p{Script=Han}])/gu,lang==="en"?"North ":lang==="zh"?"北":"북 ");out=out.split("新築").join(lang==="en"?"New ":lang==="zh"?"新建":"신축 ");out=out.split("中古").join(lang==="en"?"Pre-owned ":lang==="zh"?"二手":"중고 ");for(const [name,label] of Object.entries(ORI_PLACE_LOOSE))out=out.replace(new RegExp("(?<![\\p{Script=Han}])"+name+"(?![\\p{Script=Han}])","gu"),label[pack]+(lang==="zh"?"":" "));for(const [name,label] of ORI_TERMS)out=out.split(name).join(label[pack]);const oriKanjiNum={一:"1",二:"2",三:"3",四:"4",五:"5",六:"6",七:"7",八:"8",九:"9",十:"10",壱:"1",弐:"2",参:"3"};out=out.replace(/[壱弐参](?=[号番])/g,ch=>oriKanjiNum[ch]);out=out.replace(/([一二三四五六七八九十]+)番館/g,(_,raw)=>{const num=[...raw].map(ch=>oriKanjiNum[ch]||ch).join("");return lang==="en"?"Building "+num+" ":lang==="zh"?num+"号馆":num+"번관 "});out=out.replace(/(\d+)\s*番館/g,(_,n)=>lang==="en"?"Building "+n+" ":lang==="zh"?n+"号馆":n+"번관 ");out=out.replace(/([A-Za-z0-9]+)\s*号地/g,(_,n)=>lang==="en"?"Lot "+n+" ":lang==="zh"?n+"号地":n+"번 필지 ");out=out.replace(/([A-Za-z0-9]+)\s*号室/g,(_,n)=>lang==="en"?"Unit "+n+" ":lang==="zh"?n+"室":n+"호 ");out=out.replace(/([A-Za-z])\s*棟/g,(_,n)=>lang==="en"?"Building "+n+" ":lang==="zh"?n+"栋":n+"동 ");out=out.replace(/(\d+)\s*丁(?!目)/g,(_,n)=>lang==="en"?n+"-chome ":lang==="zh"?n+"丁目":n+"초메 ");out=out.replace(/(\d+)\s*室/g,(_,n)=>lang==="en"?n+" units ":lang==="zh"?n+"户":n+"실 ");out=out.replace(/(\d+)\s*部屋/g,(_,n)=>lang==="en"?n+" rooms ":lang==="zh"?n+"间":n+"실 ");out=out.replace(/(\d+)\s*台/g,(_,n)=>lang==="en"?n+" spaces ":lang==="zh"?n+"个":n+"대 ");out=out.replace(/第(\d+)/g,(_,n)=>lang==="en"?"No. "+n+" ":lang==="zh"?"第"+n+" ":n+"번 ");out=out.replace(/第([一二三四五六七八九十])/g,(_,ch)=>{const num=oriKanjiNum[ch]||ch;return lang==="en"?"No. "+num+" ":lang==="zh"?"第"+num+" ":num+"번 "});out=out.replace(/(\d+)\s*号(?![室地棟楼])/g,(_,n)=>lang==="en"?"No. "+n+" ":lang==="zh"?n+"号":n+"호 ");out=out.replace(/([一二三四五六七八九十]+)番町/g,(_,raw)=>{const num=[...raw].map(ch=>({一:"1",二:"2",三:"3",四:"4",五:"5",六:"6",七:"7",八:"8",九:"9",十:"10"})[ch]||ch).join("");return lang==="en"?num+"-bancho ":lang==="zh"?num+"番町":num+"번정 "});out=out.replace(/(\d+)\s*丁目/g,(_,n)=>lang==="en"?n+"-chome ":lang==="zh"?n+"丁目":n+"초메 ");out=out.replace(/(\d+)\s*番地/g,(_,n)=>lang==="en"?"no. "+n+" ":lang==="zh"?n+"号":n+"번지 ");out=out.replace(/([A-Za-z0-9]+)\s*号棟/g,(_,n)=>lang==="en"?"Building "+n+" ":lang==="zh"?n+"号楼":n+"동 ");out=out.replace(/(\d+)\s*期/g,(_,n)=>lang==="en"?"Phase "+n+" ":lang==="zh"?n+"期":n+"기 ");out=out.replace(/([\d,]+(?:\.\d+)?)\s*万円/g,(_,n)=>oriYenText(n, lang));out=out.replace(/([\d,]+)\s*円/g,(_,n)=>{const value=Number(n.replace(/,/g,""));if(!Number.isFinite(value))return n;if(lang==="en")return value.toLocaleString("en-US")+" yen";if(lang==="zh")return n+"日元";return n+"엔"});for(const [name,translated] of ORI_KATA)out=out.split(name).join(translated[pack]);out=out.replace(/[ァ-ヶー]{2,}/g,kana=>oriKana(kana, lang));return out.replace(/[ \t]{2,}/g," ").replace(/ +([,.:])/g,"$1").replace(/ +\n/g,"\n").trim()}

function oriPlace(name, lang){
  if(ORI_PLACES[name])return ORI_PLACES[name][oriPack(lang)];
  if(ORI_PLACE_EXTRA[name])return ORI_PLACE_EXTRA[name][oriPack(lang)];
  return ORI_PREF[name]?ORI_PREF[name][oriPack(lang)]:name;
}
function oriType(name, lang){
  const parts=String(name||"").split(/[、,]/).map(part=>part.trim()).filter(Boolean);
  if(!parts.length)return name;
  const pack=oriPack(lang);
  const keys=Object.keys(ORI_TYPES).sort((a,b)=>b.length-a.length);
  return parts.map(part=>{
    if(ORI_TYPES[part])return ORI_TYPES[part][pack];
    let out=part;
    for(const key of keys)if(out.includes(key))out=out.split(key).join(ORI_TYPES[key][pack]);
    return out;
  }).join(lang==="en"?" / ":lang==="zh"?"、":"·");
}
function oriWalk(minutes, lang){
  if(lang==="zh")return `步行${minutes}分钟`;
  if(lang==="ko")return `도보 ${minutes}분`;
  return `${minutes}-min walk`;
}
function oriSaleLine(line, lang){
  const matched=line.match(/^- (.+?)：(.+?)、販売価格(.+?)(?:、((?:\d+S*)?(?:LDK|DK|K|R)[^、]*))?、(.+?)(?:、駅徒歩(\d+)分)?にゃん。\[(\d+)\]$/);
  if(!matched)return line;
  const [,title,type,price,layout,address,walk,index]=matched;
  const bits=[oriType(type, lang), lang==="en"?`price ${price}`:lang==="zh"?`售价${price}`:`판매가 ${price}`];
  if(layout)bits.push(layout);
  bits.push(address);
  if(walk)bits.push(oriWalk(walk, lang));
  const sep=lang==="en"?", ":lang==="zh"?"，":", ";
  return `- ${title}: ${bits.join(sep)}${lang==="en"?".":lang==="zh"?"。":"."} [${index}]`;
}
function oriRentLine(line, lang){
  const matched=line.match(/^- (.+?)：家賃(.+?)(?:、共益費 ([^、]+))?、([^、]+)、(.+?)(?:、駅徒歩(\d+)分)?にゃん。\[(\d+)\]$/);
  if(!matched)return line;
  const [,title,rent,fee,layout,address,walk,index]=matched;
  const bits=[lang==="en"?`rent ${rent}`:lang==="zh"?`租金${rent}`:`월세 ${rent}`];
  if(fee)bits.push(lang==="en"?`common fee ${fee}`:lang==="zh"?`共益费 ${fee}`:`공익비 ${fee}`);
  if(layout)bits.push(layout==="ワンルーム"?(lang==="en"?"studio":lang==="zh"?"单间":"원룸"):layout);
  bits.push(address);
  if(walk)bits.push(oriWalk(walk, lang));
  const sep=lang==="en"?", ":lang==="zh"?"，":", ";
  return `- ${title}: ${bits.join(sep)}${lang==="en"?".":lang==="zh"?"。":"."} [${index}]`;
}
function oriTranslateLine(line, lang){
  if(line.startsWith("- ")){
    if(line.includes("販売価格"))return oriSaleLine(line, lang);
    if(line.includes("家賃"))return oriRentLine(line, lang);
  }
  return line.replace(/駅徒歩(\d+)分/g,(_,minutes)=>oriWalk(minutes, lang));
}
function oriTranslate(text, lang){
  if(!text||lang==="ja"||!ORI_HELLO[lang])return text;
  if(text.includes("あなたに会えて、とってもうれしいにゃん。")&&!text.includes("キャンペーン"))return ORI_HELLO[lang];
  const pack=oriPack(lang);
  if(typeof ORI_PHRASES!=="undefined"){
    const phrases=[...ORI_PHRASES].sort((left,right)=>right[0].length-left[0].length);
    for(const phrase of phrases)text=text.split(phrase[0]).join(phrase[pack+1]);
  }
  let out=text.replace(/\*\*(\d{4})年(\d{1,2})月(\d{1,2})日まで\*\*/g,(_,year,month,day)=>{
    const m=Number(month),d=Number(day);
    if(lang==="en")return `**Until ${ORI_MONTHS[m-1]||month} ${d}, ${year}** `;
    if(lang==="zh")return `**截至${year}年${m}月${d}日** `;
    return `**${year}년 ${m}월 ${d}일까지** `;
  });
  out=out.replace(/希望日時は (.+?) で受け付けたにゃん。担当から確認の連絡をするにゃん。/g,(all,when)=>{
    if(lang==="en")return `The requested time ${when} is booked. Staff will confirm.`;
    if(lang==="zh")return `希望时间 ${when} 已受理。负责人会联系确认。`;
    return `희망 일시 ${when}(으)로 받았어. 담당자가 확인 연락을 할게.`;
  });
  const sentences=[...ORI_SENTENCES].sort((left,right)=>right[0].length-left[0].length);
  for(const [ja,translated] of sentences)out=out.split(ja).join(translated[pack]);
  out=out.replace(/^(.+)を一緒に探すにゃん。まず、住みたい都道府県を選んでにゃん。/gm,(all,subject)=>{
    const who=oriSubject(subject, lang);
    if(lang==="en")return `Let's look for ${who}. First, pick a prefecture.`;
    if(lang==="zh")return `一起找${who}吧。请先选都道府县。`;
    return `${who}를 같이 찾아볼게. 먼저 도도부현을 골라 줘.`;
  });
  out=out.replace(/^(.+?)で(.+?)を探すにゃん。次に、市区町村を選んでにゃん。/gm,(all,place,subject)=>{
    const where=oriPlace(place, lang),who=oriSubject(subject, lang);
    if(lang==="en")return `Looking in ${where} for ${who}. Next, pick a city.`;
    if(lang==="zh")return `在${where}找${who}。接下来请选市区町村。`;
    return `${where}에서 ${who}를 찾을게. 다음으로 시구정촌을 골라 줘.`;
  });
  out=out.replace(/^(.+?)で(賃貸|購入物件)を探すにゃん。次に区を選んでにゃん。/gm,(all,place,kind)=>{
    const where=oriPlace(place, lang);
    const what=kind==="賃貸"?["a rental","租赁","임대"][pack]:["a home to buy","购房房源","구매 매물"][pack];
    if(lang==="en")return `Looking in ${where} for ${what}. Next, pick a ward.`;
    if(lang==="zh")return `在${where}找${what}。接下来请选区。`;
    return `${where}에서 ${what}를 찾을게. 다음으로 구를 골라 줘.`;
  });
  out=out.replace(/^(?:(.+?)で)?条件に合う購入物件が見つかったにゃん。/gm,(all,place)=>{
    const where=place?oriPlace(place, lang):"";
    if(lang==="en")return where?`Homes for sale in ${where} that match:`:"Homes for sale that match:";
    if(lang==="zh")return where?`在${where}找到了符合条件的购房房源：`:"找到了符合条件的购房房源：";
    return where?`${where}에서 조건에 맞는 구매 매물을 찾았어:`:"조건에 맞는 구매 매물을 찾았어:";
  });
  out=out.replace(/^(?:(.+?)で)?条件に合う居住用賃貸が見つかったにゃん。/gm,(all,place)=>{
    const where=place?oriPlace(place, lang):"";
    if(lang==="en")return where?`Rentals in ${where} that match:`:"Rentals that match:";
    if(lang==="zh")return where?`在${where}找到了符合条件的租赁房：`:"找到了符合条件的租赁房：";
    return where?`${where}에서 조건에 맞는 임대 매물을 찾았어:`:"조건에 맞는 임대 매물을 찾았어:";
  });
  out=out.replace(/^(.+)では、現在の条件に合う(?:掲載|登録)中の(賃貸|購入)物件が見つからないにゃん。条件や地域を変えて探すか、最新情報は 0120-338-101 に電話して聞いてにゃん。/gm,(all,place,kind)=>{
    const where=oriPlace(place, lang);
    const what=kind==="賃貸"?["rentals","租赁房","임대 매물"][pack]:["homes for sale","购房房源","구매 매물"][pack];
    if(lang==="en")return `Nothing listed in ${where} matches right now. Change the filters or area, or call 0120-338-101 for the latest.`;
    if(lang==="zh")return `${where}目前没有符合条件的${what}。可以改条件或地区，或致电 0120-338-101 询问最新信息。`;
    return `${where}에는 지금 조건에 맞는 ${what}이 없어. 조건이나 지역을 바꾸거나, 0120-338-101로 전화해서 최신 정보를 물어봐.`;
  });
  out=out.replace(/^「(.+)」は(?:掲載|登録)物件情報だけでは全件を正確に絞り込めないにゃん。0120-338-101 に電話して確認してにゃん。この条件を外して検索する場合は「(.+)を条件から外す」と送ってにゃん。/gm,(all,condition)=>{
    const word=oriFilterLabel(condition, lang);
    if(lang==="en")return `“${word}” cannot be filtered exactly from the listings. Please call 0120-338-101 to check. To drop it, send “remove ${word}”.`;
    if(lang==="zh")return `“${word}”无法只靠刊登信息精确筛选。请致电 0120-338-101 向负责人确认。若要去掉这个条件，请发送“去掉${word}”。`;
    return `“${word}”은 게시 정보만으로 전부 정확히 거르기 어려워. 0120-338-101로 전화해서 담당자에게 확인해 줘. 빼려면 “${word} 조건을 빼 줘”라고 보내 줘.`;
  });
  out=out.replace(/^(\d+)人家族で(.+)はかなり手狭になりそうにゃん。(.+)のまま探すか、2LDK以上に広げるか教えてにゃん。/gm,(all,count,layout)=>{
    const name=oriFilterLabel(layout, lang);
    if(lang==="en")return `A ${name} may be tight for ${count} people. Keep ${name}, or widen to 2LDK or more?`;
    if(lang==="zh")return `${count}人家庭住${name}可能会比较挤。继续找${name}，还是放到2LDK以上？`;
    return `${count}명 가족이 ${name}면 꽤 좁을 수 있어. ${name} 그대로 찾을까, 2LDK 이상으로 넓힐까?`;
  });
  out=out.replace(/^希望の間取りや条件を教えてにゃん。(.+)などから選べるにゃん。/gm,(all,examples)=>{
    const sample=examples.replaceAll("ワンルーム", lang==="en"?"studio":lang==="zh"?"单间":"원룸").replaceAll("駅からの徒歩分数", lang==="en"?"the walk from a station":lang==="zh"?"离车站的步行时间":"역에서 도보 시간").replaceAll("・", lang==="en"?", ":lang==="zh"?"、":", ").replaceAll("、", lang==="en"?", ":lang==="zh"?"、":", ");
    if(lang==="en")return `Tell me the layout or other needs. You can choose from ${sample}.`;
    if(lang==="zh")return `请告诉我户型或其他条件。可以从${sample}里选。`;
    return `원하는 구조나 조건을 알려 줘. ${sample} 중에서 고를 수 있어.`;
  });
  return oriApplyPlaces(out.split("\n").map(line=>oriTranslateLine(line, lang)).join("\n"), lang);
}
function oriTranslateChoice(label, lang){
  if(!label||lang==="ja"||!ORI_HELLO[lang])return "";
  const pack=oriPack(lang);
  const exact={
    "新築戸建て":ORI_TYPES["新築戸建て"],
    "中古戸建て":ORI_TYPES["中古戸建て"],
    "中古マンション":ORI_TYPES["中古マンション"],
    "土地":ORI_TYPES["土地"],
    "その他・事業用":ORI_TYPES["その他・事業用"],
    "こだわりなし":["No preference","不限","상관없음"],
    "間取りはこだわりなし":["Any layout","户型不限","구조 상관없음"],
    "物件種別はこだわりなし":["Any type","类型不限","종류 상관없음"],
    "もっと見る":["See more","查看更多","더 보기"],
    "もっと見たい":["See more","查看更多","더 보기"],
    "別条件で探す":["Search again","换条件再找","다른 조건으로 찾기"],
    "一つ前の条件に戻る":["Back","返回","뒤로"],
    "一つ前の回答に戻る":["Back","返回","뒤로"],
    "条件を変えて探す":["Change filters","更改条件","조건 바꾸기"],
    "資料請求":["Request documents","索取资料","자료 요청"],
    "資料請求したい":["Request documents","索取资料","자료 요청"],
    "電話":["Call","电话","전화"],
    "電話で相談したい":["Talk by phone","电话咨询","전화 상담"],
    "見学":["Visit","看房","견학"],
    "見学したい":["Visit","看房","견학"],
    "2LDK以上で探す":["Search 2LDK+","找2LDK以上","2LDK 이상으로 찾기"],
    "2LDK以上":["2LDK+","2LDK以上","2LDK 이상"],
    "そのまま探す":["Keep this layout","保持这个户型","이 구조 유지"],
    "この条件を外して検索":["Drop this filter","去掉这个条件","이 조건 빼기"],
    "ワンルーム":["Studio","单间","원룸"],
    "土地を持っている":["I have land","已有土地","땅이 있어"],
    "土地を持っていない":["I do not have land","还没有土地","땅이 없어"],
    "未定":["Not sure yet","未定","미정"],
    "男性":["Male","男性","남성"],
    "女性":["Female","女性","여성"],
    "そのほか":["Other","其他","기타"],
    "10代":["Teens","10多岁","10대"],
    "20代":["20s","20多岁","20대"],
    "30代":["30s","30多岁","30대"],
    "40代":["40s","40多岁","40대"],
    "50代":["50s","50多岁","50대"],
    "60代以上":["60 or older","60岁以上","60대 이상"],
    "できるだけ早く":["As soon as possible","尽快","가능한 빨리"],
    "半年以内":["Within 6 months","半年以内","6개월 이내"],
    "1年以内":["Within 1 year","一年以内","1년 이내"],
    "時期未定":["Timing not set","时间未定","시기 미정"],
    "平屋":["Single-story","平屋","단층"],
    "二世帯住宅":["Two-household home","两代同堂","2세대 주택"],
    "1人":["1 person","1人","1명"],
    "2人":["2 people","2人","2명"],
    "3人":["3 people","3人","3명"],
    "4人":["4 people","4人","4명"],
    "5人以上":["5 or more","5人以上","5명 이상"],
    "希望日を自分で書く":["Type the date","自己填写日期","날짜를 직접 쓰기"],
    "見学日時を自分で書く":["Type the date and time","自己填写日期时间","일시를 직접 쓰기"],
    "10〜12時":["10:00–12:00","10点到12点","10–12시"],
    "13〜15時":["13:00–15:00","13点到15点","13–15시"],
    "15〜17時":["15:00–17:00","15点到17点","15–17시"],
    "17〜19時":["17:00–19:00","17点到19点","17–19시"],
    "時間は相談":["We'll set the time","时间再商量","시간은 상담"],
    "見学希望時間:10:00〜12:00":["10:00–12:00","10点到12点","10–12시"],
    "見学希望時間:13:00〜15:00":["13:00–15:00","13点到15点","13–15시"],
    "見学希望時間:15:00〜17:00":["15:00–17:00","15点到17点","15–17시"],
    "見学希望時間:17:00〜19:00":["17:00–19:00","17点到19点","17–19시"],
    "見学希望時間:相談して決める":["We'll set the time","时间再商量","시간은 상담"],
    "（連絡先を送信しました）":["(Contact details sent)","（已发送联系方式）","(연락처를 보냈어)"],
    "まだ決めてない":["Not sure yet","还没决定","아직 모르겠어"],
    "あとで相談":["Decide later","以后再商量","나중에 상담"],
    "一人暮らし向けの賃貸":["A rental for one","一个人住的租赁","혼자 사는 임대"]
  };
  if(exact[label])return exact[label][pack];
  if(ORI_PREF[label])return ORI_PREF[label][pack];
  if(ORI_PLACES[label])return ORI_PLACES[label][pack];
  if(ORI_PLACE_EXTRA[label])return ORI_PLACE_EXTRA[label][pack];
  if(ORI_PLACE_LOOSE[label])return ORI_PLACE_LOOSE[label][pack];
  const weekName={日:["Sun","日","일"],月:["Mon","一","월"],火:["Tue","二","화"],水:["Wed","三","수"],木:["Thu","四","목"],金:["Fri","五","금"],土:["Sat","六","토"]};
  const dayHint={"明日":["Tomorrow","明天","내일"],"あさって":["Day after tomorrow","后天","모레"],"土曜":["Saturday","周六","토요일"],"日曜":["Sunday","周日","일요일"],"次の土曜":["Next Saturday","下周六","다음 토요일"]};
  const visitDay=String(label).match(/^(明日|あさって|土曜|日曜|次の土曜) (\d+)\/(\d+)（([日月火水木金土])）$/);
  if(visitDay){
    const hint=dayHint[visitDay[1]][pack];
    const weekday=weekName[visitDay[4]][pack];
    if(lang==="en")return `${hint} ${visitDay[2]}/${visitDay[3]} (${weekday})`;
    if(lang==="zh")return `${hint} ${visitDay[2]}月${visitDay[3]}日（${weekday}）`;
    return `${hint} ${visitDay[2]}/${visitDay[3]} (${weekday})`;
  }
  const booked=String(label).match(/^見学希望日:(\d{4})-(\d{2})-(\d{2})$/);
  if(booked){
    if(lang==="en")return `Visit date: ${booked[1]}-${booked[2]}-${booked[3]}`;
    if(lang==="zh")return `看房日：${booked[1]}-${booked[2]}-${booked[3]}`;
    return `견학일: ${booked[1]}-${booked[2]}-${booked[3]}`;
  }
  const bookedAt=String(label).match(/^見学希望日時:(.+)$/);
  if(bookedAt){
    if(lang==="en")return `Visit: ${bookedAt[1]}`;
    if(lang==="zh")return `看房：${bookedAt[1]}`;
    return `견학: ${bookedAt[1]}`;
  }
  const propertyPick=String(label).match(/^対象物件:(.+)$/);
  if(propertyPick){
    const title=propertyPick[1]==="未定"?(lang==="en"?"Not sure yet":lang==="zh"?"未定":"미정"):oriApplyPlaces(propertyPick[1], lang);
    if(lang==="en")return `Home: ${title}`;
    if(lang==="zh")return `房源：${title}`;
    return `매물: ${title}`;
  }
  const budget=String(label).match(/^(?:家賃|購入予算)?([\d,]+)万円まで$/);
  if(budget)return oriYenCap(budget[1], lang);
  const keep=String(label).match(/^(ワンルーム|1K|1R)のまま$/);
  if(keep){
    const name=keep[1]==="ワンルーム"?(lang==="en"?"studio":lang==="zh"?"单间":"원룸"):keep[1];
    if(lang==="en")return `Keep ${name}`;
    if(lang==="zh")return `保持${name}`;
    return `${name} 유지`;
  }
  const surfaced=oriApplyPlaces(label, lang);
  return surfaced&&surfaced!==label?surfaced:"";
}
function oriWeekdays(lang){
  if(lang==="en")return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  if(lang==="zh")return ["日","一","二","三","四","五","六"];
  if(lang==="ko")return ["일","월","화","수","목","금","토"];
  return ["日","月","火","水","木","金","土"];
}
function oriPicker(lang){
  const week=oriWeekdays(lang);
  if(lang==="en")return {prev:"Previous month",next:"Next month",day:"Preferred visit date",time:"Time",timeLabel:"Preferred visit time",send:"Send this date",empty:"Pick a date",title:(y,m)=>`${ORI_MONTHS[m-1]||m} ${y}`,summary:(m,d,w,t)=>`Selected ${ORI_MONTHS[m-1]||m} ${d} (${week[w]||""}) ${t}`};
  if(lang==="zh")return {prev:"上个月",next:"下个月",day:"希望看房日",time:"时间",timeLabel:"希望看房时间",send:"发送这个时间",empty:"请选择日期",title:(y,m)=>`${y}年${m}月`,summary:(m,d,w,t)=>`已选 ${m}月${d}日（${week[w]||""}）${t}`};
  if(lang==="ko")return {prev:"이전 달",next:"다음 달",day:"희망 견학일",time:"시간",timeLabel:"희망 견학 시간",send:"이 일시로 보내기",empty:"날짜를 골라 줘",title:(y,m)=>`${y}년 ${m}월`,summary:(m,d,w,t)=>`선택 ${m}월 ${d}일 (${week[w]||""}) ${t}`};
  return {prev:"前の月",next:"次の月",day:"見学希望日",time:"時間",timeLabel:"見学希望時間",send:"この日時で送る",empty:"日付を選んでにゃん",title:(y,m)=>`${y}年${m}月`,summary:(m,d,w,t)=>`選択中 ${m}月${d}日（${week[w]||""}） ${t}`};
}
function oriLangIndex(lang){return lang==="en"?1:lang==="zh"?2:lang==="ko"?3:0}
let oriChunkySeq=0;
const ORI_CHUNKY_SCALE=46/40;
function oriChunkyCoord(n){return n.toFixed(4)}
function oriChunkySquircle(w,h,r,x,y){const radius=Math.min(18,w/2-1,h/2-1,r);let p="";for(let j=0;j<4;j++){for(let i=0;i<31;i++){const q=((j+i/30)*Math.PI)/2,c=Math.cos(q),s=Math.sin(q),px=x+(c>0?w-radius:radius)+Math.sign(c)*Math.pow(Math.abs(c),0.6)*radius,py=y+(s>0?h-radius:radius)+Math.sign(s)*Math.pow(Math.abs(s),0.6)*radius;p+=(j||i?"L":"M")+oriChunkyCoord(px)+" "+oriChunkyCoord(py)}}return p+"Z"}
function oriChunkyMix(color,pct,key){const h=color.replace("#","");const n=parseInt(h.length===3?h.split("").map(c=>c+c).join(""):h,16);const r=(n>>16)&255,g=(n>>8)&255,b=n&255,t=key==="white"?255:0,p=pct/100;const ch=v=>Math.round(v*p+t*(1-p));return "rgb("+ch(r)+", "+ch(g)+", "+ch(b)+")"}
function oriChunkyPalette(){return{face:"#fafafa",edge:"#94a3b8",stroke:"#e2e8f0"}}
function oriChunkyFloor(el){const narrow=window.matchMedia("(max-width: 520px)").matches,mid=window.matchMedia("(max-width: 736px)").matches;if(el.classList.contains("compact"))return 32;if(el.classList.contains("more-results-button"))return 36;if(el.closest(".suggestions"))return narrow?36:mid?34:42;return narrow?40:42}
function oriChunkyPaint(el){const label=el.querySelector(":scope > .chunky__label"),svg=el.querySelector(":scope > .chunky__svg");if(!label||!svg)return;const disabled=el.disabled||el.getAttribute("aria-disabled")==="true",pressed=!disabled&&el.dataset.pressed==="1",colors=oriChunkyPalette(),p=pressed?1:0,block=!!el.closest(".suggestions")||el.classList.contains("send")||el.classList.contains("choice-button")&&!el.classList.contains("compact");if(!block){const extra=el.classList.contains("more-results-button")?32:28;let want=Math.ceil(label.scrollWidth+extra);const parentW=el.parentElement?el.parentElement.clientWidth:0;if(parentW>32)want=Math.min(want,parentW);const nextW=want+"px";if(el.style.minWidth!==nextW)el.style.minWidth=nextW}const floor=oriChunkyFloor(el),need=Math.ceil(label.scrollHeight*1.5+4),nextH=need>floor+1?Math.ceil(Math.max(floor,need))+"px":"";if(el.style.minHeight!==nextH)el.style.minHeight=nextH;const cw=el.offsetWidth||0;if(cw<8)return;const faceY=4+p*5,baseY=12,w=Math.max(48,Math.round(cw/ORI_CHUNKY_SCALE-10)),z=Math.min(0.5,20/w),uid=el.dataset.chunkyId,sig=cw+"x"+(el.offsetHeight||0)+":"+p+":"+colors.face+":"+w;if(el.dataset.chunkySig===sig&&svg.querySelector("path"))return;el.dataset.chunkySig=sig;const sh=oriChunkyMix(colors.edge,35,"black"),dy=4-p*2,std=3-p*1.5;let slices="";for(let k=0;k<Math.max(0,baseY-faceY);k++)slices+='<path d="'+oriChunkySquircle(w,40,18,5,faceY+1+k)+'" fill="url(#gf'+uid+')"/>';svg.setAttribute("viewBox","0 0 "+(w+10)+" 60");svg.innerHTML="<defs><filter id=\"bf"+uid+"\" x=\"-100%\" y=\"-100%\" width=\"300%\" height=\"300%\"><feDropShadow dy=\""+dy+"\" stdDeviation=\""+std+"\" flood-color=\""+sh+"\" flood-opacity=\"0.3\"/></filter><linearGradient id=\"gf"+uid+"\"><stop offset=\"0\" stop-color=\""+oriChunkyMix(colors.edge,65,"white")+"\"/><stop offset=\""+z+"\" stop-color=\""+oriChunkyMix(colors.edge,90,"white")+"\"/><stop offset=\""+(1-z)+"\" stop-color=\""+oriChunkyMix(colors.edge,90,"white")+"\"/><stop offset=\"1\" stop-color=\""+oriChunkyMix(colors.edge,65,"white")+"\"/></linearGradient></defs><path d=\""+oriChunkySquircle(w,40,18,5,baseY)+"\" fill=\""+oriChunkyMix(colors.edge,60,"black")+"\" filter=\"url(#bf"+uid+")\"/><path d=\""+oriChunkySquircle(w,40,18,5,baseY)+"\" fill=\""+oriChunkyMix(colors.edge,80,"black")+"\" stroke=\""+oriChunkyMix(colors.edge,50,"black")+"\" stroke-width=\"1\"/>"+slices+"<path d=\""+oriChunkySquircle(w,40,18,5,faceY)+"\" fill=\""+colors.face+"\" stroke=\""+colors.stroke+"\" stroke-width=\"1.5\"/>";label.style.top=(((faceY+20)/60)*100)+"%"}
function oriChunkyMount(el){if(!el||el.dataset.chunkyReady==="1")return;el.dataset.chunkyReady="1";el.dataset.chunkyId=String(++oriChunkySeq);el.classList.add("chunky");const label=document.createElement("span");label.className="chunky__label";while(el.firstChild)label.appendChild(el.firstChild);const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("class","chunky__svg");svg.setAttribute("aria-hidden","true");svg.setAttribute("preserveAspectRatio","none");el.append(svg,label);const down=ev=>{if(el.disabled||el.getAttribute("aria-disabled")==="true")return;if(ev.button!=null&&ev.button!==0)return;el.dataset.pressed="1";oriChunkyPaint(el)};const up=()=>{if(el.dataset.pressed!=="1")return;el.dataset.pressed="0";oriChunkyPaint(el)};el.addEventListener("pointerdown",down);el.addEventListener("pointerup",up);el.addEventListener("pointercancel",up);el.addEventListener("pointerleave",up);el.addEventListener("blur",up);el.addEventListener("keydown",ev=>{if(ev.key===" "||ev.key==="Enter")down(ev)});el.addEventListener("keyup",up);if(window.ResizeObserver){const ro=new ResizeObserver(()=>oriChunkyPaint(el));ro.observe(el)}oriChunkyPaint(el);requestAnimationFrame(()=>oriChunkyPaint(el))}
function oriChunkyBoot(root){root.querySelectorAll(".suggestions button, .choice-button, .more-results-button, .send").forEach(oriChunkyMount)}
class Y extends HTMLElement{root;profileSnapshots=[];navigationRoot=true;messages=[];conversationId="";sessionToken="";catState="idle";sending=!1;initialized=!1;campaignStartedAt=0;campaignClockTimer=0;campaignCallOffered=!1;campaignCallPending=!1;campaignFlow=!0;lang="ja";visitorGender="";visitorAgeDecade="";turnstileWidgetId="";turnstilePromise=null;sessionStart=null;turnstileMount=null;dockFrame=0;dockResizeObserver;dockMutationObserver;onDockChange=()=>this.scheduleDockOffset();static get observedAttributes(){return["open","offset-bottom","avoid-selector"]}constructor(){super(),this.root=this.attachShadow({mode:"open"}),this.root.append(F.content.cloneNode(!0));const e=this.root.querySelector("style");e&&(e.textContent=ae)}connectedCallback(){this.applyConfiguration(),this.startDockWatch(),this.recordPropertyPageView(),this.initialized||(this.initialized=!0,this.clearStoredSession(),this.bindEvents(),this.messages=[{id:crypto.randomUUID(),role:"assistant",content:oe()},{id:crypto.randomUUID(),role:"assistant",content:((n=>{const y=n.getUTCFullYear(),m=n.getUTCMonth()+1,d=new Date(Date.UTC(y,m,0)).getUTCDate();return `**${y}年${m}月${d}日まで**キャンペーン開催中だにゃん。\n今から**10分以内**なら、**＋500円クオカード**がつくにゃん。\n\nまずは相談内容を1つ選んでにゃん。`})(new Date(Date.now()+324e5))),choices:[{label:"購入",value:"分譲の特典を見る"},{label:"賃貸",value:"賃貸の特典を見る"},{label:"注文住宅",value:"注文住宅の特典を見る"},{label:"物件を探す",value:"物件を探す",size:"compact"}]}],this.loadLanguage(),this.applyChrome(),this.renderMessages(),this.syncComposerLock(),oriChunkyBoot(this.root)),this.hasAttribute("open")&&this.open()}disconnectedCallback(){this.stopDockWatch()}attributeChangedCallback(e){if(this.isConnected){if(e==="open"){this.hasAttribute("open")?this.open():this.close();return}(e==="offset-bottom"||e==="avoid-selector")&&this.scheduleDockOffset()}}get apiUrl(){return(this.getAttribute("api-url")||"").replace(/\/$/,"")}get demoMode(){return this.getAttribute("demo-mode")==="true"||!this.apiUrl}get lineUrl(){return this.getAttribute("line-url")||"https://page.line.me/089wmudt"}get lineBrandIconUrl(){return this.apiUrl?`${this.apiUrl}/assets/LINE_Brand_icon.png`:"/assets/LINE_Brand_icon.png"}async recordPropertyPageView(){if(this.demoMode)return;const e=new URL(location.href),t=e.hostname.toLowerCase().replace(/^www\./u,"");if(e.protocol!=="https:"||t!=="orijyu.com"||!/^\/(?:[^/]+\/)?post-\d+(?:-\d+)?\.html$/u.test(e.pathname))return;e.search="",e.hash="";const r=`orient-chat.property-view.v1:${new Date(Date.now()+540*60*1e3).toISOString().slice(0,10)}:${e.pathname}`;try{if(window.localStorage.getItem(r))return;(await this.fetchWithTimeout(`${this.apiUrl}/api/property-view`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sourcePage:e.toString()}),keepalive:!0},5e3)).ok&&window.localStorage.setItem(r,"1")}catch{}}get sessionStorageKey(){try{return`orient-chat.session.v1:${new URL(this.apiUrl).origin}`}catch{return""}}clearStoredSession(){const e=this.sessionStorageKey;if(this.conversationId="",this.sessionToken="",!!e)try{window.sessionStorage.removeItem(e)}catch{}}applyConfiguration(){const e={"--orient-primary":this.getAttribute("primary-color"),"--orient-ink":this.getAttribute("ink-color"),"--orient-asset":this.getAttribute("character-src")?`url("${this.getAttribute("character-src")}")`:null};for(const[i,n]of Object.entries(e))n&&this.style.setProperty(i,n);const t=this.root.querySelector(".call-link"),r=this.root.querySelector(".privacy-link");t&&(t.href="tel:0120338101"),r&&(r.href=this.getAttribute("privacy-policy-url")||`${this.apiUrl}/documents/orient-ai-chat-privacy-policy.pdf?v=20261114`),this.applyDockOffset(),this.applyChrome()}startDockWatch(){this.applyDockOffset(),typeof ResizeObserver=="function"&&(this.dockResizeObserver=new ResizeObserver(()=>this.scheduleDockOffset()),this.dockResizeObserver.observe(document.documentElement)),typeof MutationObserver=="function"&&document.body&&(this.dockMutationObserver=new MutationObserver(()=>this.scheduleDockOffset()),this.dockMutationObserver.observe(document.body,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["style","class","hidden"]})),window.addEventListener("resize",this.onDockChange),window.visualViewport?.addEventListener("resize",this.onDockChange)}stopDockWatch(){this.dockFrame&&cancelAnimationFrame(this.dockFrame),this.dockFrame=0,this.dockResizeObserver?.disconnect(),this.dockMutationObserver?.disconnect(),this.dockResizeObserver=void 0,this.dockMutationObserver=void 0,window.removeEventListener("resize",this.onDockChange),window.visualViewport?.removeEventListener("resize",this.onDockChange)}scheduleDockOffset(){this.dockFrame||(this.dockFrame=requestAnimationFrame(()=>{this.dockFrame=0,this.applyDockOffset()}))}applyDockOffset(){const t=_(this.getAttribute("offset-bottom"))??W(this.measureAvoidedBars());this.style.setProperty("--orient-offset-bottom",`${t}px`)}measureAvoidedBars(){const e=this.getAttribute("avoid-selector")?.trim()||j;try{return K(document.querySelectorAll(e),window.innerHeight,t=>getComputedStyle(t))}catch{return 0}}bindEvents(){this.root.querySelector(".launcher")?.addEventListener("click",()=>this.open()),this.root.querySelector(".minimize")?.addEventListener("click",()=>this.close()),this.root.querySelector(".lang-button")?.addEventListener("click",()=>this.toggleLanguageMenu()),this.root.querySelectorAll("[data-lang]").forEach(o=>{o.addEventListener("click",()=>this.setLanguage(o.dataset.lang||"ja"))}),this.root.querySelectorAll("[data-question]").forEach(o=>{o.addEventListener("click",()=>this.sendMessage(o.dataset.question||""))});const e=this.root.querySelector(".composer"),t=this.root.querySelector("textarea");e?.addEventListener("submit",o=>{if(o.preventDefault(),!this.profileReady)return;const r=t?.value.trim()||"";r&&this.sendMessage(r)}),t?.addEventListener("focus",()=>this.setCatState("listening")),t?.addEventListener("blur",()=>{this.sending||this.setCatState("idle")}),t?.addEventListener("input",()=>{t.style.height="auto",t.style.height=`${Math.min(t.scrollHeight,92)}px`}),t?.addEventListener("keydown",o=>{o.isComposing||o.keyCode===229||o.key==="Enter"&&!o.shiftKey&&(o.preventDefault(),e?.requestSubmit())})}open(){const e=this.root.querySelector(".panel"),t=this.root.querySelector(".launcher");e&&(e.hidden=!1),t?.setAttribute("aria-expanded","true"),this.hasAttribute("open")||this.setAttribute("open",""),this.startCampaignClock(),this.ensureSession().catch(()=>{}),window.setTimeout(()=>{this.root.querySelector("textarea")?.focus()},180)}close(){const e=this.root.querySelector(".panel"),t=this.root.querySelector(".launcher");e&&(e.hidden=!0),t?.setAttribute("aria-expanded","false"),this.hasAttribute("open")&&this.removeAttribute("open"),this.setCatState("idle")}setCatState(e){this.catState=e,this.root.querySelectorAll("[data-cat-state]").forEach(t=>{t.dataset.catState=e})}get profileReady(){return true}syncComposerLock(){const t=this.root.querySelector(".suggestions"),o=this.root.querySelector(".composer"),r=this.root.querySelector("textarea"),i=this.root.querySelector(".send"),n=this.campaignFlow!==false;t&&(t.hidden=n,t.classList.toggle("locked",n),t.querySelectorAll("button").forEach(c=>{c.disabled=n||this.sending,n?c.title=this.ui("guide"):c.removeAttribute("title")})),o?.classList.remove("locked"),r&&(r.disabled=this.sending,r.placeholder=this.ui("placeholder")),i&&!this.sending&&(i.disabled=!1)}playSearchReadyAnimation(e){const t=e.querySelector('button[data-question="物件を探す"]');t&&(t.classList.remove("ready-pop"),window.requestAnimationFrame(()=>{t.classList.add("ready-pop");const o=matchMedia("(prefers-reduced-motion: reduce)").matches;t.animate(o?[{backgroundColor:"#ffffff"},{backgroundColor:"#fff6f0"},{backgroundColor:"#ffffff"}]:[{transform:"scale(1)",backgroundColor:"#ffffff",boxShadow:"0 0 0 0 rgba(255,104,11,0)"},{transform:"scale(1.03)",backgroundColor:"#fff7f2",boxShadow:"0 0 0 3px rgba(255,104,11,.16)"},{transform:"scale(1)",backgroundColor:"#ffffff",boxShadow:"0 0 0 0 rgba(255,104,11,0)"}],{duration:720,iterations:2,easing:"ease-in-out"}).addEventListener("finish",()=>t.classList.remove("ready-pop"))}))}selectVisitorProfile(e){if(!(this.profileReady||this.sending)){if(!this.visitorGender){if(!J(e))return;this.saveProfileStep();this.visitorGender=e,this.messages=this.messages.map(t=>({...t,choices:[]})),this.messages.push({id:crypto.randomUUID(),role:"user",content:R[e]}),this.messages.push({id:crypto.randomUUID(),role:"assistant",content:"ありがとう！つづいて年代を教えてにゃん。",choices:H}),this.renderMessages();return}Q(e)&&(this.saveProfileStep(),this.visitorAgeDecade=e,this.messages=this.messages.map(t=>({...t,choices:[]})),this.messages.push({id:crypto.randomUUID(),role:"user",content:q[e]}),this.messages.push({id:crypto.randomUUID(),role:"assistant",content:`ありがとうにゃん！
住まいやお部屋探しのこと、気軽に聞いてにゃん。`}),this.renderMessages(),this.syncComposerLock())}}saveProfileStep() {
  this.profileSnapshots.push({gender:this.visitorGender, age:this.visitorAgeDecade, messages:structuredClone(this.messages)});
}
decorateProfileNavigation() {
  if (this.campaignFlow!==false) return;
  if (!this.navigationRoot || this.sending) return;
  const message=this.messages.at(-1);
  if (!message || message.role!=='assistant' || message.pending) return;
  message.choices=[...(message.choices || []).filter(item=>item.label!=='戻る'),{label:'戻る',value:'__profile_back',size:'compact',disabled:this.profileSnapshots.length===0}];
}
goBackProfile() {
  if(this.sending)return;
  const previous=this.profileSnapshots.pop();
  if(!previous)return;
  this.clearStoredSession();
  this.disposeTurnstileWidget();
  this.visitorGender=previous.gender;
  this.visitorAgeDecade=previous.age;
  this.messages=previous.messages;
  this.navigationRoot=true;
  this.renderMessages();
  this.setDisabled(false);
}

async ensureSession(){if(this.demoMode||this.conversationId)return;if(this.sessionStart)return this.sessionStart;this.sessionStart=this.createSession().finally(()=>{this.sessionStart=null});return this.sessionStart}async createSession(){let e;try{e=await this.getTurnstileToken()}catch(n){throw this.disposeTurnstileWidget(),n}let t;try{t=await this.fetchWithTimeout(`${this.apiUrl}/api/chat/session`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sourcePage:location.href,turnstileToken:e,campaignStartedAt:this.campaignStartedAt||Date.now()})},15e3)}catch(r){throw this.disposeTurnstileWidget(),r}if(!t.ok)throw this.disposeTurnstileWidget(),new Error("セッションを開始できませんでした。もう一度お試しください。");const o=await this.readJsonResponse(t);if(!o.conversationId||!o.sessionToken)throw this.disposeTurnstileWidget(),new Error("セッション情報を確認できませんでした。もう一度お試しください。");this.conversationId=o.conversationId,this.sessionToken=o.sessionToken,typeof o.campaignStartedAt==="number"&&o.campaignStartedAt>0&&(this.campaignStartedAt=o.campaignStartedAt),this.startCampaignClock(),this.disposeTurnstileWidget()}clearTurnstileWidget(){const e=this.turnstileWidgetId;this.turnstileWidgetId="";if(e&&window.turnstile)try{window.turnstile.remove(e)}catch{}this.turnstileMount?.remove(),this.turnstileMount=null;const t=this.root.querySelector(".turnstile-slot");t&&(t.classList.remove("is-active","is-visible"),t.setAttribute("aria-hidden","true"))}disposeTurnstileWidget(){this.clearTurnstileWidget(),this.turnstilePromise=null}showTurnstileOverlay(){const e=this.root.querySelector(".turnstile-slot");if(!e)return;e.classList.add("is-active","is-visible"),e.removeAttribute("aria-hidden")}reportShownError(e){const t=String(e||"").trim();if(!t||this.demoMode)return;const o=/^[0-9a-f-]{36}$/i.test(this.conversationId)?this.conversationId:void 0;fetch(`${this.apiUrl}/api/chat/client-error`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:t.slice(0,500),sourcePage:location.href,conversationId:o}),keepalive:!0}).catch(()=>{})}mountTurnstileHost(){const e=this.root.querySelector(".turnstile-slot");if(!e)return null;e.classList.add("is-active");if(this.turnstileMount?.isConnected)return this.turnstileMount;const t=document.createElement("div");return t.slot="turnstile",t.style.cssText="display:block;width:300px;max-width:100%;min-height:65px;",this.append(t),this.turnstileMount=t,t}requestTurnstileToken(e,t){return new Promise((o,r)=>{const i=Date.now();let n=!1;const c=()=>{if(n)return;n=!0,window.clearTimeout(s),this.clearTurnstileWidget()},a=l=>{c(),r(new Error(l))},u=l=>{if(!l){a("セキュリティ確認に失敗しました。もう一度試してにゃん。");return}if(n)return;n=!0,window.clearTimeout(s),this.clearTurnstileWidget(),o(l)},s=window.setTimeout(()=>a("セキュリティ確認に時間がかかっています。もう一度試してにゃん。"),t),d=()=>{if(n)return;const l=window.turnstile;if(!l){if(Date.now()-i>6e3){a("セキュリティ確認を開始できませんでした。もう一度試してにゃん。");return}window.setTimeout(d,100);return}const x=this.mountTurnstileHost();if(!x){a("セキュリティ確認を開始できませんでした。もう一度試してにゃん。");return}window.setTimeout(()=>{if(n)return;window.requestAnimationFrame(()=>{if(n)return;const p=()=>a("セキュリティ確認に失敗しました。もう一度試してにゃん。"),g=t>1e4;g&&this.showTurnstileOverlay();try{this.turnstileWidgetId=l.render(x,{sitekey:e,action:"chat_session",execution:"execute",appearance:g?"always":"interaction-only",callback:u,"error-callback":p,"expired-callback":p,"timeout-callback":p,"before-interactive-callback":()=>this.showTurnstileOverlay()}),l.execute(this.turnstileWidgetId)}catch{a("セキュリティ確認を開始できませんでした。もう一度試してにゃん。")}})},260)};d()})}async getTurnstileToken(){if(this.demoMode)return"";const e=this.getAttribute("turnstile-site-key");if(!e)return"";if(this.turnstilePromise)return this.turnstilePromise;const t=(async()=>{try{return await this.requestTurnstileToken(e,8e3)}catch(o){this.clearTurnstileWidget();try{return await this.requestTurnstileToken(e,18e3)}catch{throw o}}})();return this.turnstilePromise=t,t.finally(()=>{this.turnstilePromise===t&&(this.turnstilePromise=null)}).catch(()=>{}),t}async sendMessage(e){if(this.sending||!this.profileReady)return;if(e==="今すぐ電話する"||e==="tel:0120338101"){this.connectCampaignCall();return}if(e==="物件を探す"||e==="特典はいらない")this.campaignFlow=false;if(e==="分譲の特典を見る"||e==="賃貸の特典を見る"||e==="注文住宅の特典を見る"||e==="特典に申し込む")this.campaignFlow=true;if(/^(?:戻る|一つ前の回答に戻る|一つ前の条件に戻る)$/.test(e)&&this.navigationRoot){this.goBackProfile();return}this.sending=!0,this.messages.forEach(s=>{s.choices=[],s.moreResults=!1,s.picker=void 0}),this.root.querySelectorAll(".message-choices, .more-results, .message-picker").forEach(s=>s.remove());const t=this.messages.at(-1),o=this.messages.at(-2),r=!!(t?.failed&&o?.role==="user"&&o.content===e),i=r&&o?o.id:crypto.randomUUID();r?this.messages.pop():this.messages.push({id:i,role:"user",content:e});const n=crypto.randomUUID();this.messages.push({id:n,role:"assistant",content:"",pending:!0});const c=this.root.querySelector("textarea");c&&(c.value="",c.style.height="auto"),this.setCatState("thinking"),this.renderMessages(),this.setDisabled(!0);try{await this.ensureSession();const s=this.demoMode?await this.demoResponse(e):await this.remoteResponse(e,i);this.navigationRoot=s.navigationRoot===true;if(s.redactUserMessage){const h=this.messages.find(g=>g.id===i);h&&(h.content="（連絡先を送信しました）")}const a=this.messages.find(h=>h.id===n),l=s.choices,u=s.picker,x=typeof s.hasMoreResults=="boolean"?this.shouldAttachMoreResults(s.hasMoreResults,l):this.demoMode&&this.shouldAttachMoreResults(this.shouldShowMoreResults(s.answer),l);a&&(a.pending=!1,a.content=this.displayAnswer(s.answer).slice(0,1),a.sources=s.sources,a.choices=[],a.choiceLabel=typeof s.choiceLabel==="string"?s.choiceLabel:void 0,a.moreResults=!1,a.picker=void 0,a.lineLink=s.followUp?!1:this.shouldShowLineLink(e,s.answer,s.choices,s.policy)),this.setDisabled(!0),this.setCatState("speaking");const p=this.isListingAnswer(s.answer)||s.pinAnswer===!0;this.renderMessages({stickToBottom:!p});await this.typeAnswer(n,s.answer,{pinToStart:p}),a&&(a.choices=l,a.moreResults=x,a.picker=u);const m=Array.from(this.root.querySelectorAll(".message")).find(h=>h.dataset.messageId===n);if(m&&(this.renderChoices(m,l,{reveal:!p,label:s.choiceLabel}),this.renderPicker(m,u),this.renderMoreResults(m,x,{reveal:!p}),this.setDisabled(!0)),s.followUp?.answer){const h=crypto.randomUUID();this.messages.push({id:h,role:"assistant",content:"",pending:!0,choices:[],moreResults:!1,followUp:!0}),this.renderMessages({stickToBottom:!p}),p&&this.revealMessageStart(Array.from(this.root.querySelectorAll(".message")).find(m=>m.dataset.messageId===n),this.root.querySelector(".messages")),this.setDisabled(!0);const g=this.messages.find(S=>S.id===h);g&&(g.pending=!1,g.content=this.displayAnswer(s.followUp.answer).slice(0,1)),await this.typeAnswer(h,s.followUp.answer,{preserveListing:p}),g&&(g.choices=s.followUp.choices||[]);const y=Array.from(this.root.querySelectorAll(".message")).find(S=>S.dataset.messageId===h);y&&(this.renderChoices(y,s.followUp.choices||[],{reveal:!p}),this.setDisabled(!0))}if(p){const h=()=>{const g=this.root.querySelector(".messages"),y=Array.from(this.root.querySelectorAll(".message")).find(S=>S.dataset.messageId===n);g&&y&&this.revealMessageStart(y,g)};h(),requestAnimationFrame(()=>requestAnimationFrame(h)),window.setTimeout(h,220)}}catch(s){const a=this.messages.find(l=>l.id===n);if(a){a.pending=!1,a.failed=!0,a.content=s instanceof Error?P(s.message):"通信に失敗しました。しばらくしてからお試しください。";String(a.content).includes("セキュリティ確認")&&(a.choices=[{label:"もう一度試す",value:e,tone:"primary"}]);this.reportShownError(a.content)}this.renderMessages()}finally{this.sending=!1,this.setDisabled(!1),this.setCatState("idle"),this.campaignCallPending&&(this.campaignCallPending=!1,this.offerCampaignCall()),this.profileReady&&!this.messages.some(m=>m.id===n&&this.isListingAnswer(m.rawContent||m.content))&&c?.focus({preventScroll:true})}}async remoteResponse(e,t){const o=await this.fetchWithTimeout(`${this.apiUrl}/api/chat/message`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({conversationId:this.conversationId,sessionToken:this.sessionToken,clientTurnId:t,message:e,lang:this.lang})},3e4),r=await this.readJsonResponse(o);if(o.status===401)throw this.clearStoredSession(),this.disposeTurnstileWidget(),new Error("チャットの有効期限が切れました。もう一度送信してにゃん。");if(!o.ok)throw new Error(P(r.error));if(typeof r.answer!="string"||r.answer.trim().length===0)throw new Error("回答データを確認できませんでした。もう一度お試しください。");return{navigationRoot:r.navigationRoot===true,answer:r.answer,sources:Array.isArray(r.sources)?r.sources:[],choices:Array.isArray(r.choices)?r.choices:[],choiceLabel:typeof r.choiceLabel=="string"?r.choiceLabel:void 0,pinAnswer:r.pinAnswer===!0,policy:typeof r.policy=="string"?r.policy:"allow",redactUserMessage:r.redactUserMessage===!0,hasMoreResults:typeof r.hasMoreResults=="boolean"?r.hasMoreResults:void 0,action:typeof r.action=="string"?r.action:"none",followUp:r.followUp&&typeof r.followUp.answer=="string"&&r.followUp.answer.trim()?{answer:r.followUp.answer,choices:Array.isArray(r.followUp.choices)?r.followUp.choices:[]}:void 0,picker:te(r.picker)}}async readJsonResponse(e){try{const t=await e.json();return t!=null&&typeof t=="object"&&!Array.isArray(t)?t:{}}catch{return{}}}async fetchWithTimeout(e,t,o){const r=new AbortController,i=window.setTimeout(()=>r.abort(),o);try{return await fetch(e,{...t,signal:r.signal})}catch(n){throw n instanceof DOMException&&n.name==="AbortError"?new Error("通信が混み合っています。少し時間をおいて、もう一度お試しください。"):new Error("通信に失敗しました。ネットワークを確認して、もう一度お試しください。")}finally{window.clearTimeout(i)}}async demoResponse(e){return await new Promise(t=>window.setTimeout(t,1800)),/値引|価格交渉|法的|重要事項/u.test(e)?{answer:"ごめんね、その内容はオリにゃんでは案内できないにゃん。お部屋探しや住まいのことを聞いてにゃん。",sources:[],choices:[],policy:"out_of_scope",redactUserMessage:!1,hasMoreResults:!1,followUp:void 0,picker:void 0}:e.startsWith("見学希望日時:")?{answer:"見学のお申し込みだにゃん。お名前を教えてにゃん。",sources:[],choices:[],policy:"allow",redactUserMessage:!1,hasMoreResults:!1,followUp:void 0,picker:void 0}:e==="見学したい"||/(?:見学|内見)したい/u.test(e)?{answer:"見学の希望日時を、カレンダーから選んでにゃん。",sources:[],choices:[],policy:"allow",redactUserMessage:!1,hasMoreResults:!1,followUp:void 0,picker:{type:"datetime",min:T(1),max:T(60),prefix:"見学希望日時:"}}:e==="一つ前の条件に戻る"||e==="戻る"?{answer:"購入物件の希望間取りを選んでにゃん。",sources:[],choices:[{label:"2LDK",value:"2LDK"},{label:"3LDK",value:"3LDK"},{label:"4LDK",value:"4LDK"},{label:"こだわりなし",value:"間取りはこだわりなし"},{label:"戻る",value:"一つ前の条件に戻る",size:"compact"}],policy:"allow",redactUserMessage:!1,hasMoreResults:!1,followUp:void 0,picker:void 0}:e==="物件を探す"||e==="もっと見たい"||e==="4LDK"||e==="間取りはこだわりなし"?{answer:`条件に合う購入物件が見つかったにゃん。
- OrientCity 矢田：新築一戸建て、販売価格2580万円、4LDK、大阪市東住吉区住道矢田、駅徒歩5分にゃん。
- OrientCity 長居公園：新築一戸建て、販売価格2780万円、4LDK、大阪市東住吉区住道矢田1丁目、駅徒歩10分にゃん。
- 大阪市東住吉区公園南矢田3丁目 1期 2号棟：新築一戸建て、販売価格4199万円、3SLDK、大阪市東住吉区公園南矢田3丁目、駅徒歩13分にゃん。`,sources:[],choices:[{label:"もっと見る",value:"もっと見たい",tone:"primary"},{label:"戻る",value:"一つ前の条件に戻る",size:"compact"},{label:"別条件で探す",value:"物件を探す",size:"compact"}],policy:"allow",redactUserMessage:!1,hasMoreResults:!1,followUp:{answer:"気に入った物件はあったかにゃ？資料請求・電話・見学から選んでにゃん。",choices:[{label:"資料請求",value:"資料請求したい"},{label:"電話",value:"電話で相談したい"},{label:"見学",value:"見学したい"}]},picker:void 0}:{answer:"オリにゃんは、物件探し・住まい・店舗のことを案内できるにゃん。気になるエリアや条件を教えてね。[1]",sources:[{index:1,title:"オリエントホールディングス 公式サイト",url:"https://orijyu.com/"}],choices:[],policy:"allow",redactUserMessage:!1,hasMoreResults:!1,followUp:void 0,picker:void 0}}shouldAttachMoreResults(e,t){return e&&!t.some(o=>o.value==="もっと見たい")}shouldShowLineLink(e,t,o,r){return/(?:out_of_scope|prompt_injection)/u.test(r)||/(?:あなた|君|きみ|オリにゃん).*(?:誰|だれ|何者)|^(?:おはよう|こんにちは|こんばんは|ありがとう)[。！!？?]?$/u.test(e.normalize("NFKC").trim())||o.length>0&&/(?:教えてにゃん|選んでにゃん|どちらを探|のまま探すか)/u.test(t)?!1:/(?:0120-338-101|物件|住まい|賃貸|購入|戸建|マンション|土地|家づくり|住宅|店舗|テナント|内見|見学|空室|申込|売却|査定|担当者|専門家|確認できない|価格交渉|重要事項)/u.test(t)}shouldShowMoreResults(e){return this.displayAnswer(e).split(/\r?\n/u).filter(o=>/^\s*-\s+.+(?:販売価格|物件価格|賃料|家賃).+にゃん。?\s*$/u.test(o)).length>=3&&/条件に合う.*(?:賃貸|購入物件).*(?:見つかった|候補)/u.test(e)}displayAnswer(e){return this.localize(e.replace(/\s*(?:\[\d+\]|【\d+】)/gu,"").replace(/\*\*/g,"").trim())}ui(e){return (ORI_UI[this.lang]||ORI_UI.ja)[e]||ORI_UI.ja[e]||""}loadLanguage(){try{const e=window.localStorage.getItem("orient-chat.lang");ORI_LANGS.includes(e)&&(this.lang=e)}catch{}}setLanguage(e){if(!ORI_LANGS.includes(e))return;this.lang=e;try{window.localStorage.setItem("orient-chat.lang",e)}catch{}this.applyChrome(),this.renderMessages();const t=this.root.querySelector(".lang-menu");t&&(t.hidden=!0);this.root.querySelector(".lang-button")?.setAttribute("aria-expanded","false")}toggleLanguageMenu(){const e=this.root.querySelector(".lang-menu"),t=this.root.querySelector(".lang-button");if(!e||!t)return;e.hidden=!e.hidden,t.setAttribute("aria-expanded",e.hidden?"false":"true"),e.querySelectorAll("[data-lang]").forEach(o=>{o.setAttribute("aria-selected",o.dataset.lang===this.lang?"true":"false")})}applyChrome(){const e=this.ui.bind(this),t=this.root.querySelector("#orient-chat-title");t&&(t.textContent=e("title"));const o=this.root.querySelector(".minimize");o?.setAttribute("aria-label",e("close"));const r=this.root.querySelector(".lang-current");r&&(r.textContent=e("code"));this.root.querySelector(".lang-button")?.setAttribute("aria-label",e("lang"));const i=this.root.querySelector(".campaign-timer-copy");i&&(i.textContent=e("timer"));const n=this.root.querySelector(".campaign-late-kicker");n&&(n.textContent=e("lateKicker"));const c=this.root.querySelector(".campaign-late-copy");c&&(c.textContent=e("lateCopy"));const s=this.root.querySelector(".campaign-call");if(s){const p=s.querySelector("svg");s.textContent="",p&&s.append(p),s.append(document.createTextNode(e("call")))}const a=this.root.querySelector('[data-question="分譲の特典を見る"]');if(a){const host=a.querySelector(":scope > .chunky__label")||a;const p=[...host.children].find(n=>n.tagName==="SPAN");host.replaceChildren(p||"",document.createTextNode(e("perk")));a.classList.contains("chunky")&&oriChunkyPaint(a)}const l=this.root.querySelector('[data-question="物件を探す"]');if(l){const host=l.querySelector(":scope > .chunky__label")||l;const p=[...host.children].find(n=>n.tagName==="SPAN");host.replaceChildren(p||"",document.createTextNode(e("search")));l.classList.contains("chunky")&&oriChunkyPaint(l)}const u=this.root.querySelector(".privacy-link");u&&(u.textContent=e("privacy"));const x=this.root.querySelector(".call-label");x&&(x.textContent=e("callButton"));this.root.querySelector(".call-link")?.setAttribute("aria-label",e("callButton"));const m=this.root.querySelector(".mail-label");m&&(m.textContent=e("mail"));const h=this.root.querySelector(".launcher-label");h&&(h.textContent=e("launcher"));this.root.querySelector(".launcher")?.setAttribute("aria-label",e("launcher"));const g=this.root.querySelector(".composer label");g&&(g.textContent=e("input"));const y=this.root.querySelector("textarea");y&&(y.placeholder=e("placeholder"));this.root.querySelector(".send")?.setAttribute("aria-label",e("send"))}localizeChoice(e,t=e){const o=ORI_CHOICES[t]||ORI_CHOICES[e];if(o)return o[oriLangIndex(this.lang)];return oriTranslateChoice(t||e,this.lang)||(t||e)}localizeMarkup(e){if(!e||this.lang==="ja")return e;e=oriTranslate(e,this.lang);const t=[...ORI_PHRASES].sort((o,r)=>r[0].length-o[0].length);let i=e;for(const o of t)i=i.split(o[0]).join(o[oriLangIndex(this.lang)]);return i}localize(e){if(!e||this.lang==="ja")return e;e=oriTranslate(e,this.lang);const t=[...ORI_PHRASES].map(o=>[o[0].replace(/\*\*/g,""),o[oriLangIndex(this.lang)].replace(/\*\*/g,"")]).filter(o=>o[0]).sort((o,r)=>r[0].length-o[0].length);let i=e;for(const o of t)i=i.split(o[0]).join(o[1]);return i}isListingAnswer(e){return/条件に合う.*(?:賃貸|購入物件).*(?:見つかった|見つからなかった)/u.test(e)}async typeAnswer(e,t,o={}){const r=this.messages.find(p=>p.id===e);if(!r)return;const i=this.displayAnswer(t);r.rawContent=t;const n=Array.from(this.root.querySelectorAll(".message")).find(p=>p.dataset.messageId===e),c=n?.querySelector(".bubble"),s=this.root.querySelector(".messages");if(!c){r.content=i,this.renderMessages();return}const a=i.startsWith(r.content)?r.content:"",l=document.createTextNode(a);c.replaceChildren(l);const u=p=>{const m=!o.pinToStart&&!o.preserveListing&&s?s.scrollHeight-s.scrollTop-s.clientHeight<=32:!1;r.content=p,l.data=p,s&&m&&(s.scrollTop=s.scrollHeight),s&&n&&o.pinToStart&&this.revealMessageStart(n,s)};if(matchMedia("(prefers-reduced-motion: reduce)").matches){u(i),this.renderAnswerWithSources(c,t,r.sources||[]),n&&(this.renderLineLink(n,!!r.lineLink),this.renderChoices(n,r.choices||[],{reveal:!o.pinToStart&&!o.preserveListing}),this.renderPicker(n,r.picker),this.renderMoreResults(n,this.shouldAttachMoreResults(!!r.moreResults,r.choices||[]),{reveal:!o.pinToStart&&!o.preserveListing})),o.pinToStart&&n&&s&&this.revealMessageStart(n,s);return}await new Promise(p=>{const g=performance.now();let y=a.length,S=g;const v=A=>{const U=Math.min(i.length,Math.max(1,Math.floor((A-g)*120/1e3)));U>y&&(A-S>=32||U===i.length)&&(y=U,S=A,u(i.slice(0,y))),y<i.length?window.requestAnimationFrame(v):p()};window.requestAnimationFrame(v)}),this.renderAnswerWithSources(c,t,r.sources||[]),n&&(this.renderLineLink(n,!!r.lineLink),this.renderChoices(n,r.choices||[],{reveal:!o.pinToStart&&!o.preserveListing}),this.renderPicker(n,r.picker),this.renderMoreResults(n,this.shouldAttachMoreResults(!!r.moreResults,r.choices||[]),{reveal:!o.pinToStart&&!o.preserveListing})),o.pinToStart&&n&&s&&this.revealMessageStart(n,s)}renderLineLink(e,t){if(e.querySelector(".message-call")?.remove(),!t)return;const o=e.querySelector(".message-content");if(!o)return;const r=document.createElement("a");r.className="message-call",r.href="tel:0120338101";const i=document.createElementNS("http://www.w3.org/2000/svg","svg");i.setAttribute("viewBox","0 0 24 24"),i.setAttribute("aria-hidden","true"),i.innerHTML='<path d="M8.2 3.8c.4-.4 1-.5 1.5-.2l2.1 1.2c.5.3.7.9.5 1.4L11.4 8c-.2.5 0 1.1.4 1.4 1.1.9 2.3 2.1 3.2 3.2.3.4.9.6 1.4.4l1.8-.9c.5-.2 1.1 0 1.4.5l1.2 2.1c.3.5.2 1.1-.2 1.5l-1.2 1.2c-.5.5-1.2.7-1.9.6-1.9-.3-4.6-1.8-7.1-4.3S5.6 8.4 5.3 6.5c-.1-.7.1-1.4.6-1.9z"/>';const n=document.createElement("span");const ask=this.ui("lineAsk"),num="0120-338-101",at=ask.indexOf(num);if(at>=0){n.append(ask.slice(0,at));const numEl=document.createElement("span");numEl.className="message-call-num",numEl.textContent=num,n.append(numEl,ask.slice(at+num.length))}else n.textContent=ask;r.append(i,n),o.append(r)}renderChoices(e,t,o={}){e.querySelector(".message-choices")?.remove();const r=t.filter(a=>a.size!=="compact"),i=t.filter(a=>a.size==="compact");if(r.length===0&&i.length===0)return;const n=e.querySelector(".message-content");if(!n)return;const c=document.createElement("div");if(c.className="message-choices",c.setAttribute("role","group"),c.setAttribute("aria-label",this.ui("choices")),r.length>0){const a=document.createElement("p");a.className="choice-label",a.textContent=o.label?this.localize(o.label):this.ui("tap");const l=document.createElement("div");l.className="choice-grid",l.dataset.count=String(r.length),l.setAttribute("role","group"),l.setAttribute("aria-label",this.ui("choiceItems")),r.forEach(u=>l.append(this.createChoiceButton(u))),c.append(a,l)}if(i.length>0){const a=document.createElement("div");a.className="choice-compact",a.setAttribute("role","group"),a.setAttribute("aria-label",this.ui("otherActions")),i.forEach(l=>a.append(this.createChoiceButton(l,!0))),c.append(a)}n.append(c);const s=this.root.querySelector(".messages");s&&o.reveal!==!1&&this.revealMessageChoices(e,s)}createChoiceButton(e,t=!1){const o=document.createElement("button");return o.className=t?"choice-button compact":"choice-button",o.type="button",o.dataset.tone=e.tone||"default",t&&(o.dataset.size="compact"),o.textContent=this.localizeChoice(e.value,e.label),e.disabled&&(o.disabled=true,o.dataset.selectable="false"),o.addEventListener("click",()=>{if((e.value==="__profile_back"||/^(?:戻る|一つ前の回答に戻る|一つ前の条件に戻る)$/.test(e.value))&&this.navigationRoot){this.goBackProfile();return}if(e.value==="今すぐ電話する"){this.connectCampaignCall();return}this.sendMessage(e.value)}),oriChunkyMount(o),o}renderPicker(e,t){if(e.querySelector(".message-picker")?.remove(),!t||t.type!=="datetime")return;const o=e.querySelector(".message-content");if(!o)return;const r=document.createElement("div");r.className="message-picker",r.append(this.createDatetimePicker(t)),o.append(r);const i=this.root.querySelector(".messages");i&&this.revealMessageChoices(e,i)}createDatetimePicker(e){const pk=oriPicker(this.lang);const t=C(e.min)||C(T(1)),o=C(e.max)||C(T(60));let r=t.y,i=t.m,n="";const c=`${t.y}-${String(t.m).padStart(2,"0")}`,s=`${o.y}-${String(o.m).padStart(2,"0")}`,a=document.createElement("div");a.className="oc-picker-datetime";const l=document.createElement("div");l.className="oc-cal-nav";const u=document.createElement("button");u.type="button",u.className="oc-cal-prev",u.setAttribute("aria-label",pk.prev),u.textContent="‹";const x=document.createElement("div");x.className="oc-cal-title";const p=document.createElement("button");p.type="button",p.className="oc-cal-next",p.setAttribute("aria-label",pk.next),p.textContent="›",l.append(u,x,p);const m=document.createElement("div");m.className="oc-cal-weekdays",oriWeekdays(this.lang).forEach(f=>{const M=document.createElement("span");M.textContent=f,m.append(M)});const h=document.createElement("div");h.className="oc-cal-grid",h.setAttribute("role","grid"),h.setAttribute("aria-label",pk.day);const g=document.createElement("p");g.className="oc-cal-summary";const y=document.createElement("label");y.className="oc-cal-time-row";const S=document.createElement("span");S.textContent=pk.time;const v=document.createElement("input");v.type="time",v.className="oc-cal-time",v.step="900",v.value="15:00",v.setAttribute("aria-label",pk.timeLabel),y.append(S,v);const A=document.createElement("button");A.type="button",A.className="oc-cal-submit",A.textContent=pk.send;const U=()=>{const f=C(n),M=v.value||"15:00";if(A.disabled=!f,A.dataset.selectable=f?"true":"false",!f){g.textContent=pk.empty;return}g.textContent=pk.summary(f.m,f.d,I(f.y,f.m,f.d),M)},E=()=>{x.textContent=pk.title(r,i);const f=`${r}-${String(i).padStart(2,"0")}`;u.disabled=f<=c,u.dataset.selectable=u.disabled?"false":"true",p.disabled=f>=s,p.dataset.selectable=p.disabled?"false":"true",h.replaceChildren();const M=I(r,i,1),L=ee(r,i);for(let k=0;k<M;k+=1){const b=document.createElement("button");b.type="button",b.className="oc-cal-day",b.disabled=!0,b.dataset.selectable="false",b.tabIndex=-1,b.setAttribute("aria-hidden","true"),h.append(b)}for(let k=1;k<=L;k+=1){const b=Z(r,i,k),w=document.createElement("button");w.type="button",w.className="oc-cal-day",w.textContent=String(k),w.dataset.date=b;const z=b<e.min||b>e.max;w.disabled=z,w.dataset.selectable=z?"false":"true",b===n?(w.dataset.selected="true",w.setAttribute("aria-pressed","true")):w.setAttribute("aria-pressed","false"),z||w.addEventListener("click",()=>{n=b,E(),U()}),h.append(w)}};return u.addEventListener("click",()=>{const f=O(r,i,-1);r=f.y,i=f.m,E()}),p.addEventListener("click",()=>{const f=O(r,i,1);r=f.y,i=f.m,E()}),v.addEventListener("input",U),A.addEventListener("click",()=>{const f=/^\d{1,2}:\d{2}$/u.test(v.value)?v.value:"15:00",[M,L]=f.split(":"),k=Number(M),b=Number(L);if(!Number.isInteger(k)||!Number.isInteger(b)||k<0||k>23||b<0||b>59||!C(n)||n<e.min||n>e.max)return;const w=`${String(k).padStart(2,"0")}:${String(b).padStart(2,"0")}`;this.sendMessage(`${e.prefix}${n} ${w}`)}),E(),U(),a.append(l,m,h,g,y,A),a}renderMoreResults(e,t,o={}){if(e.querySelector(".more-results")?.remove(),!t)return;const r=e.querySelector(".message-content");if(!r)return;const i=document.createElement("div");i.className="more-results";const n=document.createElement("button");n.className="more-results-button",n.type="button",n.textContent=this.ui("more"),n.addEventListener("click",()=>{this.sendMessage("もっと見たい")}),oriChunkyMount(n),i.append(n),r.append(i);const c=this.root.querySelector(".messages");c&&o.reveal!==!1&&this.revealMessageChoices(e,c)}revealMessageStart(e,t){if(!e.isConnected||!t.isConnected)return;const o=e.getBoundingClientRect().top-t.getBoundingClientRect().top+t.scrollTop;t.scrollTop=Math.max(0,o-8)}revealMessageChoices(e,t){if(!e.isConnected||!t.isConnected)return;const r=8,i=e.querySelector(".message-choices, .message-picker, .more-results")||e,l=i.querySelector?.(".choice-grid");l&&(l.style.maxHeight="",l.style.overflowY="");const o=t.getBoundingClientRect(),c=Math.max(120,o.height-r*2);let n=i.getBoundingClientRect();if(l&&n.height>c){const a=i.querySelector(".choice-label"),s=i.querySelector(".choice-compact"),u=(a?a.getBoundingClientRect().height+6:0)+(s?s.getBoundingClientRect().height+8:0);l.style.maxHeight=`${Math.max(120,c-u)}px`,l.style.overflowY="auto";const d=Number(l.dataset.count||"0");d>0&&d<=6&&(l.scrollTop=l.scrollHeight),n=i.getBoundingClientRect()}const f=t.getBoundingClientRect();n.bottom>f.bottom-r?t.scrollTop+=n.bottom-f.bottom+r:n.top<f.top+r&&(t.scrollTop+=n.top-f.top-r)}shouldShowPropertyDetailLink(e,t){const o=t.url?this.normalizeOfficialUrl(t.url):null;if(!o)return!1;try{const i=new URL(o).pathname.split("/").filter(Boolean),n=t.title.replace(/[\s　・|｜「」『』（）()【】\[\]]+/gu,"").toLowerCase(),c=e.replace(/[\s　・|｜「」『』（）()【】\[\]]+/gu,"").toLowerCase(),s=[n,n.replace(/^(?:賃貸|新築|中古)/u,"")].filter((a,l,u)=>a.length>=3&&u.indexOf(a)===l);return i.length>=2&&ne.has(i[0].toLowerCase())&&(se.test(e)||s.some(a=>c.includes(a)))}catch{return!1}}normalizeOfficialUrl(e){try{const t=new URL(e);return t.protocol!=="https:"||!ie.has(t.hostname.toLowerCase())||t.username||t.password||t.port?null:(t.hash="",t.href)}catch{return null}}createPropertyDetailLink(e,t){const o=document.createElement("a");return o.className="inline-source",o.href=t,o.target="_blank",o.rel="noopener noreferrer",o.title=e.title,o.textContent=this.ui("detail"),o}createOfficialUrlLink(e,t){const o=document.createElement("a");return o.className="answer-url",o.href=e,o.target="_blank",o.rel="noopener noreferrer",o.title=this.ui("page"),o.textContent=t,o}propertyDetailSourcesByUrl(e,t){const o=new Map;for(const r of t){if(!this.shouldShowPropertyDetailLink(e,r)||!r.url)continue;const i=this.normalizeOfficialUrl(r.url);i&&o.set(i,r)}return o}appendEmphasizedText(e,t){if(!t)return;const o=/\*\*([\s\S]+?)\*\*/g;let r=0;for(const i of t.matchAll(o)){const n=i.index??r;this.appendAutoEmphasizedText(e,t.slice(r,n));const c=document.createElement("strong");c.className="answer-em",c.textContent=i[1],e.append(c),r=n+i[0].length}this.appendAutoEmphasizedText(e,t.slice(r))}appendAutoEmphasizedText(e,t){if(!t)return;const o=/50万円のポイント|50万ポイント|(?:\d{2,4}年)?\d{1,2}月\d{1,2}日まで|10分以内|10分限定|[＋+]?\d{1,4}(?:,\d{3})*(?:\.\d+)?万円|[＋+]?\d{1,3}(?:,\d{3})*円(?:クオカード)?|0\d{1,4}-\d{1,4}-\d{3,4}|お名前|お電話番号|番地まで/gu;let r=0;for(const i of t.matchAll(o)){const n=i.index??r;n>r&&e.append(document.createTextNode(t.slice(r,n)));const c=document.createElement("strong");c.className="answer-em",c.textContent=i[0],e.append(c),r=n+i[0].length}r<t.length&&e.append(document.createTextNode(t.slice(r)))}appendAnswerText(e,t,o,r){const i=/https:\/\/[^\s<>"'`、。．，！？「」『』【】（）()]+/giu,n=/[.,!?;:。．，、！？」』】〉》）)\]}]+$/u;let c=0;for(const s of t.matchAll(i)){const a=s.index??c,l=s[0],u=l.match(n)?.[0]||"",x=l.slice(0,l.length-u.length);this.appendEmphasizedText(e,t.slice(c,a));const p=this.normalizeOfficialUrl(x),m=p?o.get(p):void 0;p&&m?r.has(p)||(r.add(p),e.append(this.createPropertyDetailLink(m,p))):p?(r.add(p),e.append(this.createOfficialUrlLink(p,x))):e.append(document.createTextNode(x)),u&&e.append(document.createTextNode(u)),c=a+l.length}this.appendEmphasizedText(e,t.slice(c))}renderAnswerWithSources(e,t,o){t=this.localizeMarkup(t);const r=new Map(o.map(l=>[l.index,l])),i=this.propertyDetailSourcesByUrl(t,o),n=new Set,c=document.createDocumentFragment(),s=/\s*(?:\[(\d+)\]|【(\d+)】)/gu;let a=0;for(const l of t.matchAll(s)){const u=l.index??a;this.appendAnswerText(c,t.slice(a,u),i,n);const x=Number(l[1]||l[2]),p=r.get(x),m=p?.url?this.normalizeOfficialUrl(p.url):null;p&&m&&i.has(m)&&!n.has(m)&&(n.add(m),c.append(this.createPropertyDetailLink(p,m))),a=u+l[0].length}this.appendAnswerText(c,t.slice(a),i,n),e.replaceChildren(c)}setDisabled(e){this.root.querySelectorAll(".suggestions button, .choice-button, .more-results-button, .send, .oc-cal-prev, .oc-cal-next, .oc-cal-day, .oc-cal-submit, .oc-cal-time").forEach(o=>{if(e){o.disabled=!0;return}o.disabled=o.dataset.selectable==="false"});const t=this.root.querySelector("textarea");if(e){t&&this.profileReady&&(t.disabled=!0);return}this.syncComposerLock()}renderMessages(e={}){this.decorateProfileNavigation();const t=this.root.querySelector(".messages");if(!t)return;const o=t.scrollTop;t.replaceChildren(...this.messages.map(r=>this.renderMessage(r))),this.root.querySelectorAll(".thinking-dots").forEach(r=>{this.playThinkingAnimation(r)}),t.scrollTop=e.stickToBottom===!1?o:t.scrollHeight}renderMessage(e){const t=document.createElement("article");if(t.className=`message ${e.role}`,t.dataset.messageId=e.id,e.role==="assistant"){const i=document.createElement("div");i.className="cat",i.dataset.catState=e.pending?"thinking":this.catState,i.setAttribute("aria-hidden","true"),t.append(i)}const o=document.createElement("div");if(o.className="bubble",e.pending){const i=document.createElement("span");i.className="thinking-label",i.setAttribute("role","status"),i.setAttribute("aria-live","polite"),i.setAttribute("aria-atomic","true"),i.setAttribute("aria-label",this.ui("thinking"));const n=document.createElement("span");n.className="thinking-copy",n.setAttribute("aria-hidden","true"),n.textContent=this.ui("thinking");const c=document.createElement("span");c.className="thinking-dots",c.setAttribute("aria-hidden","true");for(let s=0;s<3;s+=1)c.append(document.createElement("span"));i.append(n,c),o.append(i)}else e.role==="assistant"&&e.rawContent?this.renderAnswerWithSources(o,e.rawContent,e.sources||[]):e.role==="assistant"?this.appendEmphasizedText(o,this.localizeMarkup(e.content)):o.append(document.createTextNode(this.localizeChoice(e.content)));const r=document.createElement("div");if(r.className="message-content",r.append(o),t.append(r),e.role==="assistant"&&!e.pending){e.rawContent&&this.renderLineLink(t,!!e.lineLink);const i=this.isListingAnswer(e.rawContent||e.content);e.choices?.length&&this.renderChoices(t,e.choices,{reveal:!i,label:e.choiceLabel}),e.picker&&this.renderPicker(t,e.picker),this.shouldAttachMoreResults(!!e.moreResults,e.choices||[])&&this.renderMoreResults(t,!0,{reveal:!i})}return t}playThinkingAnimation(e){const t=matchMedia("(prefers-reduced-motion: reduce)").matches;e.querySelectorAll("span").forEach((o,r)=>{o.animate(t?[{opacity:.3},{opacity:1},{opacity:.3}]:[{transform:"translateY(0px)",opacity:.35},{transform:"translateY(-2px)",opacity:1},{transform:"translateY(0px)",opacity:.35}],{duration:900,delay:r*160,iterations:1/0,easing:"ease-in-out"})})}startCampaignClock(){const e=this.root.querySelector(".campaign-bar");if(!e)return;e.hidden=!1;if(!this.campaignStartedAt)this.campaignStartedAt=Date.now();if(this.campaignClockTimer)window.clearInterval(this.campaignClockTimer);this.tickCampaignClock();this.campaignClockTimer=window.setInterval(()=>this.tickCampaignClock(),1e3)}tickCampaignClock(){const e=this.root.querySelector(".campaign-bar"),t=this.root.querySelector("[data-campaign-clock]");if(!e||!this.campaignStartedAt)return;const o=Math.max(0,6e5-(Date.now()-this.campaignStartedAt)),r=o<=0;e.dataset.expired=r?"true":"false";if(t){const i=Math.floor(o/6e4),n=Math.floor(o%6e4/1e3);t.textContent=`${String(i).padStart(2,"0")}:${String(n).padStart(2,"0")}`}if(r){this.campaignClockTimer&&(window.clearInterval(this.campaignClockTimer),this.campaignClockTimer=0);this.sending?this.campaignCallPending=!0:this.offerCampaignCall()}}offerCampaignCall(){if(this.campaignCallOffered)return;this.campaignCallOffered=!0;const e=this.messages.at(-1);if(e?.role==="assistant"&&(e.choices||[]).some(t=>t.value==="今すぐ電話する"))return;const t=this.messages.some(o=>o.role==="user"&&["分譲の特典を見る","賃貸の特典を見る","注文住宅の特典を見る"].includes(o.content));this.messages.push({id:crypto.randomUUID(),role:"assistant",content:"**10分限定**の**＋500円クオカード**は終了したにゃん。今月の成約特典は変わらず使えるにゃん。すぐ話したいときはお電話がいちばんだにゃん。\n**0120-338-101**",choices:t?[{label:"特典に申し込む",value:"特典に申し込む",tone:"primary"},{label:"物件を探す",value:"物件を探す"},{label:"今すぐ電話する",value:"今すぐ電話する",size:"compact"}]:[{label:"購入",value:"分譲の特典を見る"},{label:"賃貸",value:"賃貸の特典を見る"},{label:"注文住宅",value:"注文住宅の特典を見る"},{label:"物件を探す",value:"物件を探す",size:"compact"},{label:"今すぐ電話する",value:"今すぐ電話する",size:"compact"}]});this.renderMessages()}connectCampaignCall(){window.location.href="tel:0120338101"}}return customElements.get("orient-chat")||customElements.define("orient-chat",Y),D.OrientChat=Y,Object.defineProperty(D,Symbol.toStringTag,{value:"Module"}),D})({});
