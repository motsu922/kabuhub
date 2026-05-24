# KabuHub セットアップガイド

## 前提条件

- Node.js 18以上
- Expo Go アプリ（iOSまたはAndroid）
- npm または yarn

## 初回セットアップ

```bash
# 1. 依存パッケージのインストール
cd kabuhub
npm install

# 2. 環境変数の設定（AI要約を使う場合）
cp .env.example .env
# .envを開いてOpenAI APIキーを設定

# 3. 開発サーバーを起動
npx expo start
```

## 開発サーバー起動後

- **Expo Go** アプリでQRコードをスキャン
- または `i` でiOSシミュレーター、`a` でAndroidエミュレーターを起動

## ⚠️ Googleドライブ上での開発について

`node_modules` をGoogleドライブで同期するとnpm installが極端に遅くなります。
以下の対処法を推奨します：

### 方法1: node_modulesをGoogleドライブの除外リストに追加

Googleドライブの設定で `node_modules` フォルダを同期対象から除外する。

### 方法2: ローカルドライブで開発する（推奨）

```bash
# ローカルにコピーして開発
xcopy /E /I "G:\マイドライブ\CLOUDE CODE\アプリ開発\個人開発\KabuHub\kabuhub" "C:\Projects\kabuhub"
cd C:\Projects\kabuhub
npm install
npx expo start
```

## ファイル構成

```
kabuhub/
├── app/                        # 画面（Expo Router）
│   ├── (tabs)/
│   │   ├── index.tsx          # ホーム画面
│   │   ├── watchlist.tsx      # ウォッチリスト
│   │   ├── articles.tsx       # 記事保存
│   │   └── settings.tsx       # 設定
│   ├── stock/
│   │   └── [code].tsx         # 銘柄詳細
│   └── _layout.tsx
├── src/
│   ├── types/index.ts         # TypeScript型定義
│   ├── constants/
│   │   ├── theme.ts           # ダークテーマ・緑アクセント
│   │   ├── externalLinks.ts   # 外部サービスURLテンプレート
│   │   └── mockData.ts        # モックデータ（開発用）
│   ├── services/
│   │   ├── storage.ts         # AsyncStorageラッパー
│   │   ├── stockData.ts       # 株価データ取得（モック）
│   │   └── aiSummary.ts       # AI記事要約（OpenAI）
│   ├── hooks/
│   │   ├── useWatchlist.ts    # ウォッチリスト管理
│   │   └── useArticles.ts     # 記事管理
│   └── components/
│       ├── common/
│       │   ├── StatusBadge.tsx # 状態バッジ
│       │   └── MiniChart.tsx   # ミニチャート（SVG）
│       ├── home/
│       │   └── NotificationCard.tsx
│       └── watchlist/
│           └── StockCard.tsx
└── package.json
```

## MVPで実装済みの機能

- [x] ウォッチリスト（銘柄登録・削除・検索）
- [x] ホーム画面（通知・変化銘柄・記事・ウォッチリスト一覧）
- [x] 銘柄詳細（価格・チャート・外部リンク・証券アプリ起動）
- [x] 外部サービスハブ（Yahoo!・株探・TradingView・みんかぶ）
- [x] 証券アプリ起動（SBI・楽天・iSPEED・moomoo・松井・マネックス）
- [x] 記事保存（URL → AI要約 → 関連銘柄抽出）
- [x] AI記事要約（OpenAI gpt-4o-mini）
- [x] ダークテーマ + 緑アクセントデザイン
- [x] 状態ステータス（🟢平常・🟡注目・🟠要確認・🔴急変）

## 今後の実装予定

- [ ] 実株価データAPI連携（J-Quants等）
- [ ] Firebase Firestore同期
- [ ] プッシュ通知（Firebase Cloud Messaging）
- [ ] Premium機能（YouTube要約・AI朝レポート）
