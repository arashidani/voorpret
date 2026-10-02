import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { users } from "./schema";

type Bindings = {
  DB: D1Database;
  LINE_CHANNEL_ID: string;
  SKIP_LINE_VERIFY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post("/api/me", async (c) => {
  const idToken = c.req.header("Authorization")?.replace("Bearer ", "") ?? "";

  let sub = "mock-user";
  let name = "Mock User";

  // 開発時のみ検証をスキップ（本番では SKIP_LINE_VERIFY を設定しない）
  if (c.env.SKIP_LINE_VERIFY !== "true") {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: c.env.LINE_CHANNEL_ID,
      }),
    });
    if (!res.ok) return c.text("unauthorized", 401);
    const user = await res.json<{ sub: string; name: string }>();
    sub = user.sub;
    name = user.name;
  }

  const db = drizzle(c.env.DB);
  await db
    .insert(users)
    .values({ lineUserId: sub, name })
    .onConflictDoUpdate({ target: users.lineUserId, set: { name } });

  return c.json({ userId: sub, name });
});

export default app;
