import { randomInt } from "node:crypto";
import type { GameModule } from "../types";
import { makeRound, fail, once } from "../helpers";
import { roles, phaseOrder } from "./roles";
export const werewolf: GameModule = {
  id: "werewolf",
  ability: "deduction",
  createRound(ctx, q) {
    const r = makeRound(ctx, q, "night", 120);
    if (!ctx.game.data.roles) {
      const n = ctx.game.roster.length;
      const chosen =
        ctx.game.settings.roles?.length === n
          ? [...ctx.game.settings.roles]
          : [
              ...Array(Math.max(1, Math.floor(n / 4))).fill("wolf"),
              "seer",
              ...(n >= 7 ? ["witch"] : []),
              ...(n >= 9 ? ["hunter"] : []),
            ];
      while (chosen.length < n) chosen.push("villager");
      for (let i = chosen.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
      }
      ctx.game.data.roles = Object.fromEntries(
        ctx.game.roster.map((id, i) => [id, chosen[i]]),
      );
      ctx.game.data.alive = [...ctx.game.roster];
      ctx.game.data.log = [];
      ctx.game.data.potions = { heal: true, poison: true };
    }
    return r;
  },
  submit(ctx, m, a) {
    if (ctx.round.phase !== "vote") fail("現在不是投票階段");
    const alive = ctx.game.data.alive as string[];
    if (!alive.includes(m.id) || !alive.includes(a.value ?? ""))
      fail("只有存活玩家能投給存活玩家");
    once(ctx, m, a);
  },
  advance(ctx) {
    const index = phaseOrder.indexOf(
      ctx.round.phase as (typeof phaseOrder)[number],
    );
    if (index < 2) {
      ctx.round.phase = phaseOrder[index + 1];
      ctx.round.endsAt = ctx.now + 90000;
      return true;
    }
    return false;
  },
  resolve(ctx) {
    const votes: Record<string, number> = {};
    Object.values(ctx.round.submissions).forEach(
      (s) => (votes[s.values[0]] = (votes[s.values[0]] ?? 0) + 1),
    );
    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    const eliminated =
      sorted.length && sorted[0][1] > (sorted[1]?.[1] ?? 0)
        ? sorted[0][0]
        : null;
    return {
      scores: {},
      max: 0,
      unscored: true,
      summary: {
        votes,
        eliminated,
        tied: sorted.length > 1 && sorted[0][1] === sorted[1][1],
      },
    };
  },
  publicData(ctx) {
    return {
      phase: ctx.round.phase,
      alive: ctx.game.data.alive,
      log: ctx.game.data.log,
      winner: ctx.game.data.winner,
    };
  },
  privateData(ctx, m) {
    const assignment = ctx.game.data.roles as Record<string, string>;
    const role = roles.find((r) => r.id === assignment[m.id]);
    return {
      role,
      allies:
        role?.id === "wolf"
          ? Object.entries(assignment)
              .filter(([, r]) => r === "wolf")
              .map(([id]) => id)
          : [],
      inspection: (
        ctx.game.data.inspections as Record<string, unknown> | undefined
      )?.[m.id],
    };
  },
};
