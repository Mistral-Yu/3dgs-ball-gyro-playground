# 3DGS Ball Gyro Playground

3D Gaussian Splatting を背景に使い、モバイルの傾き操作またはタッチ操作でボールを転がして遊ぶ静的 Web プロトタイプです。Spark 2.0 と Three.js を土台にしています。

## 現在の状態

- Phase 1〜6 相当のプロトタイプ実装済み
- `npm test` / `npm run build` / `npm run check` 通過済み
- **まだ実機ブラウザ検証は未実施**
- **この repo / Pages 上のページは未検証ページとして扱ってください**
- 実機テストは GitHub へ push 後に行う前提です

## 主な機能

- 3DGS 背景表示
- ボール 1 個の簡易物理
- deviceorientation ベースの傾き入力
- iPhone 系の motion permission 導線
- センサー拒否 / 非対応 / タイムアウト時の touch fallback
- キャリブレーション
- ゴール・障害物・リセット・タイマー
- センサー単体確認用の smoke test ページ

## 含まれる主要ファイル

- `index.html` — 本体ページ
- `viewer.js` / `viewer.bundle.js` — viewer とゲーム統合ロジック
- `viewer.css` — UI / HUD / モバイルレイアウト
- `ball-game.mjs` — 簡易物理とステージ進行
- `motion-controls.mjs` — センサー正規化・平滑化・キャリブレーション
- `touch-controls.mjs` — タッチ fallback 入力
- `game-ui-state.mjs` — HUD 状態組み立て
- `sensor-smoke-test.html` / `sensor-smoke-test.js` — センサー検証ページ
- `tests/` — Node test runner ベースの回帰テスト

## ローカル起動

```bash
npm install
npm run build
npm run dev
```

起動後:

- 本体: `http://127.0.0.1:4173/`
- センサー smoke test: `http://127.0.0.1:4173/sensor-smoke-test.html`

## GitHub Pages

- 公開 URL: `https://mistral-yu.github.io/3dgs-ball-gyro-playground/`
- Pages source: `main` / repository root
- そのまま静的 HTML として配信できる構成です
- HTTPS で配信されるので、iPhone の motion permission 導線も Pages 上で使えます

## 検証コマンド

```bash
npm test
npm run build
npm run check
```

## 実機検証で見るポイント

- iPhone Safari で `Enable Motion` から permission を許可できるか
- Android Chrome で deviceorientation が安定して入るか
- センサー拒否時に Touch Mode へ自然に切り替わるか
- キャリブレーション後に静止時の暴れが抑えられるか
- ゴール・障害物・リセット・タイマーが意図通り動くか

## 注意

- 3DGS そのものから高精度コリジョンは作っていません
- 判定は別ステージの簡易 collider に分離しています
- 現時点では視覚品質より、導線・入力・安定挙動を優先しています
- **README 記載時点で実機未検証です**

## ライセンス / 参考

- ベース viewer の third-party 情報は `THIRD_PARTY_NOTICES.md` を参照
- `Bunny` / `dragon` primitive の扱いも同ファイル準拠
