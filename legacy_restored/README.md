# Legacy restore snapshot

このフォルダは、`/root/legacy-kabuhub-src` から復元した旧KabuHubコードの退避先です。

目的:
- 既存の最小起動構成 (`/root/kabuhub/app`) を壊さずに、旧実装をプロジェクト内へ戻す
- 次段階で import 解決と依存復元を進めるための土台にする

次にやること:
1. `legacy_restored/src` の不足依存（components/hooks/constants/types）を洗い出す
2. 実運用ディレクトリ（`app/`, `src/`）へ段階的に統合
3. その都度 `expo start` で起動検証
