import type { Room, Member } from "../../games/types";
import { modules } from "../../games/registry";
import { scores } from "./engine";
export function project(
  room: Room,
  viewer: Member | null,
  now = Date.now(),
  display = false,
) {
  const isHost = !display && viewer?.id === room.hostId;
  const g = room.game;
  const r = g?.round;
  const totals = scores(room);
  const reveal =
    g && ["revealing", "round_result", "game_result"].includes(g.status);
  let game = null;
  if (g && r) {
    const ctx = { room, game: g, round: r, now };
    const q = r.question;
    const summary = reveal
      ? (r.data.result ?? modules[g.gameId].resolve(ctx))
      : null;
    const submissions =
      reveal &&
      !["anonymous-story", "most-likely", "werewolf"].includes(g.gameId)
        ? Object.fromEntries(
            Object.entries(r.submissions).map(([id, s]) => [
              id,
              { values: s.values, valid: r.judgments[id] ?? s.valid },
            ]),
          )
        : {};
    game = {
      id: g.id,
      gameId: g.gameId,
      settings: g.settings,
      status: g.status,
      roster: g.roster,
      raw: g.raw,
      max: g.max,
      finishedAt: g.finishedAt,
      round: {
        id: r.id,
        number: r.number,
        phase: r.phase,
        startedAt: r.startedAt,
        endsAt: r.endsAt,
        remainingMs: r.remainingMs,
        question: {
          id: q.question_id,
          text: q.question,
          mode: q.mode,
          options: q.possible_answers,
          media: q.media,
          category: q.category,
        },
        answered: Object.keys(r.submissions),
        submissions,
        judgments: reveal ? r.judgments : {},
        merges: r.merges,
        resolved: r.resolved,
      },
      public: modules[g.gameId].publicData(ctx),
      private:
        viewer && !display ? modules[g.gameId].privateData(ctx, viewer) : {},
      mine: viewer && !display ? (r.submissions[viewer.id] ?? null) : null,
      result: summary,
      host: isHost
        ? {
            music:
              g.gameId === "guess-music"
                ? { answer: q.answer, ...q.metadata }
                : null,
            roles: g.gameId === "werewolf" ? g.data.roles : null,
            potions: g.gameId === "werewolf" ? g.data.potions : null,
            stories:
              g.gameId === "anonymous-story" && r.phase === "writing"
                ? Object.entries(r.submissions).map(([id, s]) => ({
                    id,
                    text: s.values[0],
                    valid: r.judgments[id] !== false,
                  }))
                : null,
          }
        : null,
    };
  }
  return {
    id: room.id,
    code: room.code,
    revision: room.revision,
    serverNow: now,
    status: room.status,
    allowJoin: room.allowJoin,
    hostId: room.hostId,
    me: display ? null : (viewer?.id ?? null),
    isHost,
    members: room.members
      .filter((m) => !m.removed)
      .map((m) => ({
        id: m.id,
        name: m.name,
        emoji: m.emoji,
        ready: m.ready,
        online: now - m.lastSeen < 20000,
        teamId: m.teamId,
        locked: m.locked,
        waiting: m.waiting,
        score: totals[m.id] ?? 0,
      })),
    teams: room.teams.map((t) => ({ ...t, score: totals[t.id] ?? 0 })),
    playlist: room.playlist,
    game,
    history: room.history.map((g) => ({
      id: g.id,
      gameId: g.gameId,
      rounds: g.rounds.length,
      raw: g.raw,
      finishedAt: g.finishedAt,
    })),
    ledger: room.ledger
      .filter((e) => e.layer === "party")
      .map((e) => ({ ...e })),
    events: room.events.slice(-15),
    election: room.election
      ? {
          ...room.election,
          votes: undefined,
          voted: viewer ? !!room.election.votes[viewer.id] : false,
        }
      : null,
    stats: {
      games: room.history.length + (g?.status === "game_result" ? 1 : 0),
      rounds:
        room.history.reduce((sum, g) => sum + g.rounds.length, 0) +
        (g?.rounds.length ?? 0),
      players: room.members.filter((m) => !m.removed).length,
    },
    storage:
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "supabase"
        : "local",
  };
}
export type RoomView = ReturnType<typeof project>;
export type GameView = NonNullable<RoomView["game"]>;
