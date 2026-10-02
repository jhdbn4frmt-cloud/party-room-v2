import assert from "node:assert/strict";
const origin = process.env.PARTY_TEST_URL ?? "http://127.0.0.1:3000";
class Player {
  cookie = "";
  async request(path: string, data?: object) {
    const response = await fetch(origin + path, {
      method: data ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Cookie: this.cookie },
      body: data ? JSON.stringify(data) : undefined,
    });
    const cookie = response.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    const body = await response.json();
    assert(response.ok, JSON.stringify(body));
    return body;
  }
  command(code: string, data: object) {
    return this.request(`/api/rooms/${code}`, {
      ...data,
      requestId: crypto.randomUUID(),
    });
  }
}
const players = Array.from({ length: 4 }, () => new Player());
const { code } = await players[0].request("/api/rooms", { name: "40回合主持" });
for (let i = 1; i < 4; i++)
  await players[i].command(code, { type: "join", name: `長局玩家${i}` });
await players[0].command(code, {
  type: "start",
  gameId: "same-answer",
  settings: {
    mode: "sync",
    team: false,
    rounds: 40,
    seconds: 120,
    scoring: "raw",
  },
});
const identities = await Promise.all(
  players.map((p) => p.request(`/api/rooms/${code}`).then((s) => s.me)),
);
for (let round = 1; round <= 40; round++) {
  const state = await players[0].request(`/api/rooms/${code}`);
  assert.equal(state.game.round.number, round);
  await Promise.all(
    players.map((p) =>
      p.command(code, {
        type: "submit",
        roundId: state.game.round.id,
        action: { type: "answer", value: "珍珠奶茶" },
      }),
    ),
  );
  const hidden = await players[1].request(`/api/rooms/${code}`);
  assert.equal(hidden.game.result, null);
  for (const type of ["reveal", "score", "next"])
    await players[0].command(code, { type });
  if (round === 8 || round === 9 || round === 40) {
    const restored = new Player();
    restored.cookie = players[1].cookie;
    const view = await restored.request(`/api/rooms/${code}`);
    assert.equal(view.me, identities[1]);
    assert.equal(view.members.length, 4);
    console.log(`第 ${round} 回合：4 位獨立玩家、計分、相同 Cookie 重連通過`);
  }
}
const final = await players[0].request(`/api/rooms/${code}`);
assert.equal(final.game.status, "game_result");
for (const m of final.members) assert.equal(m.score, 400);
console.log(
  "PASS: 40 回合完整 HTTP 流程，每人 400 分；未使用假資料庫或瀏覽器本地儲存。",
);
await players[0].command(code, { type: "end-party" });
