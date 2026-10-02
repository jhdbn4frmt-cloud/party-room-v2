import type { GameModule } from "../types";
import { makeRound, fail, text, isCorrect, weight } from "../helpers";
export const drawGuess: GameModule = {
  id: "draw-guess",
  ability: "creativity",
  createRound(ctx, q) {
    const r = makeRound(ctx, q);
    r.data = {
      artist: ctx.game.roster[ctx.game.rounds.length % ctx.game.roster.length],
      strokes: [],
    };
    return r;
  },
  submit(ctx, m, a) {
    if (a.type === "stroke" || a.type === "clear") {
      if (ctx.round.data.artist !== m.id) fail("只有畫手可以畫畫");
      if (a.type === "clear") {
        ctx.round.data.strokes = [];
        return;
      }
      const strokes = ctx.round.data.strokes as unknown[];
      if (strokes.length >= 500) fail("畫布筆畫已滿，請清除後重畫");
      if (
        !a.points?.length ||
        a.points.length > 300 ||
        a.points.some(
          (p) =>
            p.length !== 2 ||
            p.some((v) => !Number.isFinite(v) || v < 0 || v > 1),
        )
      )
        fail("筆畫座標無效");
      strokes.push({
        points: a.points,
        tool: a.tool === "eraser" ? "eraser" : "pen",
      });
      return;
    }
    if (ctx.round.data.artist === m.id) fail("畫手不能猜自己的題目");
    const value = text(a);
    const s = ctx.round.submissions[m.id] ?? {
      values: [],
      at: ctx.now,
      valid: true,
    };
    if (s.values.length >= 10) fail("每題最多猜 10 次");
    s.values.push(value);
    ctx.round.submissions[m.id] = s;
  },
  resolve(ctx) {
    const base = weight(ctx.round.question);
    const scores: Record<string, number> = {};
    for (const [id, s] of Object.entries(ctx.round.submissions))
      scores[id] = s.values.some((v) => isCorrect(ctx, id, v)) ? base : 0;
    scores[String(ctx.round.data.artist)] = Object.values(scores).some(
      (v) => v > 0,
    )
      ? base
      : 0;
    return {
      scores,
      max: base,
      summary: { answer: ctx.round.question.answer },
    };
  },
  publicData(ctx) {
    return { artist: ctx.round.data.artist, strokes: ctx.round.data.strokes };
  },
  privateData(ctx, m) {
    return ctx.round.data.artist === m.id
      ? { word: ctx.round.question.answer }
      : {};
  },
};
