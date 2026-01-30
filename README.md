# シフト管理システム

半月ごとのシフト希望提出 → 店長がシフト作成 → LINE通知 → A4印刷 を実現するウェブアプリケーション

## 機能概要

### スタッフ向け機能
- シフト希望の入力（不可/出勤OK/フリー/できれば休み）
- 時間帯の指定（30分刻み、10:00〜20:30）
- 早番・遅番テンプレートによるワンタップ入力
- 確定シフトの閲覧
- LINE連携設定（オプション）

### 店長向け機能
- 半月期間の作成（前半1-15日/後半16-月末）
- 提出状況の確認
- スタッフ希望一覧の閲覧
- シフト作成（警告機能付き）
- シフト公開
- A4印刷用シフト表の出力
- LINE通知（リマインド/公開通知）

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router) + TypeScript
- **ORM**: Prisma
- **データベース**: SQLite（開発用）
- **UI**: Tailwind CSS
- **バリデーション**: Zod
- **日付処理**: date-fns
- **LINE連携**: @line/bot-sdk（オプション）
- **認証**: 自前セッション管理（httpOnly cookie + DB）

## セットアップ

### 1. 依存パッケージのインストール

```bash
cd shift-management
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` ファイルを編集:

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="your-random-secret-here"
BASE_URL="http://localhost:3000"

# LINE連携（オプション - 設定しなくてもアプリは動作します）
LINE_CHANNEL_SECRET=""
LINE_CHANNEL_ACCESS_TOKEN=""
```

### 3. データベースのセットアップ

```bash
npm run prisma:migrate
npm run prisma:seed
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアクセスできます。

## 初期アカウント

シードデータで以下のアカウントが作成されます:

| 役割 | ログインID | パスワード |
|------|----------|----------|
| 店長 | admin | admin123 |
| スタッフ | tanaka | staff123 |
| スタッフ | sato | staff123 |
| スタッフ | suzuki | staff123 |

## 画面一覧

### スタッフ画面
- `/login` - ログイン
- `/staff/periods` - 期間一覧（希望入力へのリンク）
- `/staff/periods/[periodId]/availability` - 希望入力
- `/staff/schedule/[periodId]` - 確定シフト閲覧
- `/staff/settings` - 設定（LINE連携）

### 店長画面
- `/admin/periods` - 期間管理
- `/admin/periods/[periodId]/availability` - スタッフ希望一覧
- `/admin/periods/[periodId]/schedule` - シフト作成
- `/admin/periods/[periodId]/publish` - 公開設定・LINE通知
- `/admin/periods/[periodId]/print` - 印刷用シフト表

## 操作説明

### 店長: 期間を作成する
1. `/admin/periods` で年月と期間タイプ（前半/後半）を選択
2. 「期間を作成」をクリック
3. 「受付開始」で希望受付を開始

### スタッフ: 希望を入力する
1. `/staff/periods` で受付中の期間を選択
2. 日付ごとにステータスを選択（不可/出勤OK/フリー/できれば休み）
3. 出勤OKの場合は時間帯を指定（テンプレート利用可）
4. 「提出する」で提出

### 店長: シフトを作成する
1. `/admin/periods/[periodId]/schedule` で日付を選択
2. スタッフの希望状況を確認
3. 「シフトを追加」でスタッフと時間を指定して割当
4. 不可の日や希望時間外には警告が表示される

### 店長: シフトを公開する
1. `/admin/periods/[periodId]/publish` で「シフトを公開」
2. LINE連携済みの場合は「公開 + LINE通知」も選択可能

### シフト表を印刷する
1. `/admin/periods/[periodId]/print` を開く
2. 「印刷」ボタンまたは Ctrl+P で印刷
3. A4横向きで最適化されています

## LINE連携設定（オプション）

LINE連携は完全にオプションです。設定しなくてもアプリは正常に動作します。

### 1. LINE Developers での設定

1. [LINE Developers Console](https://developers.line.biz/) でプロバイダーを作成
2. Messaging API チャンネルを作成
3. チャンネルシークレットとチャンネルアクセストークンを取得
4. Webhook URL を設定: `{BASE_URL}/api/line/webhook`
5. Webhook の利用をオンにする

### 2. 環境変数の設定

```env
LINE_CHANNEL_SECRET="your-channel-secret"
LINE_CHANNEL_ACCESS_TOKEN="your-channel-access-token"
BASE_URL="https://your-domain.com"
```

### 3. スタッフのLINE連携

1. スタッフが `/staff/settings` で「連携コードを発行」
2. LINE公式アカウントを友だち追加
3. 発行された8桁コードをLINEで送信
4. 連携完了

### LINE通知について

- **提出リマインド**: 未提出スタッフに希望提出を促す通知
- **シフト公開通知**: シフト確定を全員に通知

**注意**: LINE Messaging API のPush通知は送信数に応じて料金が発生する場合があります。料金プランについてはLINE公式ドキュメントを確認してください。

## PostgreSQL への切り替え

本番環境では PostgreSQL の使用を推奨します。

### 1. 環境変数の変更

```env
DATABASE_URL="postgresql://user:password@localhost:5432/shift_management"
```

### 2. Prisma スキーマの変更

`prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 3. マイグレーションの実行

```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

## スクリプト一覧

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run start` | プロダクションサーバー起動 |
| `npm run prisma:migrate` | DBマイグレーション |
| `npm run prisma:seed` | シードデータ投入 |
| `npm run prisma:studio` | Prisma Studio起動 |

## 仮定事項

以下の点は仮定に基づいて実装しています:

1. **店名**: 「サンプル店舗」として固定（印刷時に表示）
2. **スタッフ閲覧範囲**: スタッフは自分のシフトのみ閲覧可能
3. **店長数**: 店長は1名のみを想定
4. **連携コード有効期限**: 15分間
5. **締切後の編集**: 店長が「受付開始」に戻すことで再編集可能
6. **シフト重複**: 同一スタッフ・同一日に複数シフト割当は不可
7. **未入力日**: 希望が入力されていない日は「不可」として扱う

## ライセンス

MIT
