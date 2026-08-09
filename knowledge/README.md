# 初期ナレッジ

`initial/` は、オリエントグループの公式公開サイトを巡回し、チャット検索用にジャンル分けした初期ナレッジです。

対象サイト:

- https://orijyu.com/
- https://orichin.com/
- https://origumi.jp/
- https://oriho.com/
- https://cn.orijyu.com/

更新方法:

```powershell
pnpm knowledge:scrape
```

生成後は `initial/manifest.json` の件数、失敗URL、ファイルサイズ、SHA-256を確認してください。各MarkdownはCloudflare AI Searchの1ファイル上限を下回るよう自動分割されます。

利用者向けチャット画面では出典カードと出典番号を表示しません。各節のURLは、回答生成時の根拠確認と管理者の監査用途のためにナレッジ内へ保持します。
