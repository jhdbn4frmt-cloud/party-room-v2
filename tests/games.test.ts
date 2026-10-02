import { describe, it, expect } from "vitest";
import { fixture, act, start, finish, NOW } from "./helpers";
import { project } from "../features/room/project";
import type { Result, GameId } from "../games/types";
import { canonical } from "../lib/scoring";
import { tick } from "../features/room/engine";
const result = (r: ReturnType<typeof fixture>) =>
  project(r, r.members[0], NOW).game!.result as Result;
describe("every playable game module", () => {
  it("unique rewards rare answers and rejects invalid host-judged answers", () => {
    const r = fixture();
    start(r, "same-answer", "unique");
    ["a", "a", "b", "c"].forEach((value, i) =>
      act(
        r,
        { type: "submit", action: { type: "answer", value } },
        r.members[i],
      ),
    );
    act(r, { type: "reveal" });
    act(r, { type: "judge", target: r.members[3].id, valid: false });
    expect(result(r).scores[r.members[0].id]).toBe(5);
    expect(result(r).scores[r.members[2].id]).toBe(10);
    expect(result(r).scores[r.members[3].id]).toBeUndefined();
    finish(r);
  });
  it("bomb enforces turn, duplicates and timeout elimination", () => {
    const r = fixture();
    start(r, "same-answer", "bomb");
    const valid = (r.game!.round.question.metadata.validAnswers as string[])[0];
    expect(() =>
      act(
        r,
        { type: "submit", action: { type: "answer", value: valid } },
        r.members[1],
      ),
    ).toThrow("輪到");
    act(r, { type: "submit", action: { type: "answer", value: valid } });
    act(
      r,
      { type: "submit", action: { type: "answer", value: valid } },
      r.members[1],
    );
    expect(r.game!.round.data.eliminated).toContain(r.members[1].id);
    tick(r, NOW + 10001);
    tick(r, NOW + 20002);
    expect(r.game!.status).toBe("revealing");
    expect((r.game!.round.data.alive as string[]).length).toBe(1);
  });
  it("burst limits count and duplicate answers with capped rarity bonus", () => {
    const r = fixture();
    start(r, "same-answer", "burst");
    // Canonical aliases (e.g. 711 and 7-11) are intentionally one answer.
    const metadata = r.game!.round.question.metadata;
    const aliases = (metadata.aliases ?? {}) as Record<string, string>;
    const values = [
      ...new Map(
        (metadata.validAnswers as string[]).map((value) => [
          canonical(value, [], aliases),
          value,
        ]),
      ).values(),
    ].slice(0, 10);
    for (const value of values)
      act(r, { type: "submit", action: { type: "answer", value } });
    expect(() =>
      act(r, { type: "submit", action: { type: "answer", value: values[0] } }),
    ).toThrow();
    act(r, { type: "reveal" });
    expect(result(r).scores[r.hostId]).toBeLessThanOrEqual(15);
    finish(r);
  });
  it("commander exposes rule only to commander and accepts two guesses", () => {
    const r = fixture();
    start(r, "commander");
    expect(project(r, r.members[1], NOW).game!.private).toEqual({});
    expect(project(r, r.members[0], NOW, true).game!.private).toEqual({});
    expect(project(r, r.members[0], NOW).game!.private.rule).toBeTruthy();
    act(r, {
      type: "submit",
      action: { type: "order", values: r.game!.roster },
    });
    for (let i = 0; i < 2; i++)
      act(
        r,
        { type: "submit", action: { type: "answer", value: "生日" } },
        r.members[1],
      );
    expect(() =>
      act(
        r,
        { type: "submit", action: { type: "answer", value: "生日" } },
        r.members[1],
      ),
    ).toThrow("兩次");
    act(r, { type: "reveal" });
    act(r, { type: "judge", target: r.members[1].id, valid: true });
    expect(result(r).scores[r.members[1].id]).toBe(10);
    finish(r);
  });
  it("intel rotates agents and removes passage after read stage", () => {
    const r = fixture(6);
    act(r, { type: "teams", count: 2 });
    start(r, "intel-station", "default", true);
    const agent = Object.values(
      r.game!.round.data.agents as Record<string, string>,
    )[0];
    const m = r.members.find((m) => m.id === agent)!;
    expect(project(r, m, NOW).game!.private.passage).toBeTruthy();
    expect(project(r, m, NOW + 31000).game!.private.passage).toBeUndefined();
    expect(project(r, m, NOW, true).game!.private.passage).toBeUndefined();
    act(r, { type: "advance" });
    expect(project(r, m, NOW).game!.private.passage).toBeUndefined();
    act(r, { type: "advance" });
    const answer = (
      r.game!.round.question.metadata.questions as { answer: string }[]
    ).map((q) => q.answer);
    const others = r.members.filter(
      (m) => !Object.values(r.game!.round.data.agents as object).includes(m.id),
    );
    others.forEach((m) =>
      act(r, { type: "submit", action: { type: "answer", values: answer } }, m),
    );
    expect(() =>
      act(r, { type: "submit", action: { type: "answer", values: answer } }, m),
    ).toThrow("情報員");
    finish(r);
    expect(Object.values(r.game!.raw)).toEqual([30, 30]);
  });
  for (const mode of ["single", "boolean", "number", "order"])
    it(`quiz ${mode} validates and scores exact answer`, () => {
      const r = fixture();
      start(r, "quiz", mode);
      const q = r.game!.round.question;
      act(r, {
        type: "submit",
        action:
          mode === "order"
            ? { type: "answer", values: q.answer.split("|") }
            : { type: "answer", value: q.answer },
      });
      finish(r);
      expect(r.game!.raw[r.hostId]).toBe(q.base_score * q.difficulty_weight);
    });
  it("music uses server buzz order and partial mashup scoring", () => {
    const r = fixture();
    start(r, "guess-music", "intro");
    for (const m of [r.members[1], r.members[0]]) {
      act(r, { type: "submit", action: { type: "buzz" } }, m);
      act(
        r,
        {
          type: "submit",
          action: { type: "answer", value: r.game!.round.question.answer },
        },
        m,
      );
    }
    act(r, { type: "reveal" });
    expect(result(r).scores[r.members[1].id]).toBe(10);
    expect(result(r).scores[r.hostId]).toBeUndefined();
    finish(r);
    start(r, "guess-music", "mashup");
    act(r, {
      type: "submit",
      action: {
        type: "answer",
        values: r.game!.round.question.answer.split("|").slice(0, 2),
      },
    });
    act(r, { type: "reveal" });
    expect(result(r).scores[r.hostId]).toBe(20);
  });
  for (const id of ["lyrics-melody", "streetview-hunt"] as GameId[])
    it(`${id} supports host verification`, () => {
      const r = fixture();
      start(r, id);
      act(r, {
        type: "submit",
        action: { type: "answer", value: "找到紅色招牌" },
      });
      act(r, { type: "reveal" });
      expect(result(r).scores[r.hostId] ?? 0).toBe(0);
      act(r, { type: "judge", target: r.hostId, valid: true });
      expect(result(r).scores[r.hostId]).toBe(10);
      finish(r);
    });
  it("werewolf keeps roles secret, tracks phases, votes and eliminations", () => {
    const r = fixture(8);
    start(r, "werewolf");
    const player = project(r, r.members[1], NOW);
    expect(player.game!.private.role).toBeTruthy();
    expect(player.game!.host).toBeNull();
    const tv = project(r, r.members[0], NOW, true);
    expect(tv.game!.private).toEqual({});
    expect(tv.game!.host).toBeNull();
    act(r, { type: "advance" });
    expect(r.game!.round.phase).toBe("day");
    act(r, { type: "advance" });
    r.members.forEach((m) =>
      act(
        r,
        { type: "submit", action: { type: "answer", value: r.members[1].id } },
        m,
      ),
    );
    act(r, { type: "reveal" });
    act(r, { type: "score" });
    expect(r.game!.data.alive).not.toContain(r.members[1].id);
  });
  it("most likely anonymizes ballots and is unscored by default", () => {
    const r = fixture();
    start(r, "most-likely");
    r.members.forEach((m) =>
      act(
        r,
        { type: "submit", action: { type: "answer", value: r.hostId } },
        m,
      ),
    );
    act(r, { type: "reveal" });
    expect(project(r, r.members[1], NOW).game!.round.submissions).toEqual({});
    expect(
      (result(r).summary as { votes: Record<string, number> }).votes[r.hostId],
    ).toBe(4);
    finish(r);
    expect(r.ledger).toHaveLength(0);
  });
  it("friend sync hides target answer until reveal", () => {
    const r = fixture();
    start(r, "friend-sync");
    act(r, { type: "submit", action: { type: "answer", value: "奶茶" } });
    expect(project(r, r.members[1], NOW).game!.mine).toBeNull();
    act(
      r,
      { type: "submit", action: { type: "answer", value: "奶茶" } },
      r.members[1],
    );
    act(r, { type: "reveal" });
    expect(result(r).scores[r.members[1].id]).toBe(10);
    finish(r);
  });
  it("anonymous stories hide author and support immediate report", () => {
    const r = fixture();
    start(r, "anonymous-story");
    act(r, {
      type: "submit",
      action: { type: "answer", value: "我曾經走錯教室" },
    });
    act(r, { type: "advance" });
    const view = project(r, r.members[1], NOW);
    expect(view.game!.public.story).toBe("我曾經走錯教室");
    expect(view.game!.public).not.toHaveProperty("author");
    act(r, { type: "submit", action: { type: "report" } }, r.members[1]);
    expect(project(r, r.members[1], NOW).game!.public.story).toBe("內容已隱藏");
    finish(r);
    expect(Object.keys(r.game!.raw).length).toBe(4);
  });
  it("drawing authorizes artist, broadcasts strokes and scores guesses", () => {
    const r = fixture();
    start(r, "draw-guess");
    expect(() =>
      act(
        r,
        {
          type: "submit",
          action: {
            type: "stroke",
            points: [
              [0.1, 0.1],
              [0.5, 0.5],
            ],
          },
        },
        r.members[1],
      ),
    ).toThrow("畫手");
    act(r, {
      type: "submit",
      action: {
        type: "stroke",
        points: [
          [0.1, 0.1],
          [0.5, 0.5],
        ],
      },
    });
    expect(project(r, r.members[1], NOW).game!.public.strokes).toHaveLength(1);
    expect(project(r, r.members[1], NOW).game!.private.word).toBeUndefined();
    act(
      r,
      {
        type: "submit",
        action: { type: "answer", value: r.game!.round.question.answer },
      },
      r.members[1],
    );
    finish(r);
    expect(r.game!.raw[r.members[1].id]).toBe(10);
  });
});
