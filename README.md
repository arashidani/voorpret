# voorpret

LINEアプリ（LIFF）。React + Vite のフロントと、Hono の Worker を Cloudflare Workers 1つで配信し、D1 にユーザーを保存する。

## ローカル起動

```bash
npm install
cp .env.example .env            # VITE_LIFF_ID を設定
cp .dev.vars.example .dev.vars  # LINE_CHANNEL_ID を設定（SKIP_LINE_VERIFY=true のまま）
npm run db:migrate:local        # ローカルD1にテーブルを作る
npm run dev                     # http://localhost:5173
```

開発時は LIFF Mock が有効になり、LINE にログインしなくても `mock-user` として `/api/me` が呼ばれる。

## コマンド

| 目的 | コマンド |
|---|---|
| 開発サーバー（フロント・Worker・ローカルD1） | `npm run dev` |
| スキーマからマイグレーション生成 | `npm run db:generate` |
| ローカルDBに適用 | `npm run db:migrate:local` |
| 本番DBに適用 | `npm run db:migrate:remote` |
| `wrangler.jsonc` を変えたあとの型の再生成 | `npm run cf-typegen` |
| デプロイ | `npm run deploy` |

## 本番に出す前に

1. `npx wrangler d1 create my-liff-db` を実行し、出力された `database_id` を `wrangler.jsonc` に書く
2. `npx wrangler secret put LINE_CHANNEL_ID` でチャネルIDを登録する（`SKIP_LINE_VERIFY` は本番に設定しない）
3. `npm run db:migrate:remote` のあと `npm run deploy`
4. LINE Developers で LIFF の Endpoint URL をデプロイ先のURLに切り替える

ローカルのD1データは `.wrangler/state/` にある。消したいときはこのフォルダを削除する。
