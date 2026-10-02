import { randomUUID } from "node:crypto";
import { accepted } from "../lib/scoring";
import type { GameContext, Question, Round, Member, GameAction } from "./types";
export const fail = (message: string): never => {
  throw new Error(message);
};
export const makeRound = (
  ctx: Omit<GameContext, "round">,
  question: Question,
  phase = "answer",
  seconds = ctx.game.settings.seconds,
): Round => ({
  id: randomUUID(),
  number: ctx.game.rounds.length + 1,
  question,
  phase,
  startedAt: ctx.now,
  endsAt: ctx.now + seconds * 1000,
  submissions: {},
  data: {},
  judgments: {},
  merges: [],
  resolved: false,
});
export function text(action: GameAction) {
  const value = (action.value ?? "").trim();
  if (!value || value.length > 300) fail("請輸入 1–300 字的有效答案");
  return value;
}
export function once(ctx: GameContext, member: Member, action: GameAction) {
  if (ctx.round.submissions[member.id]) fail("這回合已經送出答案");
  ctx.round.submissions[member.id] = {
    values: action.values?.slice(0, 10).map((s) => s.slice(0, 300)) ?? [
      text(action),
    ],
    at: ctx.now,
    valid: true,
  };
}
export const weight = (q: Question) => q.base_score * q.difficulty_weight;
export const isCorrect = (ctx: GameContext, id: string, value: string) =>
  ctx.round.judgments[id] ??
  accepted(
    value,
    ctx.round.question.answer,
    ctx.round.question.accepted_aliases,
  );
export const emptyPrivate = () => ({});
export function standardPublic(ctx: GameContext) {
  return { phase: ctx.round.phase };
}
