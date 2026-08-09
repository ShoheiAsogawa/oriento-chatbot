# Cloudflare 機能マップ（2026-08 時点）

| 機能 | 採用 | 用途 |
|---|---:|---|
| Workers | 採用 | API、認証、ポリシー、RAG オーケストレーション |
| Workers Static Assets | 採用 | 管理画面、WordPress用JS、キャラクター画像を同一Workerで配信 |
| AI Search（旧 AutoRAG） | 採用 | 資料アップロード、解析、ハイブリッド検索、再ランキング、引用 |
| AI Search built-in storage | 採用 | R2/Vectorize を個別構築せずナレッジを一元管理 |
| Workers AI | 採用 | AI Searchの埋め込み・クエリ書換え・再ランキングをCloudflare内で実行 |
| AI Gateway | 採用 | OpenAI BYOK、月15ドル上限、最小権限認証、モデル切替。プロンプト・応答本文ログは無効 |
| D1 | 採用 | 会話、顧客、設定、引用、監査索引 |
| Durable Objects | 採用 | 月次SQLite台帳で監査イベントを直列化し、ハッシュチェーンと再送Outboxを生成 |
| Queues | 採用 | D1監査索引とR2アーカイブへの複製をリクエスト処理から分離 |
| R2 | 採用 | 監査 JSONL、月次レポート、将来の D1 バックアップ |
| Analytics Engine | 採用候補 | PII を含まない利用量・応答時間・拒否率の集計 |
| Workflows | 第2段階 | D1 バックアップ、長時間の再処理、月次レポートの耐障害実行 |
| Workers Rate Limiting | 採用 | セッション/IP単位の濫用防止 |
| Turnstile | 採用 | 公開チャットのbot対策 |
| Cloudflare Access | 採用 | 管理画面のゼロトラスト認証 |
| Workers Secrets | 採用 | Turnstile、署名鍵、暗号鍵、Access設定を暗号化してWorkerへ注入 |
| Secrets Store | 権限確認後 | 複数WorkerやAI Gatewayで鍵を共有する段階でアカウント中央管理へ移行 |
| AI Gateway DLP | 有料条件確認 | プロンプト/応答の個人情報・機密情報検知 |
| AI Gateway Guardrails | 採用候補 | 有害コンテンツの入出力検査。業界限定はアプリ側ポリシーで補完 |
| Logpush | 有料条件確認 | Workers/AI Gateway の運用ログを R2 へ長期保存 |
| Audit Logs | 採用 | Cloudflare 設定変更の監査。会話監査は独自台帳で補完 |
| Data Localization Suite | 要件時 | 地域内処理・メタデータ境界。契約プランと対象サービスを確認 |
| Cache / CDN | 採用 | widget JS/CSS/画像の高速配信。個別会話応答はキャッシュしない |
| WAF / Bot Management | ゾーン移管時 | WordPress と API の追加防御 |

AI Searchの2026年機能として、namespace binding、built-in storage、個別ファイル再インデックス、path filtering、reranking、query rewrite、応答キャッシュ期間設定を確認済み。必要な機能だけを採用し、二重保存になる製品は採用しない。

「すべてCloudflareで完結」は、WordPress本体を除くチャットの静的配信、推論、RAG、API、DB、監査、ファイル、認証、bot対策をCloudflareに置く意味で実現する。
