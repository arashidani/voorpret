import liff from "@line/liff";
import type { LiffMockConfig } from "@line/liff-mock";

export async function initLiff() {
  if (import.meta.env.DEV) {
    // 動的importにして本番バンドルからMockを外す。
    // デフォルトexportはVite上でコンストラクタにならないので、名前付きで読む
    const { LiffMockPlugin } = await import("@line/liff-mock");
    liff.use(new LiffMockPlugin());
  }

  // `mock` は LiffMockPlugin が足すオプションで、liff.init の型には含まれない
  const config: Parameters<typeof liff.init>[0] & LiffMockConfig = {
    liffId: import.meta.env.VITE_LIFF_ID,
    mock: import.meta.env.DEV,
  };
  await liff.init(config);

  // Mockの isLoggedIn は既定で false のまま変わらないので、開発時は判定しない
  if (!import.meta.env.DEV && !liff.isLoggedIn()) {
    liff.login();
    return null;
  }
  return liff;
}
