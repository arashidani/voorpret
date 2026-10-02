import { useEffect, useState } from "react";
import { initLiff } from "./liff";
import "./App.css";

type Me = { userId: string; name: string };

type State =
  | { status: "loading" }
  | { status: "redirecting" }
  | { status: "ready"; me: Me }
  | { status: "error"; message: string };

function App() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const liff = await initLiff();
        if (!liff) {
          setState({ status: "redirecting" });
          return;
        }
        const res = await fetch("/api/me", {
          method: "POST",
          headers: { Authorization: "Bearer " + liff.getIDToken() },
        });
        if (!res.ok) throw new Error(`/api/me: ${res.status}`);
        setState({ status: "ready", me: await res.json() });
      } catch (e) {
        setState({ status: "error", message: String(e) });
      }
    })();
  }, []);

  return (
    <main>
      <h1>my-liff</h1>
      {state.status === "loading" && <p>LIFFを初期化しています…</p>}
      {state.status === "redirecting" && <p>LINEログインへ移動しています…</p>}
      {state.status === "error" && <p className="error">{state.message}</p>}
      {state.status === "ready" && (
        <dl>
          <dt>userId</dt>
          <dd data-testid="user-id">{state.me.userId}</dd>
          <dt>name</dt>
          <dd data-testid="user-name">{state.me.name}</dd>
        </dl>
      )}
    </main>
  );
}

export default App;
