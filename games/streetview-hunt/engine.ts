import type { GameModule } from "../types";
import { makeRound, once, weight, emptyPrivate } from "../helpers";
export const streetviewHunt: GameModule = {
  id: "streetview-hunt",
  ability: "reaction",
  createRound(ctx, q) {
    return makeRound(ctx, q, "answer", Math.max(60, ctx.game.settings.seconds));
  },
  submit: once,
  resolve(ctx) {
    const base = weight(ctx.round.question);
    const valid = Object.entries(ctx.round.submissions)
      .filter(([id]) => ctx.round.judgments[id])
      .sort((a, b) => a[1].at - b[1].at);
    return {
      scores: Object.fromEntries(
        valid.map(([id], i) => [id, i === 0 ? base : base * 0.7]),
      ),
      max: base,
      summary: { verified: valid.map(([id]) => id) },
    };
  },
  publicData(ctx) {
    return {
      startLocation: ctx.round.question.metadata.start_location,
      mission: ctx.round.question.question,
      searchHint: ctx.round.question.metadata.search_hint,
      range: ctx.round.question.metadata.suggested_range,
    };
  },
  privateData: emptyPrivate,
};
