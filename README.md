# オリエント AI チャットボット

WordPress に1行のスクリプトで埋め込めるキャラクター付きチャットと、Cloudflare 上で完結する管理・監査基盤です。

## 構成

- `apps/widget`: Shadow DOM を使う軽量 Web Component。WordPress のテーマと競合しません。
- `apps/admin`: ナレッジ、会話ログ、顧客、応答方針、外観、監査を扱う React 管理画面。
- `apps/worker`: Cloudflare Workers API と Static Assets。AI Search、D1、Durable Objects、Queues、R2、Rate Limiting、Turnstile、Access に対応。
- `wordpress/orient-orinyan-chat/`: テーマを触らずに入れるWordPressプラグイン。
- `wordpress/orient-orinyan-chat.zip`: 管理画面からアップロードする用。
- `wordpress/ORIENT-CHAT-INSTALL.txt`: 入れ方・戻し方。
- `docs/cloudflare-account-readiness.md`: 実アカウントの競合・前提条件・R2有効化状況。
- `docs/cost-controls.md`: 予算アラート、日次ハード上限、R2保持期限。
- `docs`: 設計、Cloudflare 機能選定、プライバシーと運用手順。

## ローカル確認

```powershell
pnpm install
pnpm dev:widget
pnpm dev:admin
```

Cloudflare リソースを作成するまでは、フロントエンドは内蔵モック応答で確認できます。実環境構築は `docs/deployment.md` の順序で行います。

本番ビルドでは管理画面を `/admin/`、WordPress用スクリプトを `/widget/orient-chat.js`、キャラクター画像を `/assets/orinyan-states.png` として同じWorkerへ同梱します。管理画面のモックデータはローカルホスト時だけ有効で、本番ではAPIエラーを実データとして偽装しません。

## 回答ポリシー

不動産・住まい・物件・家づくり・店舗案内・問い合わせ方法だけを回答対象にします。価格交渉、法的判断、宅地建物取引業法上の重要事項説明、根拠資料にない内容は回答せず、公式 LINE または問い合わせフォームへ案内します。

## 検証

```powershell
pnpm check
pnpm test
pnpm build
```

Workerの型は `wrangler types` で `apps/worker/src/worker-configuration.d.ts` へ生成し、設定とバインディングのずれをCI相当のチェックで検出します。
