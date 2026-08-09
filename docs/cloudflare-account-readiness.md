# Cloudflare実環境 事前確認（2026-08-09）

## 配置対象

- 配置先アカウント名: `Uken.shohei@gmail.com's Account`
- Account ID: `d2874089eebcda705bf220d39f117aec`
- Zero Trust組織: `amalink-one.cloudflareaccess.com`
- `orijyu.com` Zone: このアカウントには未登録

利用者確認により、このアカウントを配置先として使用する。既存の `amalink-*` リソースには変更を加えない。

## 名前の競合確認

2026-08-09に対象アカウントを再確認し、以下の予定名との競合がないことを確認した。

| 種別 | 予定名 | 状態 |
|---|---|---|
| Worker | `orient-chat-api` | 未作成・競合なし |
| D1 | `orient-chat` | 作成済み（APAC、read replication無効） |
| Queue | `orient-chat-audit` | 作成済み |
| R2 | `orient-chat-audit` | 作成済み（APAC、非公開、Lifecycle設定済み） |
| AI Search namespace | `default` | 作成済み（public endpoint無効） |
| AI Search instance | `orient-knowledge` | 未作成・競合なし |
| Turnstile widget | `orient-chat` | 未作成・競合なし |
| Access application | `orient-chat-admin` | 未作成・競合なし |

既存リソースには変更を加えず、対象アカウントで競合しない新規名だけを使用する。

## デプロイ前に必要な操作

1. `Uken.shohei@gmail.com's Account` を選択する。
2. Cloudflare DashboardでR2を有効化し、表示される利用条件・料金条件を利用者が確認する。（完了）
3. 管理画面へログインを許可する管理者メールアドレスを確定する。
4. Turnstile、D1、Queue、R2、AI Search、Access Application、Workerを新規作成する。
5. Worker secretsを投入し、D1 migration後にデプロイする。
6. WordPress埋め込みコードへ実Worker URL、Turnstile site key、LINE URLを反映する。

## 現時点の判断

- `orijyu.com`をCloudflare DNSへ移管しなくても、Workers.dev URLをAPI・静的配信元としてWordPressから利用できる。
- 管理画面のAccess認証には、対象アカウント側のZero Trust組織を使用する。
- R2の監査JSONLは400日、月次レポートは1,095日で自動削除する。Public Development URLは無効にする。
- この確認ではCloudflare側の作成・更新・削除は行っていない。
