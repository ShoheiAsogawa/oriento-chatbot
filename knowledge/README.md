# 初期ナレッジ

`initial/` は、オリエントグループの公式公開サイトから生成するチャット検索用の初期ナレッジです。

対象サイト:

- https://orijyu.com/
- https://orichin.com/
- https://origumi.jp/
- https://oriho.com/

中国語サイト（`cn.orijyu.com`）や中国語版URLは取得しません。物件情報は日本語の公式 `orijyu.com` 詳細ページだけを対象にします。

## 物件情報の更新

```powershell
pnpm knowledge:refresh:properties
```

このコマンドは次を順番に実行します。

1. 現在の公式サイトマップから売買・賃貸の物件詳細ページを再取得
2. 公式URLごとにMarkdownを1ファイル生成
3. 売買・賃貸カタログと絞り込み用データを再生成
4. 件数、URL一意性、公式URL限定、ファイルのSHA-256、PHP警告や中国語URLの混入を検証

物件取得に1件でも失敗した場合は更新を中止し、既存の物件ナレッジを残します。

## 全グループ情報の再取得

```powershell
pnpm knowledge:scrape
pnpm knowledge:catalog
pnpm knowledge:validate
```

生成後は `initial/manifest.json` の件数、失敗URL、ファイルサイズ、SHA-256を確認してください。各MarkdownはCloudflare AI Searchの1ファイル上限を下回るよう分割されます。

管理画面に反映するには、アプリをデプロイした後に初期ナレッジの再同期を実行します。再同期が完了するまで、成約済み物件の削除や手動編集内容を上書きしない運用にしてください。
