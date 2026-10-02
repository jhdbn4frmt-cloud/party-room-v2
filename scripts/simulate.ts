import assert from "node:assert/strict";
import { seedQuestions } from "../features/question-bank/seed";
const base = process.env.PARTY_TEST_URL ?? "http://127.0.0.1:3000";
type View = {
  me: string;
  code: string;
  hostId: string;
  members: {
    id: string;
    name: string;
    teamId: string;
    score: number;
    online: boolean;
  }[];
  teams: { id: string; score: number }[];
  game: {
    id: string;
    round: { id: string; question: { id: string }; answered: string[] };
    status: string;
    public: { agents: Record<string, string> };
  };
  stats: { games: number; rounds: number };
};
class Client {
  cookie = "";
  last: View | null = null;
  abort: AbortController | null = null;
  async request(route: string, data?: unknown) {
    const res = await fetch(`${base}${route}`, {
      method: data ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Cookie: this.cookie },
      body: data ? JSON.stringify(data) : undefined,
    });
    const cookie = res.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    const json = await res.json();
    assert(res.ok, JSON.stringify(json));
    return json;
  }
  async command(code: string, data: Record<string, unknown>) {
    return this.request(`/api/rooms/${code}`, {
      ...data,
      requestId: crypto.randomUUID(),
    });
  }
  connect(code: string) {
    this.abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${base}/api/rooms/${code}/events`, {
          headers: { Cookie: this.cookie },
          signal: this.abort!.signal,
        });
        assert(response.ok);
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let pos;
          while ((pos = buffer.indexOf("\n\n")) >= 0) {
            const chunk = buffer.slice(0, pos);
            buffer = buffer.slice(pos + 2);
            if (chunk.startsWith("data: "))
              this.last = JSON.parse(chunk.slice(6));
          }
        }
      } catch (e) {
        if (!(e instanceof Error && e.name === "AbortError"))
          console.error("Stream:", e);
      }
    })();
  }
  disconnect() {
    this.abort?.abort();
    this.abort = null;
  }
}
async function until(fn: () => boolean, ms = 8000) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms)
      throw new Error("Realtime synchronization timed out");
    await new Promise((r) => setTimeout(r, 100));
  }
}
async function main() {
  const clients = Array.from({ length: 15 }, () => new Client());
  const watchers: Client[] = [];
  try {
    const host = clients[0];
    const { code } = await host.request("/api/rooms", { name: "Player01" });
    await Promise.all(
      clients
        .slice(1)
        .map((c, i) =>
          c.command(code, {
            type: "join",
            name: `Player${String(i + 2).padStart(2, "0")}`,
          }),
        ),
    );
    clients.forEach((c) => c.connect(code));
    await until(() => clients.every((c) => c.last?.members.length === 15));
    await host.command(code, { type: "teams", count: 3, method: "random" });
    let state: View = await host.request(`/api/rooms/${code}`);
    assert.deepEqual(
      state.teams.map(
        (t) => state.members.filter((m) => m.teamId === t.id).length,
      ),
      [5, 5, 5],
    );
    const teamIds = state.teams.map((t) => t.id);
    const complete = async () => {
      await host.command(code, { type: "reveal" });
      await host.command(code, { type: "score" });
      await host.command(code, { type: "next" });
    };
    await host.command(code, {
      type: "start",
      gameId: "same-answer",
      settings: { mode: "sync", rounds: 1, team: true },
    });
    state = await host.request(`/api/rooms/${code}`);
    const start = Date.now();
    await Promise.all(
      clients.map((c) =>
        c.command(code, {
          type: "submit",
          roundId: state.game.round.id,
          action: { type: "answer", value: "珍珠奶茶" },
        }),
      ),
    );
    await until(() =>
      clients.every((c) => c.last?.game?.round.answered.length === 15),
    );
    console.log(`15 人提交及同步完成：${Date.now() - start} ms`);
    await complete();
    await until(() =>
      clients.every((c) => c.last?.game?.status === "game_result"),
    );
    assert(clients.every((c) => c.last!.teams.every((t) => t.score === 100)));
    await host.command(code, { type: "lobby" });
    await host.command(code, {
      type: "start",
      gameId: "intel-station",
      settings: { mode: "default", rounds: 1, team: true },
    });
    state = await host.request(`/api/rooms/${code}`);
    const agents = Object.values(state.game.public.agents);
    const q = seedQuestions.find(
      (q) => q.question_id === state.game.round.question.id,
    )!;
    const answers = (q.metadata.questions as { answer: string }[]).map(
      (q) => q.answer,
    );
    await host.command(code, { type: "advance" });
    await host.command(code, { type: "advance" });
    await Promise.all(
      clients
        .filter((c) => !agents.includes(c.last!.me))
        .map((c) =>
          c.command(code, {
            type: "submit",
            roundId: state.game.round.id,
            action: { type: "answer", values: answers },
          }),
        ),
    );
    await complete();
    state = await host.request(`/api/rooms/${code}`);
    assert(state.teams.every((t) => t.score === 200));
    await host.command(code, { type: "lobby" });
    await host.command(code, {
      type: "start",
      gameId: "quiz",
      settings: { mode: "single", rounds: 1, team: false, seconds: 60 },
    });
    state = await host.request(`/api/rooms/${code}`);
    const answer = seedQuestions.find(
      (q) => q.question_id === state.game.round.question.id,
    )!.answer;
    await Promise.all(
      clients.map((c) =>
        c.command(code, {
          type: "submit",
          roundId: state.game.round.id,
          action: { type: "answer", value: answer },
        }),
      ),
    );
    await complete();
    const before: View = await clients[14].request(`/api/rooms/${code}`);
    clients[14].disconnect();
    await new Promise((r) => setTimeout(r, 21000));
    await until(
      () =>
        host.last!.members.find((m) => m.id === before.me)?.online === false,
    );
    const reconnect: View = await clients[14].request(`/api/rooms/${code}`);
    assert.equal(reconnect.me, before.me);
    assert.deepEqual(
      reconnect.members.map((m) => m.score),
      before.members.map((m) => m.score),
    );
    clients[14].connect(code);
    await until(
      () =>
        clients[14].last?.members.find((m) => m.id === before.me)?.online ===
        true,
    );
    console.log("斷線、離線顯示、同 Cookie 重連、身份與分數一致：通過");
    const otherRooms = await Promise.all(
      [1, 2].map(async (n) => {
        const c = new Client();
        watchers.push(c);
        const created = await c.request("/api/rooms", {
          name: `OtherHost${n}`,
        });
        c.connect(created.code);
        return { c, code: created.code };
      }),
    );
    await Promise.all(
      otherRooms.map(async ({ c, code }) => {
        const v: View = await c.request(`/api/rooms/${code}`);
        assert.equal(v.members.length, 1);
        const foreign = await host.request(`/api/rooms/${code}`);
        assert.equal(foreign.me, null);
        await c.command(code, { type: "adjust", target: v.me, delta: 999 });
      }),
    );
    await host.command(code, { type: "end-party" });
    state = await host.request(`/api/rooms/${code}`);
    assert.equal(state.stats.games, 3);
    assert.equal(state.stats.rounds, 3);
    assert.equal(state.members.length, 15);
    assert(state.members.every((m) => m.score === 100));
    assert(state.teams.every((t) => t.score === 200 && teamIds.includes(t.id)));
    console.log("3 房同時存在且資料隔離：通過");
    console.log(
      "15 人：同答案 → 星際情報站 → Quiz → 總榜：通過（個人各 100，3 隊各 200）",
    );
  } finally {
    [...clients, ...watchers].forEach((c) => c.disconnect());
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
