import { describe, it, expect } from "vitest";
import {
  normalize,
  partyPoints,
  syncFactor,
  uniqueFactor,
  groups,
  canonical,
} from "../lib/scoring";
import { assignTeams, ability } from "../features/teams/balance";
import { fixture, act, start, finish, NOW } from "./helpers";
import { auth, joinRoom, command, tick, scores } from "../features/room/engine";
import { project } from "../features/room/project";
import { seedQuestions } from "../features/question-bank/seed";
import { selectQuestions } from "../features/question-bank/select";
import { defaultSettings } from "../games/catalog";
import { questionSchema } from "../features/question-bank/schema";
describe("scoring and normalization", () => {
  it("normalizes width, case and spaces without semantic guessing", () => {
    expect(normalize("  ＡＢＣ　 ")).toBe("abc");
    expect(normalize("蛋餅")).not.toBe(normalize("玉米蛋餅"));
  });
  it("uses approved aliases only", () => {
    expect(canonical("７１１", [], { "711": "7-11" })).toBe("7-11");
    expect(canonical("711")).not.toBe("7-11");
  });
  it("calculates sync, unique and balanced scores", () => {
    expect(syncFactor(3, 5)).toBe(0.5);
    expect(syncFactor(1, 1)).toBe(0);
    expect(uniqueFactor(4)).toBe(0.25);
    expect(partyPoints(50, 80)).toBe(63);
    expect(partyPoints(120, 100)).toBe(100);
    expect(partyPoints(-3, 10)).toBe(0);
    expect(partyPoints(2, 0)).toBe(0);
  });
  it("groups equal answers and supports explicit merges", () => {
    expect(groups({ a: "A", b: "Ａ", c: "b" })).toEqual({
      a: ["a", "b"],
      b: ["c"],
    });
    expect(groups({ a: "711", b: "7-11" }, [["711", "7-11"]])).toEqual({
      "7-11": ["a", "b"],
    });
  });
});
describe("rooms, permissions, transitions and privacy", () => {
  it("creates one host, joins four players and rejects normalized duplicate names", () => {
    const r = fixture();
    expect(r.members).toHaveLength(4);
    expect(() => joinRoom(r, " ＨＯＳＴ ", "x", NOW)).toThrow("暱稱");
    start(r, "quiz", "single");
    expect(r.game?.roster).toHaveLength(4);
  });
  it("enforces host privileges and room-scoped session identity", () => {
    const r = fixture();
    expect(() =>
      act(
        r,
        { type: "adjust", target: r.members[1].id, delta: 5 },
        r.members[1],
      ),
    ).toThrow("主持人");
    expect(() =>
      act(
        r,
        { type: "start", gameId: "quiz", settings: { mode: "single" } },
        r.members[1],
      ),
    ).toThrow("主持人");
    const other = fixture(4, "2345");
    other.members[0].tokenHash = "no";
    expect(() => auth(other, "host-token")).toThrow();
  });
  it("reconnect restores the same member, team and score", () => {
    const r = fixture();
    act(r, { type: "teams", count: 2 });
    act(r, { type: "adjust", target: r.members[1].id, delta: 23 });
    const restored = auth(JSON.parse(JSON.stringify(r)), "token-1");
    expect(restored.id).toBe(r.members[1].id);
    expect(restored.teamId).toBe(r.members[1].teamId);
    expect(scores(r)[restored.id]).toBe(23);
  });
  it("double start and duplicate requests create no extra session or score", () => {
    const r = fixture();
    const c = {
      type: "start",
      gameId: "quiz" as const,
      settings: { mode: "single", rounds: 1 },
      requestId: "same",
    };
    command(r, r.members[0], c, NOW);
    const id = r.game!.id;
    command(r, r.members[0], c, NOW);
    expect(r.game!.id).toBe(id);
    expect(() => start(r, "quiz", "single")).toThrow("已經開始");
  });
  it("rejects invalid transition, duplicate answer, stale round, late submission", () => {
    const r = fixture();
    start(r, "quiz", "single");
    expect(() => act(r, { type: "next" })).toThrow();
    expect(() =>
      act(r, {
        type: "submit",
        roundId: "old",
        action: { type: "answer", value: "x" },
      }),
    ).toThrow("題目已更新");
    act(r, { type: "submit", action: { type: "answer", value: "x" } });
    expect(() =>
      act(r, { type: "submit", action: { type: "answer", value: "x" } }),
    ).toThrow("已經送出");
    expect(() =>
      act(
        r,
        { type: "submit", action: { type: "answer", value: "x" } },
        r.members[1],
        NOW + 40000,
      ),
    ).toThrow();
  });
  it("pauses and resumes authoritative remaining time", () => {
    const r = fixture();
    start(r, "quiz", "single");
    act(r, { type: "pause" }, r.members[0], NOW + 10000);
    tick(r, NOW + 100000);
    expect(r.game!.status).toBe("paused");
    act(r, { type: "resume" }, r.members[0], NOW + 100000);
    expect(r.game!.round.endsAt).toBe(NOW + 120000);
  });
  it("midgame join waits and survives next game", () => {
    const r = fixture();
    start(r, "quiz", "single");
    const m = joinRoom(r, "Late", "late-token", NOW);
    expect(m.waiting).toBe(true);
    expect(() =>
      act(r, { type: "submit", action: { type: "answer", value: "x" } }, m),
    ).toThrow("下一局");
    finish(r);
    act(r, { type: "lobby" });
    start(r, "same-answer", "sync");
    expect(r.game!.roster).toContain(m.id);
    expect(m.waiting).toBe(false);
  });
  it("locks joining, caps at 16 and removes sessions", () => {
    const r = fixture(16);
    expect(() => joinRoom(r, "Extra", "x", NOW)).toThrow("已滿");
    act(r, { type: "allow-join" });
    expect(() => joinRoom(r, "Extra", "x", NOW)).toThrow("關閉");
    act(r, { type: "remove", target: r.members[1].id });
    expect(() => auth(r, "token-1")).toThrow();
  });
  it("scores once and records undo as an inverse event", () => {
    const r = fixture();
    start(r, "quiz", "single");
    act(r, {
      type: "submit",
      action: { type: "answer", value: r.game!.round.question.answer },
    });
    finish(r);
    expect(scores(r)[r.hostId]).toBe(100);
    expect(() => act(r, { type: "score" })).toThrow();
    const event = r.ledger.find(
      (e) => e.layer === "party" && e.target === r.hostId,
    )!;
    const length = r.ledger.length;
    act(r, { type: "undo-score", eventId: event.id });
    expect(r.ledger).toHaveLength(length + 1);
    expect(scores(r)[r.hostId]).toBe(0);
    expect(() => act(r, { type: "undo-score", eventId: event.id })).toThrow();
  });
  it("team points stay with old team after moving a player", () => {
    const r = fixture();
    act(r, { type: "teams", count: 2 });
    const old = r.members[0].teamId!;
    start(r, "quiz", "single", true);
    act(r, {
      type: "submit",
      action: { type: "answer", value: r.game!.round.question.answer },
    });
    finish(r);
    expect(scores(r)[old]).toBe(100);
    expect(scores(r)[r.hostId]).toBeUndefined();
    act(r, {
      type: "move",
      target: r.hostId,
      teamId: r.teams.find((t) => t.id !== old)!.id,
    });
    expect(scores(r)[old]).toBe(100);
  });
  it("does not send answers, session hashes or other private data before reveal", () => {
    const r = fixture();
    start(r, "quiz", "single");
    const view = project(r, r.members[1], NOW);
    const text = JSON.stringify(view);
    expect(text).not.toContain("tokenHash");
    expect(text).not.toContain("accepted_aliases");
    expect(view.game!.round.question).not.toHaveProperty("answer");
    expect(view.game!.result).toBeNull();
    expect(view.game!.host).toBeNull();
  });
  it("host transfer is exclusive and elected after 90 seconds offline", () => {
    const r = fixture();
    r.members[0].lastSeen = NOW - 91000;
    tick(r, NOW);
    expect(r.election).not.toBeNull();
    const target = r.members[1].id;
    for (const m of r.members.slice(1))
      act(r, { type: "vote-host", target }, m, NOW);
    for (const m of r.members.slice(1)) m.lastSeen = NOW + 20001;
    tick(r, NOW + 20001);
    expect(r.hostId).toBe(target);
    expect(r.election).toBeNull();
    expect(() =>
      act(r, { type: "allow-join" }, r.members[0], NOW + 20001),
    ).toThrow("主持人");
  });
  it("tie causes revote then a single randomly selected host", () => {
    const r = fixture(3);
    r.members[0].lastSeen = NOW - 91000;
    tick(r, NOW);
    for (const m of r.members.slice(1))
      act(r, { type: "vote-host", target: m.id }, m, NOW);
    r.members.slice(1).forEach((m) => (m.lastSeen = NOW + 20001));
    tick(r, NOW + 20001);
    expect(r.election!.round).toBe(2);
    for (const m of r.members.slice(1))
      act(r, { type: "vote-host", target: m.id }, m, NOW + 20002);
    r.members.slice(1).forEach((m) => (m.lastSeen = NOW + 40002));
    tick(r, NOW + 40002);
    expect(r.members.slice(1).map((m) => m.id)).toContain(r.hostId);
    expect(r.election).toBeNull();
  });
  it("merge undo recalculates without rewriting scores", () => {
    const r = fixture();
    start(r, "same-answer", "sync");
    act(r, { type: "submit", action: { type: "answer", value: "a" } });
    act(
      r,
      { type: "submit", action: { type: "answer", value: "b" } },
      r.members[1],
    );
    act(r, { type: "reveal" });
    act(r, { type: "merge", values: ["a", "b"] });
    expect(
      (
        project(r, r.members[0], NOW).game!.result as {
          scores: Record<string, number>;
        }
      ).scores[r.hostId],
    ).toBe(10);
    act(r, { type: "undo-merge" });
    expect(
      (
        project(r, r.members[0], NOW).game!.result as {
          scores: Record<string, number>;
        }
      ).scores[r.hostId],
    ).toBe(0);
    expect(r.ledger).toHaveLength(0);
  });
});
describe("teams and question bank", () => {
  it("balances 15 players into 3 teams, retaining locks", () => {
    const r = fixture(15);
    act(r, { type: "teams", count: 3 });
    r.members[0].locked = true;
    const original = r.members[0].teamId;
    r.members.forEach((m, i) => (m.abilities.knowledge = i / 14));
    assignTeams(r, true);
    expect(r.members[0].teamId).toBe(original);
    expect(
      r.teams.map((t) => r.members.filter((m) => m.teamId === t.id).length),
    ).toEqual([5, 5, 5]);
    const sums = r.teams.map((t) =>
      r.members
        .filter((m) => m.teamId === t.id)
        .reduce((s, m) => s + ability(m), 0),
    );
    expect(Math.max(...sums) - Math.min(...sums)).toBeLessThan(0.5);
  });
  it("retains neutral ability without prior data", () =>
    expect(ability(fixture().members[0])).toBe(0.5));
  it("all seeds validate and meet requested content counts", () => {
    seedQuestions.forEach((q) =>
      expect(() => questionSchema.parse(q), q.question_id).not.toThrow(),
    );
    for (const mode of ["sync", "unique", "bomb", "burst"])
      expect(
        seedQuestions.filter(
          (q) => q.game_id === "same-answer" && q.mode === mode,
        ).length,
      ).toBeGreaterThanOrEqual(15);
    expect(
      seedQuestions.filter((q) => q.game_id === "quiz").length,
    ).toBeGreaterThanOrEqual(80);
    expect(seedQuestions.filter((q) => q.game_id === "commander")).toHaveLength(
      20,
    );
    expect(
      seedQuestions.filter((q) => q.game_id === "intel-station"),
    ).toHaveLength(12);
  });
  it("never relaxes age/spice, prefers unused and varies option positions", () => {
    const settings = { ...defaultSettings, mode: "single" };
    const all = seedQuestions.filter(
      (q) => q.game_id === "quiz" && q.mode === "single",
    );
    const used = all.slice(0, -1).map((q) => q.question_id);
    expect(
      selectQuestions(seedQuestions, "quiz", settings, used, 1)[0].question_id,
    ).toBe(all.at(-1)!.question_id);
    const unsafe = all.map((q) => ({ ...q, age_rating: 21, spice_level: 3 }));
    expect(() => selectQuestions(unsafe, "quiz", settings, [], 1)).toThrow();
    const chosen = selectQuestions(seedQuestions, "quiz", settings, [], 30);
    expect(chosen.some((q) => q.possible_answers.indexOf(q.answer) > 0)).toBe(
      true,
    );
  });
});

