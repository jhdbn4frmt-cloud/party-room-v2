import type { GameModule } from "../types";
import { makeRound, once, fail, weight, emptyPrivate } from "../helpers";
import { accepted } from "../../lib/scoring";
export const guessMusic: GameModule = {
  id: "guess-music",
  ability: "music",
  createRound(ctx, q) {
    const r = makeRound(ctx, q);
    r.data.buzz = [];
    return r;
  },
  submit(ctx, m, a) {
    const buzz = ctx.round.data.buzz as string[];
    if (a.type === "buzz") {
      if (buzz.includes(m.id)) fail("已在搶答名單");
      buzz.push(m.id);
      return;
    }
    if (ctx.game.settings.mode !== "mashup" && !buzz.includes(m.id))
      fail("請先搶答");
    once(ctx, m, a);
  },
  resolve(ctx) {
    const scores: Record<string, number> = {};
    const base = weight(ctx.round.question);
    const answers = ctx.round.question.answer.split("|");
    if (ctx.game.settings.mode === "mashup") {
      for (const [id, s] of Object.entries(ctx.round.submissions)) {
        const count = answers.filter((a) =>
          s.values.some((v) => accepted(v, a)),
        ).length;
        scores[id] =
          ctx.round.judgments[id] === false
            ? 0
            : base * count + (count === answers.length ? 5 : 0);
      }
      return {
        scores,
        max: base * answers.length + 5,
        summary: { answer: answers, buzz: ctx.round.data.buzz },
      };
    }
    const winner = (ctx.round.data.buzz as string[]).find((id) => {
      const s = ctx.round.submissions[id];
      return (
        s &&
        (ctx.round.judgments[id] ??
          accepted(
            s.values[0],
            ctx.round.question.answer,
            ctx.round.question.accepted_aliases,
          ))
      );
    });
    if (winner) scores[winner] = base;
    return {
      scores,
      max: base,
      summary: { answer: answers, winner, buzz: ctx.round.data.buzz },
    };
  },
  publicData(ctx) {
    return {
      buzz: ctx.round.data.buzz,
      songCount: ctx.game.settings.mode === "mashup" ? 3 : 1,
    };
  },
  privateData: emptyPrivate,
};
