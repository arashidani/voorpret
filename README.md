# voorpret

LINEの中で開くWebアプリ（LIFFアプリ）。React で書いた画面と、Hono で書いたAPIを、Cloudflare Workers 1つから配信する。ユーザー情報は Cloudflare D1（SQLite）に保存する。

LINEのユーザーIDを、フロントから受け取ってそのまま信用することはしない。フロントがLINEから受け取ったIDトークンをAPIに送り、Worker がLINEの検証APIで本物か確かめてから、ユーザーを保存する。

## 技術スタック

| 層 | 技術 |
|---|---|
| フロント | React + TypeScript + Vite |
| LINE連携 | LIFF SDK（`@line/liff`）。開発時は LIFF Mock（`@line/liff-mock`） |
| バックエンド | Cloudflare Workers（静的アセット配信つき）+ Hono |
| DB | Cloudflare D1 |
| ORM | Drizzle ORM（マイグレーションは `drizzle-kit` で生成） |
| 開発ツール | Wrangler + `@cloudflare/vite-plugin` |

## ディレクトリ構成

```
.
├─ src/
│  ├─ main.tsx / App.tsx      # フロント（React）
│  ├─ liff.ts                 # LIFF初期化（開発時はMockを使う）
│  └─ worker/
│     ├─ index.ts             # Worker入口（Hono）。/api/* を受ける
│     └─ schema.ts            # Drizzleスキーマ
├─ migrations/                # drizzle-kit が生成するSQL
├─ drizzle.config.ts
├─ wrangler.jsonc             # Worker・静的アセット・D1の設定
├─ worker-configuration.d.ts  # wrangler types が生成するWorkerの型
├─ vite.config.ts
├─ .env.example               # フロント用の環境変数の見本
└─ .dev.vars.example          # Worker用のローカルシークレットの見本
```

`/api/*` へのリクエストは Worker（Hono）が受ける。それ以外のパスでは、SPA の `index.html` が返る。

## ローカル起動

Node.js 22 以上が必要。

```bash
npm install
cp .env.example .env            # VITE_LIFF_ID を書く
cp .dev.vars.example .dev.vars  # LINE_CHANNEL_ID を書く。SKIP_LINE_VERIFY=true はそのまま
npm run db:migrate:local        # ローカルD1にテーブルを作る
npm run dev                     # http://localhost:5173
```

開発時は LIFF Mock が有効になる。LINEにログインしなくても、`mock-user` として `/api/me` が呼ばれ、画面にユーザーIDと名前が表示される。

### 環境変数

| ファイル | 変数 | 用途 |
|---|---|---|
| `.env` | `VITE_LIFF_ID` | LIFF ID。LINE Developers の LIFF タブで確認できる |
| `.dev.vars` | `LINE_CHANNEL_ID` | LINE Login チャネルのID。IDトークンの検証に使う |
| `.dev.vars` | `SKIP_LINE_VERIFY` | `true` にすると、IDトークンの検証を飛ばす。ローカル専用 |

`.env` と `.dev.vars` は git 管理外にしてある。

## コマンド

| 目的 | コマンド |
|---|---|
| 開発サーバー（フロント・Worker・ローカルD1） | `npm run dev` |
| 型チェックとビルド | `npm run build` |
| Lint | `npm run lint` |
| スキーマからマイグレーションを生成 | `npm run db:generate` |
| マイグレーションをローカルDBに適用 | `npm run db:migrate:local` |
| マイグレーションを本番DBに適用 | `npm run db:migrate:remote` |
| `wrangler.jsonc` を変えたあとに型を再生成 | `npm run cf-typegen` |
| デプロイ | `npm run deploy` |

ローカルのD1データは `.wrangler/state/` に保存される。DBをまっさらにしたいときは、このフォルダを消してから `npm run db:migrate:local` をやり直す。

## スキーマを変えるとき

1. `src/worker/schema.ts` を編集する
2. `npm run db:generate` で `migrations/` にSQLを生成する
3. `npm run db:migrate:local` でローカルに適用する

マイグレーションは `drizzle-kit generate` だけで作る。`wrangler d1 migrations create` も使うと、同じDBのマイグレーションを2か所で管理することになる。

## 本番に出すまで

1. `npx wrangler d1 create voorpret-db` を実行し、出力された `database_id` を `wrangler.jsonc` に書く（今は仮の値が入っている）
2. `npx wrangler secret put LINE_CHANNEL_ID` でチャネルIDを登録する。`SKIP_LINE_VERIFY` は本番に設定しない
3. `npm run db:migrate:remote` で本番DBにテーブルを作る
4. `npm run deploy` でデプロイする
5. LINE Developers で、LIFF の Endpoint URL をデプロイ先のURLに切り替える

実機のLINEで開発中の画面を見たいときは、cloudflared などのトンネルで `localhost:5173` をHTTPSで公開する。

## 実装上の注意

### 認証

- `liff.getProfile()` で取れるユーザーIDは、フロントで書き換えられる。バックエンドに送っても認証には使わない。
- フロントは `liff.getIDToken()` で取ったトークンを `Authorization: Bearer` ヘッダーで送る。Worker はそれを `https://api.line.me/oauth2/v2.1/verify` に投げて確かめる。
- LIFF Mock のトークンは偽物なので、検証を通らない。開発時に限り、`SKIP_LINE_VERIFY=true` で検証を飛ばしている。

### LIFF Mock

- `@line/liff-mock` は名前付きで import する（`import { LiffMockPlugin } from "@line/liff-mock"`）。デフォルトimportにすると、Vite 上でコンストラクタとして呼べない。
- Mock は開発時だけ動的importで読む。静的importにすると、本番バンドルにも Mock が入る。
- Mock の `isLoggedIn()` は既定で `false` を返し、`login()` を呼んでも変わらない。そのため開発時はログイン判定を飛ばしている。

### D1とトランザクション

- `BEGIN` と `COMMIT` を別々のクエリで送る書き方は使えない。
- 複数の文をまとめて実行するときは `db.batch([...])` を使う。1トランザクションで実行され、どれかが失敗すれば全体がロールバックされる。
- 「読んで、判断して、書く」処理は、条件つきの1文にまとめる。たとえば `UPDATE stock SET count = count - 1 WHERE item = ? AND count > 0` を実行し、更新件数が0なら在庫切れと判断する。
- SELECT の結果を見て JS で分岐し、そのあと UPDATE する、という流れは1トランザクションにまとめられない。それが必要になったら、Durable Objects か Postgres（Supabase など）を検討する。

## 参考

- [LIFF ドキュメント（LINE Developers）](https://developers.line.biz/ja/docs/liff/)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Drizzle ORM: Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1)