describe("long party rounds", () => {
  it("completes 40 same-answer rounds including round 9, preserves identity and scores once", () => {
    let r = fixture();
    act(r, {
      type: "start",
      gameId: "same-answer",
      settings: { mode: "sync", rounds: 40, scoring: "raw" },
    });
    const ids = r.members.map((m) => m.id);
    for (let index = 0; index < 40; index++) {
      expect(r.game!.rounds).toHaveLength(index);
      for (const member of r.members)
        act(
          r,
          { type: "submit", action: { type: "answer", value: "共同答案" } },
          member,
        );
      expect(project(r, r.members[1], NOW).game!.result).toBeNull();
      act(r, { type: "reveal" });
      act(r, { type: "score" });
      const count = r.ledger.length;
      expect(() => act(r, { type: "score" })).toThrow();
      expect(r.ledger).toHaveLength(count);
      act(r, { type: "next" });
      // Actual persisted JSON shape survives reload every round.
      r = JSON.parse(JSON.stringify(r));
      expect(auth(r, "token-1").id).toBe(ids[1]);
    }
    expect(r.game!.rounds).toHaveLength(40);
    expect(r.game!.status).toBe("game_result");
    expect(new Set(r.members.map((m) => scores(r)[m.id])).size).toBe(1);
    expect(scores(r)[r.hostId]).toBe(400);
  });
});
