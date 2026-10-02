import type { GameModule } from "../types";
import { makeRound, fail, text, weight } from "../helpers";
export const commander: GameModule = {
  id: "commander",
  ability: "deduction",
  createRound(ctx, q) {
    const r = makeRound(ctx, q, "arrange", 90);
    r.data = {
      commander:
        ctx.game.roster[ctx.game.rounds.length % ctx.game.roster.length],
      order: [...ctx.game.roster],
    };
    return r;
  },
  submit(ctx, m, a) {
    if (ctx.round.phase === "arrange") {
      if (ctx.round.data.commander !== m.id) fail("只有指揮官可以排列");
      const ids = a.values ?? [];
      if (
        ids.length !== ctx.game.roster.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !ctx.game.roster.includes(id))
      )
        fail("排列必須包含所有玩家");
      ctx.round.data.order = ids;
      ctx.round.phase = "guess";
      ctx.round.endsAt = ctx.now + 30000;
      return;
    }
    if (m.id === ctx.round.data.commander) fail("指揮官不能猜自己的規則");
    const sameTeam = ctx.game.settings.team
      ? Object.entries(ctx.round.submissions)
          .filter(
            ([id]) => ctx.game.teamSnapshot[id] === ctx.game.teamSnapshot[m.id],
          )
          .reduce((n, [, s]) => n + s.values.length, 0)
      : (ctx.round.submissions[m.id]?.values.length ?? 0);
    if (sameTeam >= 2) fail("每人／每隊最多猜兩次");
    const s = ctx.round.submissions[m.id] ?? {
      values: [],
      at: ctx.now,
      valid: true,
    };
    s.values.push(text(a));
    ctx.round.submissions[m.id] = s;
  },
  advance(ctx) {
    if (ctx.round.phase === "arrange") {
      ctx.round.phase = "guess";
      ctx.round.endsAt = ctx.now + 30000;
      return true;
    }
    return false;
  },
  resolve(ctx) {
    const scores: Record<string, number> = {};
    const base = weight(ctx.round.question);
    for (const id of ctx.game.roster)
      if (id !== ctx.round.data.commander)
        scores[id] = ctx.round.judgments[id] ? base : 0;
    scores[String(ctx.round.data.commander)] = Object.values(scores).some(
      (v) => v > 0,
    )
      ? base
      : 0;
    return {
      scores,
      max: base,
      summary: { rule: ctx.round.question.answer, order: ctx.round.data.order },
    };
  },
  publicData(ctx) {
    return {
      phase: ctx.round.phase,
      commander: ctx.round.data.commander,
      order: ctx.round.phase === "arrange" ? [] : ctx.round.data.order,
    };
  },
  privateData(ctx, m) {
    return ctx.round.data.commander === m.id
      ? { rule: ctx.round.question.answer, order: ctx.round.data.order }
      : {};
  },
};
