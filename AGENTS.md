# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

---

## ビルド元（必読）

- **正のソース**: `C:\Users\illmo\kabuhub`（git remote = GitHub → EAS ビルド）
- `G:\マイドライブ\...` は壊れた古いコピー。ビルドには使われない。
- **grep / read / edit は必ず `C:\Users\illmo\kabuhub` への絶対パスで行うこと**。相対パスや cwd 依存のツール呼び出しは G:\ を誤参照するため禁止。

---

## 禁止設定 — 絶対に変更してはいけないもの

### `"newArchEnabled": false` を維持すること

- `true` にすると SDK 54 + EAS Build で **起動直後に abort クラッシュ**する。
- クラッシュ箇所: `ObjCTurboModule::performVoidMethodInvocation`（New Architecture 専用コード）。
- 症状: TestFlight ではブラックアウト後クラッシュ。Expo Go dev では問題なし（環境が別のため）。
- 再有効化は SDK バージョンアップ時に単独ビルドで検証してから行うこと。

---

## buildNumber 管理（「already submitted」エラー防止）

- `eas.json` の `autoIncrement: true` は app.json の `buildNumber` に +1 した値でビルドする。
- **ビルド後に app.json の buildNumber を更新しないと次回コリジョン**（"You've already submitted this build" エラー）が発生する。
- ルール: **新しい EAS Build を起動する前に `buildNumber` を「最後の提出済みビルド番号 + 1」以上に設定すること**。
- 現在の最終: 提出済みビルド ≤ 10（build 9 → autoIncrement → 10）。次回は 11 以上。

---

## expo-updates の管理

- 現在: `"enabled": false`（New Arch 切り分けのため一時停止）。
- `newArchEnabled: false` で起動確認が取れたら、次のビルドで `"enabled": true` に戻す。
- それまで OTA デプロイは停止中。

---

## EAS Build は月の消耗品（無駄遣い禁止）

フリープランは **月 15 回** まで。超えると翌月1日まで使えない。

### 変更の種類ごとの正しいデプロイ手順

| 変更の種類 | 手順 | EAS Build 消費 |
|---|---|---|
| JS・UI・ロジックの変更 | `git push` → GitHub Actions が `eas update`（OTA）を自動実行 | **0回** |
| `app.json` / `eas.json` / ネイティブ設定 | OTA 不可。EAS Build が必要 | 1回 |
| クラッシュ調査 | **必ず dev-client + OTA で調査してから**、直ったら production ビルド | 最小1回 |

### 鉄則
1. **OTA で確認できるものは OTA で確認する**。JS の変更は絶対に EAS Build しない。
2. クラッシュ調査中は **dev-client ビルド（1回）→ OTA 繰り返し**の順。production ビルドは最後の1回だけ。
3. EAS Build を指示する前に「この変更はネイティブの変更か？」を自問すること。

---

## 起動クラッシュ調査手順（証拠ファースト・推測禁止）

> ビルドは1回30〜45分かかる。推測で直すと何サイクルも無駄になる。**必ず .ips を先に入手して読んでから判断すること**。

### Step 1 — .ips を入手する
TestFlight インストール済み端末: **設定 → プライバシーとセキュリティ → 解析と改善 → 解析データ** → `KabuHub-<日時>.ips` を共有。

### Step 2 — `legacyInfo.threadTriggered.queue` を読む

| queue | 意味 | 次の手 |
|---|---|---|
| `expo.controller.errorRecoveryQueue` | expo-updates が**別のエラーを隠して** abort している | `updates.enabled: false` で再ビルド → 本当のエラーを露出させる |
| `com.meta.react.turbomodulemanager.queue` | **New Architecture** の TurboModule 呼び出し例外 | `newArchEnabled: false` で再ビルド |
| `com.facebook.react.runtime.JavaScript` | JS 実行時例外 | startup JS パス(import chain の top-level コード)を精査 |
| main thread / UI thread | ネイティブ初期化例外 | 各 native module を 1 つずつ無効化して切り分け |

### Step 3 — 1変数ずつ変える
複数の変更を同時に入れると「何が直ったか」が分からなくなる。必ず1変更→1ビルドのサイクルで。

---

## 開発・デバッグ用ビルドの使い方

`eas.json` に `development` プロファイルを追加済み（下記参照）。

```bash
# 1回だけ dev-client を実機にインストール（TestFlight 不要）
eas build --profile development --platform ios
# → QR コードで実機インストール

# 以降はサーバー起動 → 実機で起動するだけ
npx expo start
```

- JS エラーは赤画面(RedBox)として実機に表示される。
- TestFlight ビルドを出す前に dev-client で動作確認できる。
- **次に起動クラッシュが疑われたら dev-client で確認してから EAS Build を出すこと**。

---

## 既知の動作設定（この組み合わせで動く）

```jsonc
// app.json (expo)
{
  "newArchEnabled": false,   // ← 変更禁止
  "updates": {
    "enabled": true,         // ← New Arch 無効化確認後に true に戻す
    "checkAutomatically": "ON_LOAD",
    "fallbackToCacheTimeout": 0
  }
}
```

```jsonc
// eas.json build profiles
// production / preview: distribution "store", autoIncrement true
// development: distribution "internal", developmentClient true
```
