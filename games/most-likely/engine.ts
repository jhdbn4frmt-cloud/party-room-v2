import type { GameModule } from "../types";
import {
  makeRound,
  once,
  fail,
  emptyPrivate,
  standardPublic,
} from "../helpers";
export const mostLikely: GameModule = {
  id: "most-likely",
  ability: "team",
  createRound: makeRound,
  submit(ctx, m, a) {
    if (!ctx.game.roster.includes(a.value ?? "")) fail("請選房內玩家");
    once(ctx, m, a);
  },
  resolve(ctx) {
    const votes: Record<string, number> = {};
    Object.values(ctx.round.submissions).forEach(
      (s) => (votes[s.values[0]] = (votes[s.values[0]] ?? 0) + 1),
    );
    return {
      scores: ctx.game.settings.competitive ? votes : {},
      max: ctx.game.roster.length,
      summary: {
        votes,
        total: Object.values(votes).reduce((a, b) => a + b, 0),
      },
      unscored: !ctx.game.settings.competitive,
    };
  },
  publicData: standardPublic,
  privateData: emptyPrivate,
};
