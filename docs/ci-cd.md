# Cloudflare自動デプロイ

このリポジトリの `main` ブランチはCloudflare Workers Buildsに接続します。
GitHubへpushすると、Cloudflare側で依存関係をインストールし、次の2つのWorkerを自動更新します。

| 対象 | Worker | Build command | Deploy command |
| --- | --- | --- | --- |
| 本番API・管理画面・WordPressウィジェット | `orient-chat-api` | `pnpm build` | `pnpm deploy:production` |
| 確認用チャット画面 | `orient-chat-preview` | `pnpm build:preview` | `pnpm deploy:preview` |

両方ともRoot directoryは `/`、Production branchは `main` です。
実行時SecretはWorkerに保存済みの値を使用し、GitHubやビルド変数には保存しません。

## ローカル確認

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm build:preview
```

ビルド履歴はCloudflare Dashboardの各Workerで **Deployments > View build history** から確認できます。

## 更新手順

1. 変更を `main` へcommitしてGitHubへpushします。
2. Workers Buildsが本番と確認用のビルドを開始します。
3. 両方のビルド成功後、各 `workers.dev` URLへ反映されます。

本番以外のブランチではCloudflareビルドを実行しない設定にし、不要なビルド時間を抑えています。
