import type { GameModule, GameContext } from "../types";
import { makeRound, text, once, fail, emptyPrivate, weight } from "../helpers";
import {
  canonical,
  roundPoints,
  syncFactor,
  uniqueFactor,
} from "../../lib/scoring";
function allowed(ctx: GameContext, value: string) {
  const list = ctx.round.question.metadata.validAnswers as string[] | undefined;
  const aliases = (ctx.round.question.metadata.aliases ?? {}) as Record<
    string,
    string
  >;
  return (
    !list ||
    list.some(
      (v) => canonical(v, [], aliases) === canonical(value, [], aliases),
    )
  );
}
function eliminate(ctx: GameContext, id: string) {
  const alive = ctx.round.data.alive as string[];
  const index = alive.indexOf(id);
  if (index < 0) return;
  alive.splice(index, 1);
  (ctx.round.data.eliminated as string[]).push(id);
  ctx.round.data.turn = alive[index % alive.length];
  ctx.round.endsAt = ctx.now + 10000;
}
export const sameAnswer: GameModule = {
  id: "same-answer",
  ability: "team",
  createRound(ctx, q) {
    const r = makeRound(ctx, q);
    if (ctx.game.settings.mode === "bomb") {
      r.data = {
        alive: [...ctx.game.roster],
        eliminated: [],
        used: [],
        turn: ctx.game.roster[0],
      };
      r.endsAt = ctx.now + 10000;
    }
    return r;
  },
  submit(ctx, m, a) {
    const mode = ctx.game.settings.mode;
    const value = text(a);
    if (mode === "bomb") {
      if (ctx.round.data.turn !== m.id) fail("還沒輪到你");
      const used = ctx.round.data.used as string[];
      const alias = (ctx.round.question.metadata.aliases ?? {}) as Record<
        string,
        string
      >;
      const key = canonical(value, [], alias);
      if (!allowed(ctx, value) || used.includes(key)) eliminate(ctx, m.id);
      else {
        used.push(key);
        const alive = ctx.round.data.alive as string[];
        ctx.round.data.turn = alive[(alive.indexOf(m.id) + 1) % alive.length];
        ctx.round.endsAt = ctx.now + 10000;
      }
      ctx.round.submissions[m.id] = {
        values: [value],
        at: ctx.now,
        valid: true,
      };
      if ((ctx.round.data.alive as string[]).length === 1)
        ctx.game.status = "revealing";
      return;
    }
    if (mode === "burst") {
      const s = ctx.round.submissions[m.id] ?? {
        values: [],
        at: ctx.now,
        valid: true,
      };
      if (s.values.length >= 10) fail("已收集 10 個答案");
      if (!allowed(ctx, value)) fail("不在本題常見答案清單，換一個試試！");
      if (
        s.values.some(
          (v) =>
            canonical(
              v,
              [],
              (ctx.round.question.metadata.aliases ?? {}) as Record<
                string,
                string
              >,
            ) ===
            canonical(
              value,
              [],
              (ctx.round.question.metadata.aliases ?? {}) as Record<
                string,
                string
              >,
            ),
        )
      )
        fail("這個答案你已經寫過了");
      s.values.push(value);
      ctx.round.submissions[m.id] = s;
      return;
    }
    once(ctx, m, a);
  },
  advance(ctx) {
    if (
      ctx.game.settings.mode === "bomb" &&
      (ctx.round.data.alive as string[]).length > 1
    ) {
      eliminate(ctx, String(ctx.round.data.turn));
      return (ctx.round.data.alive as string[]).length > 1;
    }
    return false;
  },
  resolve(ctx) {
    const mode = ctx.game.settings.mode;
    const scores: Record<string, number> = {};
    const base = weight(ctx.round.question);
    const valid = Object.entries(ctx.round.submissions).filter(
      ([id, s]) => s.valid && ctx.round.judgments[id] !== false,
    );
    const aliases = (ctx.round.question.metadata.aliases ?? {}) as Record<
      string,
      string
    >;
    if (mode === "bomb") {
      const ranking = [
        ...(ctx.round.data.alive as string[]),
        ...(ctx.round.data.eliminated as string[]).slice().reverse(),
      ];
      ranking.forEach(
        (id, i) =>
          (scores[id] = roundPoints(
            (base * (ranking.length - i - 1)) / Math.max(1, ranking.length - 1),
          )),
      );
      return { scores, max: base, summary: { ranking } };
    }
    const groups: Record<string, string[]> = Object.create(null);
    for (const [id, s] of valid)
      for (const value of s.values) {
        const key = canonical(value, ctx.round.merges, aliases);
        if (!(groups[key] ??= []).includes(id)) groups[key].push(id);
      }
    for (const [id, s] of valid) {
      if (mode === "burst") {
        scores[id] = roundPoints(
          s.values.length +
            Math.min(
              5,
              s.values.filter(
                (v) =>
                  groups[canonical(v, ctx.round.merges, aliases)].length === 1,
              ).length * 0.5,
            ),
        );
      } else {
        const k =
          groups[canonical(s.values[0], ctx.round.merges, aliases)].length;
        scores[id] = roundPoints(
          base *
            (mode === "unique" ? uniqueFactor(k) : syncFactor(k, valid.length)),
        );
      }
    }
    return { scores, max: mode === "burst" ? 15 : base, summary: { groups } };
  },
  publicData(ctx) {
    return ctx.game.settings.mode === "bomb"
      ? { ...ctx.round.data, phase: ctx.round.phase }
      : { phase: ctx.round.phase };
  },
  privateData: emptyPrivate,
};
