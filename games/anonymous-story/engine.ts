import type { GameModule, Submission } from "../types";
import { makeRound, once, fail, weight, emptyPrivate } from "../helpers";
export const anonymousStory: GameModule = {
  id: "anonymous-story",
  ability: "deduction",
  createRound(ctx, q) {
    return makeRound(ctx, q, "writing");
  },
  submit(ctx, m, a) {
    if (a.type === "report") {
      ctx.round.data.hidden = true;
      return;
    }
    if (ctx.round.phase === "guess" && !ctx.game.roster.includes(a.value ?? ""))
      fail("請選房內玩家");
    once(ctx, m, a);
  },
  advance(ctx) {
    if (ctx.round.phase !== "writing") return false;
    const stories = Object.entries(ctx.round.submissions).filter(
      ([id]) => ctx.round.judgments[id] !== false,
    );
    ctx.round.data.stories = ctx.round.submissions;
    ctx.round.submissions = {};
    const selected =
      stories[ctx.game.rounds.length % Math.max(1, stories.length)];
    ctx.round.data.author = selected?.[0] ?? null;
    ctx.round.data.story = selected?.[1].values[0] ?? "這回合沒有可公開的故事";
    ctx.round.phase = "guess";
    ctx.round.endsAt = ctx.now + 30000;
    return true;
  },
  resolve(ctx) {
    const base = weight(ctx.round.question);
    const scores: Record<string, number> = {};
    if (!ctx.round.data.hidden)
      for (const [id, s] of Object.entries(ctx.round.submissions))
        scores[id] =
          id !== ctx.round.data.author && s.values[0] === ctx.round.data.author
            ? base
            : 0;
    return {
      scores,
      max: base,
      summary: {
        author: ctx.round.data.hidden ? null : ctx.round.data.author,
        story: ctx.round.data.hidden ? "內容已隱藏" : ctx.round.data.story,
      },
    };
  },
  publicData(ctx) {
    return {
      phase: ctx.round.phase,
      hidden: ctx.round.data.hidden,
      story: ctx.round.data.hidden ? "內容已隱藏" : ctx.round.data.story,
    };
  },
  privateData(ctx, m) {
    return ctx.round.phase === "guess"
      ? { isAuthor: ctx.round.data.author === m.id }
      : {
          ...emptyPrivate(),
          submittedStory: !!(
            ctx.round.data.stories as Record<string, Submission> | undefined
          )?.[m.id],
        };
  },
};
