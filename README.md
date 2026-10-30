# 星詠（hoshiyomi）— AI占いエージェント

クライアントに必要事項をヒアリングし、**正確な天文・暦計算**をもとに
西洋占星術・四柱推命・タロットを鑑定するチャットボット。
鑑定文は **Cloudflare Workers AI** で生成する（外部APIキー不要・Cloudflare完結）。

## 構成

```
functions/
  api/
    divinations.js   GET  /api/divinations  … 占い一覧と必要項目
    reading.js       POST /api/reading       … 計算 + Workers AIで鑑定
  _lib/
    astrology.js     西洋占星術（astronomy-engineで of-date 黄経/ASC/MC/アスペクト）
    fourpillars.js   四柱推命（節入りを太陽黄経で判定・干支60周期）
    tarot.js         タロット（78枚・正逆・3スプレッド）
    divinations.js   必要項目レジストリ＋都市座標＋入力パーサ
    reading.js       計算オーケストレーション＋LLMプロンプト
public/              チャットボットUI（静的）
wrangler.toml        Pages設定（AIバインディング）
.github/workflows/deploy.yml  main push → 自動デプロイ
```

## 精度について（検証済み）

- **占星術**：アインシュタイン（1879-03-14 11:30 Ulm）で 太陽=魚座23°30′／月=射手座／ASC=蟹座11°38′ と公開データに一致。
- **四柱推命**：2000-01-01 = 己卯年 丙子月 戊午日（万年暦一致）、1990-06-05 日柱=辛丑（一致）、立春の年境界も正確。

## デプロイ（さねさんの標準運用）

1. GitHubリポジトリ `hoshiyomi` を作成し push（origin=本番の単一ソース）
2. GitHub Secret に `CLOUDFLARE_API_TOKEN`（権限 **Pages:Edit** / Account=jp.lab.diamond）を登録
   - Account ID `7969ecaa0a1b9bacae1861547c2ec3fe` は deploy.yml に直書き済み
3. `main` への push で `wrangler pages deploy` が本番反映（約1〜2分）
4. 初回デプロイ後、Cloudflare の Pages プロジェクト `hoshiyomi` に **Workers AI バインディング（変数名 `AI`）** が付いていることを確認（wrangler.toml の `[ai]` で自動設定されるが、ダッシュボードで要確認）

### ローカル確認

```bash
npm install
npx wrangler pages dev public   # Functions込み。Workers AIは --remote で実呼び出し
```

## カスタマイズ

- 鑑定文モデル：Pages 環境変数 `AI_MODEL`（既定 `@cf/meta/llama-3.3-70b-instruct-fp8-fast`。日本語重視なら Qwen系も可）
- 占いの追加：`functions/_lib/divinations.js` にレジストリを足し、`reading.js` の `computeDivination` に計算分岐を追加（次フェーズ：数秘術・姓名判断・九星気学・易・おみくじ・血液型）

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
