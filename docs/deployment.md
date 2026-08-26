# Cloudflare デプロイ手順

## 事前準備

Cloudflareログイン後、Wranglerの認可画面でこのプロジェクトへの操作を許可する。以降はプロジェクト直下で実行する。

```powershell
pnpm install
pnpm --filter @orient/worker exec wrangler login
pnpm --filter @orient/worker exec wrangler whoami
```

## リソース作成

`wrangler.jsonc` はD1、R2、Queue、SQLite Durable Object、AI Search namespace、Static Assetsを宣言済み。Wrangler 4.120では未作成のD1/R2/Queueをデプロイ時に自動プロビジョニングできる。手動作成を選ぶ場合は次を使用し、D1の生成IDをWranglerに設定更新させる。

```powershell
pnpm --filter @orient/worker exec wrangler d1 create orient-chat --binding DB --update-config
pnpm --filter @orient/worker exec wrangler r2 bucket create orient-chat-audit
pnpm --filter @orient/worker exec wrangler queues create orient-chat-audit
pnpm --filter @orient/worker exec wrangler queues create orient-chat-custom-home-leads
```

AI SearchはCloudflareダッシュボードまたはnamespace bindingで `orient-knowledge` を作成する。built-in storage、vector+keyword、RRF、query rewrite、rerankingを有効にする。Workerデプロイ後はAccess認証済みで `POST /api/admin/knowledge/bootstrap` を1回呼ぶことでも同じ初期化ができる。

## チャットからの問い合わせ通知

注文住宅のヒアリング完了時、および購入・賃貸の候補表示後に届く資料請求・電話相談・見学予約は、氏名・電話番号・住所を会話履歴へ残さず暗号化してD1へ保存し、`orient-chat-custom-home-leads` Queueから通知を送る。管理画面の「お問い合わせ」にも同じ内容が残る。Cloudflare Email Sending の宛先は確認済みアドレスだけが使えるため、テスト期間の通知先は `uken.shohei@gmail.com` に固定する。未確認のオリエント社内アドレスへ変えると送信できなくなる。

1. Cloudflare Email Serviceで `orijyu.com` を送信ドメインとしてオンボードし、`no-reply@orijyu.com` を送信元として認証する。
2. テスト通知先のGmailアドレスをCloudflare Email Routingで確認済みの宛先として登録する。
3. `wrangler.jsonc` の `CUSTOM_HOME_LEAD_EMAIL` binding をデプロイする。

送信失敗時はQueueが最大5回再試行する。Queue・監査ログには問い合わせIDだけを入れ、氏名・電話番号・相談内容は入れない。

## シークレット

必要な名前は `wrangler.jsonc` の `secrets.required` に宣言済みで、不足時は本番デプロイが失敗する。

- `SESSION_SIGNING_KEY`: 32バイト以上のランダム値
- `HASH_SALT`: IP・メール検索ハッシュ用のランダム値
- `PII_ENCRYPTION_KEY`: 32バイトをbase64urlエンコードしたAES鍵
- `TURNSTILE_SECRET`: Turnstile secret key
- `ACCESS_TEAM_DOMAIN`: `example.cloudflareaccess.com`
- `ACCESS_AUD`: Access Application Audience tag
- `ADMIN_ALLOWED_EMAILS`: カンマ区切りの管理者メール
- `AI_GATEWAY_TOKEN`: AI Gateway 実行専用の最小権限トークン。OpenAIキー本体はWorkerへ保存せず、AI Gateway BYOKで管理する

初回デプロイは、これらを含むGit管理外の一時 `.env` を `wrangler deploy --secrets-file <path>` に渡す。完了後は一時ファイルを安全に削除する。`DEV_ADMIN_BYPASS` は通常変数として本番 `false` に固定されている。複数Worker間で鍵共有が必要になった段階ではSecrets Storeへ移行する。

## Turnstile・Access

1. `orijyu.com` 用Turnstileウィジェットを作成し、site keyをWordPress側の `turnstile-site-key`、secret keyをWorker secretへ設定する。クライアントは `chat_session` actionで必要時実行し、WorkerはSiteverifyのactionとhostnameを照合する。
2. Access ApplicationをWorkerの `/admin/*` と `/api/admin/*` に作成する。
3. 許可ポリシーは管理者メールまたは指定IdPグループだけに限定する。
4. 2つのApplication Audience tagをカンマ区切りで `ACCESS_AUD`、team domainを `ACCESS_TEAM_DOMAIN` に設定する。
5. `/api/chat/*`、`/widget/*`、`/assets/*` はAccess対象外にする。

## D1・デプロイ

```powershell
pnpm check
pnpm test
pnpm build
pnpm --filter @orient/worker exec wrangler d1 migrations apply orient-chat --remote
pnpm --filter @orient/worker exec wrangler deploy --secrets-file <Git管理外の一時.env>
```

初回はD1を先に明示作成してmigrationを適用する。R2/Queue/SQLite Durable Object/Static Assetsは設定に従い作成される。デプロイ後は一時secretファイルを残さない。

## コスト制御

- `DAILY_SESSION_LIMIT=500`: 日本時間1日あたりの新規会話ハード上限
- `DAILY_AI_REQUEST_LIMIT=500`: 日本時間1日あたりのAI Search・OpenAI推論ハード上限
- Cloudflare Budget Alert: 既存のアカウント全体 $10 通知を維持
- R2 Lifecycle: `audit/` は400日、`reports/` は1,095日で削除
- R2バケットは非公開とし、Public Development URLを有効にしない

Budget Alertは通知のみで利用停止しないため、D1の原子的カウンターによる日次上限をハードガードとして使用する。詳細は `docs/cost-controls.md` を参照する。

## AI Search

`orient-knowledge` を次の方針で設定する。

- built-in storage を使用
- custom metadata: `category`, `language`, `source_url`, `title`, `access_scope`
- retrieval: hybrid
- reranking: `@cf/baai/bge-reranker-base`
- query rewrite: enabled
- generation model: `gpt-5.4-nano`
- AI Gateway: `orient-chat` を使用し、OpenAIキーはBYOKで保存
- AI Gateway payload logging: 外部モデル採用時もdisabled
- AI Gateway metadata logging: enabled
- DLP / Guardrails: 外部モデルと契約プラン確認後に有効化

## WordPress

1. `pnpm build` によりwidget、管理画面、画像をWorker Static Assetsへ同梱する。
2. `wordpress/embed-snippet.html` のWorker URL、Turnstile site key、LINE URLを実値へ置換する。
3. WordPressのフッター用カスタムHTML欄へ貼り付ける。
4. CSPを使用している場合はWorkerドメインへの `script-src`, `connect-src`, `img-src` を許可する。

## 検収

- PC / スマートフォンで開閉、入力、長文、キーボード操作を確認
- 不動産以外、価格交渉、法的判断、重要事項説明が拒否されることを確認
- 根拠不足時に回答しないことを確認
- 参照リンクが正しいことを確認
- 顧客情報が同意前に保存されないことを確認
- Access外から管理APIを呼べないことを確認
- 管理画面の「チェーンを検証」で当月台帳が正常になることを確認
- D1監査索引とR2 JSONLアーカイブの件数を照合
- 顧客CSVと会話CSVを出力し、出力操作が監査イベントに残ることを確認
- AI Gatewayの本文ログが無効であることを確認
