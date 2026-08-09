# デザインシステム

公式サイト `orijyu.com` の実測色と添付キャラクターを基準にする。

## カラー

- Brand orange: `#ff680b`
- Brand orange strong: `#fd680a`
- Ink: `#29293a`
- Muted: `#74757f`
- Border: `#e8e9ee`
- Surface: `#ffffff`
- Soft surface: `#f6f6f6`
- Success: `#20b866`
- LINE: `#06c755`

## コンポーネント

- 角丸は 10-18px。過度なカプセル形状を避ける。
- 影はパネルとランチャーだけに使用する。
- UI テキストはコードで描画し、キャラクターだけを画像レイヤーにする。
- ランチャーは右下 20px（モバイル 12px）。パネルは最大幅 420px、高さ 720px。
- キャラクター状態は `idle / listening / speaking / thinking`。`prefers-reduced-motion` では状態差分だけ切り替え、連続アニメーションを止める。

## コンセプト

- `design/chat-widget-concept-final.png`
- `design/admin-concept.png`
- `design/character-reference.png`
- `apps/widget/public/assets/orinyan-states.png`
