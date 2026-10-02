import type { GameModule } from "../types";
import { makeRound, fail, once, weight } from "../helpers";
import { accepted } from "../../lib/scoring";
export type IntelQuestion = {
  question: string;
  answer: string;
  options: string[];
  type: string;
};
export const intelStation: GameModule = {
  id: "intel-station",
  ability: "memory",
  createRound(ctx, q) {
    const r = makeRound(ctx, q, "reading", 30);
    const agents: Record<string, string> = {};
    for (const team of ctx.room.teams) {
      const members = ctx.game.roster.filter(
        (id) => ctx.game.teamSnapshot[id] === team.id,
      );
      if (members.length)
        agents[team.id] = members[ctx.game.rounds.length % members.length];
    }
    r.data = { agents };
    return r;
  },
  submit(ctx, m, a) {
    if (ctx.round.phase !== "answer") fail("還沒到答題階段");
    if (
      Object.values(ctx.round.data.agents as Record<string, string>).includes(
        m.id,
      )
    )
      fail("情報員請交給隊友回答");
    if (a.values?.length !== 3) fail("請回答三題");
    once(ctx, m, a);
  },
  advance(ctx) {
    if (ctx.round.phase === "reading") {
      ctx.round.phase = "describe";
      ctx.round.endsAt = ctx.now + 45000;
      return true;
    }
    if (ctx.round.phase === "describe") {
      ctx.round.phase = "answer";
      ctx.round.endsAt = ctx.now + ctx.game.settings.seconds * 1000;
      return true;
    }
    return false;
  },
  resolve(ctx) {
    const scores: Record<string, number> = {};
    const qs = ctx.round.question.metadata.questions as IntelQuestion[];
    const base = weight(ctx.round.question);
    for (const id of ctx.game.roster) {
      const s = ctx.round.submissions[id];
      if (!s) continue;
      scores[id] = qs.reduce(
        (total, q, i) =>
          total +
          ((ctx.round.judgments[`${id}:${i}`] ??
          accepted(s.values[i] ?? "", q.answer))
            ? base
            : 0),
        0,
      );
    }
    return { scores, max: base * 3, summary: { questions: qs } };
  },
  publicData(ctx) {
    return {
      phase: ctx.round.phase,
      agents: ctx.round.data.agents,
      questions:
        ctx.round.phase === "answer"
          ? (ctx.round.question.metadata.questions as IntelQuestion[]).map(
              ({ question, options, type }) => ({ question, options, type }),
            )
          : [],
    };
  },
  privateData(ctx, m) {
    return ctx.round.phase === "reading" &&
      ctx.now < ctx.round.endsAt &&
      Object.values(ctx.round.data.agents as Record<string, string>).includes(
        m.id,
      )
      ? { passage: ctx.round.question.metadata.passage }
      : {};
  },
};
