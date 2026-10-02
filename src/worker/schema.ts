import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  lineUserId: text("line_user_id").primaryKey(),
  name: text("name"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});
