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
