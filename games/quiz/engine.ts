import type { GameModule } from "../types";
import {
  makeRound,
  once,
  weight,
  isCorrect,
  emptyPrivate,
  standardPublic,
  fail,
} from "../helpers";
import { clamp, roundPoints } from "../../lib/scoring";
export const quiz: GameModule = {
  id: "quiz",
  ability: "knowledge",
  createRound: makeRound,
  submit(ctx, m, a) {
    if (
      ctx.round.question.mode === "number" &&
      !Number.isFinite(Number(a.value))
    )
      fail("請輸入有效數字");
    if (
      ctx.round.question.mode === "order" &&
      (a.values?.length !== ctx.round.question.possible_answers.length ||
        new Set(a.values).size !== a.values.length ||
        a.values.some((v) => !ctx.round.question.possible_answers.includes(v)))
    )
      fail("排序選項不完整");
    once(ctx, m, a);
  },
  resolve(ctx) {
    const scores: Record<string, number> = {};
    const q = ctx.round.question;
    const base = weight(q);
    for (const [id, s] of Object.entries(ctx.round.submissions)) {
      let factor = 0;
      if (ctx.round.judgments[id] !== undefined)
        factor = ctx.round.judgments[id] ? 1 : 0;
      else if (q.mode === "number") {
        factor = clamp(
          1 -
            Math.abs(Number(s.values[0]) - Number(q.answer)) /
              Math.max(1, Number(q.metadata.tolerance ?? 1) * 5),
        );
      } else
        factor = isCorrect(
          ctx,
          id,
          s.values.join(q.mode === "order" ? "|" : ""),
        )
          ? 1
          : 0;
      scores[id] = roundPoints(base * factor);
    }
    return {
      scores,
      max: base,
      summary: { answer: q.answer, explanation: q.explanation },
    };
  },
  publicData: standardPublic,
  privateData: emptyPrivate,
};
