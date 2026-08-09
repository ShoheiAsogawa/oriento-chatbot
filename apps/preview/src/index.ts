const productionAssetOrigin = 'https://orient-chat-api.uken-shohei.workers.dev';

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>オリにゃん チャット画面プレビュー</title>
  <style>
    :root { color-scheme: light; font-family: "Noto Sans JP", "Yu Gothic", sans-serif; color: #29293a; background: #f7f4ef; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: linear-gradient(145deg, #fff 0 45%, #fff4e9 100%); }
    header { height: 74px; display: flex; align-items: center; justify-content: space-between; padding: 0 clamp(20px, 5vw, 72px); background: rgba(255,255,255,.92); border-bottom: 1px solid #eee8e1; }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 900; letter-spacing: .04em; }
    .brand-mark { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; color: white; background: #ff680b; }
    .preview-badge { padding: 7px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; color: #9a3d00; background: #fff0e5; border: 1px solid #ffd2b5; }
    main { width: min(1120px, calc(100% - 40px)); margin: 0 auto; padding: clamp(52px, 9vw, 112px) 0 160px; }
    .eyebrow { margin: 0 0 14px; color: #e85400; font-size: 13px; font-weight: 900; letter-spacing: .14em; }
    h1 { max-width: 760px; margin: 0; font-size: clamp(34px, 6vw, 68px); line-height: 1.12; letter-spacing: -.04em; }
    .lead { max-width: 620px; margin: 24px 0 0; color: #666274; font-size: clamp(16px, 2vw, 19px); line-height: 1.9; }
    .hint { display: inline-flex; align-items: center; gap: 9px; margin-top: 30px; padding: 13px 18px; border-radius: 14px; background: #29293a; color: white; font-size: 14px; font-weight: 800; box-shadow: 0 12px 30px rgba(41,41,58,.16); }
    .hint::before { content: "↘"; color: #ff9d5d; font-size: 20px; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 72px; }
    .card { min-height: 128px; padding: 22px; border: 1px solid #eee7df; border-radius: 20px; background: rgba(255,255,255,.78); }
    .card strong { display: block; margin-bottom: 9px; }
    .card span { color: #797482; font-size: 13px; line-height: 1.7; }
    footer { position: fixed; left: 18px; bottom: 14px; color: #8b8590; font-size: 11px; }
    @media (max-width: 720px) {
      header { height: 64px; padding: 0 18px; }
      main { width: min(100% - 32px, 560px); padding-top: 54px; }
      .cards { grid-template-columns: 1fr; margin-top: 48px; padding-bottom: 90px; }
      .card { min-height: auto; }
      footer { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand"><span class="brand-mark">O</span>ORIENT</div>
    <span class="preview-badge">CHAT PREVIEW</span>
  </header>
  <main>
    <p class="eyebrow">AI CONCIERGE DEMO</p>
    <h1>住まい探しに、<br>オリにゃんという相棒を。</h1>
    <p class="lead">実際にWordPressへ設置するチャット画面の確認ページです。右下のキャラクターを押して、会話や動きをお試しください。</p>
    <div class="hint">右下のオリにゃんをタップ</div>
    <section class="cards" aria-label="プレビューの説明">
      <div class="card"><strong>会話アニメーション</strong><span>待機・聞き取り・考え中・回答中の状態に合わせてキャラクターが動きます。</span></div>
      <div class="card"><strong>スマホ対応</strong><span>ホームページ右下に常駐し、画面幅に合わせてチャットモーダルを調整します。</span></div>
      <div class="card"><strong>データ分離</strong><span>このURLは見た目確認専用です。入力内容は本番の顧客DBや監査ログへ保存されません。</span></div>
    </section>
  </main>
  <footer>Orient Chat UI preview — no production data is used.</footer>

  <orient-chat
    open
    demo-mode="true"
    primary-color="#ff680b"
    ink-color="#29293a"
    character-src="${productionAssetOrigin}/assets/orinyan-states.png"
    line-url="https://line.me/"
    contact-url="https://orijyu.com/contact/"
  ></orient-chat>
  <script defer src="${productionAssetOrigin}/widget/orient-chat.js?v=20260809-1"></script>
</body>
</html>`;

export default {
  fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true, environment: 'preview', productionDataConnected: false });
    }
    if (url.pathname !== '/') return new Response('Not found', { status: 404 });
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': `default-src 'self'; script-src 'self' ${productionAssetOrigin}; img-src 'self' ${productionAssetOrigin} data:; style-src 'unsafe-inline'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
      },
    });
  },
};
