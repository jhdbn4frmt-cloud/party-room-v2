import type { GameModule } from "../types";
import { makeRound, once, weight } from "../helpers";
import { canonical } from "../../lib/scoring";
export const friendSync: GameModule = {
  id: "friend-sync",
  ability: "team",
  createRound(ctx, q) {
    const r = makeRound(ctx, q);
    r.data.target =
      ctx.game.roster[ctx.game.rounds.length % ctx.game.roster.length];
    return r;
  },
  submit: once,
  resolve(ctx) {
    const target = String(ctx.round.data.target);
    const answer = ctx.round.submissions[target]?.values[0];
    const base = weight(ctx.round.question);
    const scores: Record<string, number> = {};
    for (const [id, s] of Object.entries(ctx.round.submissions))
      if (id !== target)
        scores[id] =
          (ctx.round.judgments[id] ??
          (answer !== undefined &&
            canonical(s.values[0], ctx.round.merges) ===
              canonical(answer, ctx.round.merges)))
            ? base
            : 0;
    scores[target] = answer ? base : 0;
    return { scores, max: base, summary: { answer, target } };
  },
  publicData(ctx) {
    return {
      target: ctx.round.data.target,
      targetAnswered: !!ctx.round.submissions[String(ctx.round.data.target)],
    };
  },
  privateData(ctx, m) {
    return { isTarget: ctx.round.data.target === m.id };
  },
};
