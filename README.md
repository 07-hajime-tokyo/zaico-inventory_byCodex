# Zaico 入出庫管理

MySQL/TiDB、Google Apps Script、GitHub CSV を連携する入出庫管理アプリです。Zaicoを解約済みでも使えるように、標準はローカルDB運用です。Zaico APIトークンは通常運用では不要です。

## セットアップ

```powershell
corepack enable
corepack pnpm install
Copy-Item .env.example .env
```

`.env` に本番値を設定してください。最低限必要な値は次の通りです。

- `DATABASE_URL`: MySQL/TiDB 接続文字列
- `JWT_SECRET`: セッション署名用の長いランダム文字列
- `AUTH_ALLOWED_EMAILS`: ログインを許可するメールアドレス
- `ZAICO_OPERATOR_*_NAME` / `ZAICO_OPERATOR_*_EMAIL`: 画面表示用の担当者名とメール
- `GAS_WEBHOOK_SECRET`: GAS とサーバーで共有する Webhook 秘密鍵
- `GAS_WEBHOOK_URL`: GAS の発送管理 Webhook URL
- `GITHUB_CSV_TOKEN`: CSV 取得用 GitHub token

Zaico API連携を意図的に再開する場合だけ、コメントアウトされている `ZAICO_API_TOKEN` と各担当者トークンを設定してください。

## DB移行

Zaicoは解約済みなので、Zaico APIからの再取得ではなく、Manus側で使っていたDBまたは手元のCSVを移します。

### 既存DBのダンプがある場合

1. 新しいMySQL/TiDBデータベースを作成します。
2. Manus側DBのdumpを新DBへインポートします。
3. `.env` の `DATABASE_URL` を新DBに向けます。
4. 足りないマイグレーションを適用します。

```powershell
corepack pnpm run db:push
```

5. Zaico連携をOFFにします。新規DBでは標準でOFFですが、既存DBを移した場合は念のため実行してください。

```sql
INSERT INTO system_settings (`key`, `value`)
VALUES ('zaico_enabled', 'false')
ON DUPLICATE KEY UPDATE `value` = 'false';
```

このリポジトリでは、受け取ったdump用に次の取り込みコマンドも使えます。実行先DBのテーブルを削除して作り直すため、空の新DBにだけ使ってください。

```powershell
corepack pnpm run db:import:dump -- --dry-run
corepack pnpm run db:verify:import -- --dry-run
$env:ALLOW_DB_IMPORT_DROP='true'; corepack pnpm run db:import:dump
corepack pnpm run db:verify:import
```

### DBダンプがない場合

空のDBを作成して `corepack pnpm run db:push` を実行してください。その後、設定画面の「Zaico CSVインポート」から、手元に残っているZaico在庫CSVを取り込めます。Zaicoを解約済みでトークンがない場合、APIインポートは使えません。

## 開発

```powershell
corepack pnpm run dev
```

既定では `http://localhost:3000/` で起動します。未ログイン時はメールログイン画面に遷移します。

## GAS

`gas/zaico_register.gs` と `gas/shipment_only.gs` を Apps Script に貼り付けます。Apps Script のスクリプトプロパティに以下を設定してください。

- `GAS_WEBHOOK_URL`
- `GAS_WEBHOOK_SECRET`
- `GITHUB_TOKEN`

## 検証

```powershell
corepack pnpm run check
corepack pnpm test
corepack pnpm run build
```

通常テストでは外部APIの実トークン検証をスキップします。必要な場合だけ `.env` で有効にしてください。

```env
RUN_ZAICO_OPERATOR_TESTS=true
RUN_GITHUB_CSV_TESTS=true
```
