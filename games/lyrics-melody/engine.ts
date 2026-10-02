import type { GameModule } from "../types";
import { makeRound, once, weight, emptyPrivate } from "../helpers";
export const lyricsMelody: GameModule = {
  id: "lyrics-melody",
  ability: "creativity",
  createRound: makeRound,
  submit(ctx, m) {
    once(ctx, m, { type: "answer", value: "已完成現場演唱" });
  },
  resolve(ctx) {
    const base = weight(ctx.round.question);
    return {
      scores: Object.fromEntries(
        ctx.game.roster.map((id) => [id, ctx.round.judgments[id] ? base : 0]),
      ),
      max: base,
      summary: { performed: Object.keys(ctx.round.submissions) },
    };
  },
  publicData(ctx) {
    return {
      lyricsSong: ctx.round.question.metadata.lyricsSong,
      melodySong: ctx.round.question.metadata.melodySong,
    };
  },
  privateData: emptyPrivate,
};
