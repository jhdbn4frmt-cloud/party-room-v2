import { randomInt, randomUUID } from "node:crypto";
import type {
  Room,
  Member,
  Game,
  GameId,
  GameSettings,
  GameAction,
  Question,
  ScoreEvent,
} from "../../games/types";
import { getCard, defaultSettings } from "../../games/catalog";
import { modules } from "../../games/registry";
import { normalize, partyPoints, roundPoints, clamp } from "../../lib/scoring";
import { selectQuestions } from "../question-bank/select";
import { seedQuestions } from "../question-bank/seed";
import { assignTeams } from "../teams/balance";
import { hashToken } from "../../lib/sessions";
import { roles } from "../../games/werewolf/roles";
const emojis = [
  "🐸",
  "🦊",
  "🐼",
  "🐰",
  "🐯",
  "🐨",
  "🦁",
  "🐻",
  "🐵",
  "🐧",
  "🦄",
  "🐙",
  "🦋",
  "🐝",
  "🐳",
  "🐢",
];
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function log(room: Room, text: string, now: number) {
  room.events.push({ id: randomUUID(), text, at: now });
  room.events = room.events.slice(-60);
}
export function joinRoom(
  room: Room,
  name: string,
  token: string,
  now = Date.now(),
): Member {
  assert(room.status !== "ended" && room.expiresAt > now, "這個房間已結束");
  assert(room.allowJoin, "主持人已關閉加入");
  const normalized = normalize(name);
  assert(
    normalized.length >= 1 && normalized.length <= 20,
    "暱稱請使用 1–20 個字",
  );
  assert(
    !room.members.some((m) => !m.removed && m.normalized === normalized),
    "這個暱稱已有人使用",
  );
  assert(
    room.members.filter((m) => !m.removed).length < 16,
    "房間已滿（最多 16 位玩家）",
  );
  const member: Member = {
    id: randomUUID(),
    name: name.normalize("NFKC").trim(),
    normalized,
    emoji: emojis[room.members.length % emojis.length],
    joinedAt: now,
    lastSeen: now,
    ready: false,
    teamId: null,
    locked: false,
    waiting: room.status === "playing",
    removed: false,
    tokenHash: hashToken(token),
    abilities: {},
  };
  room.members.push(member);
  log(room, `${member.name} 加入了聚會`, now);
  return member;
}
export function createRoom(
  code: string,
  name: string,
  token: string,
  now = Date.now(),
): Room {
  assert(/^\d{4}$/.test(code), "房號必須是 4 位數字");
  const room: Room = {
    id: randomUUID(),
    code,
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
    revision: 0,
    hostId: "",
    status: "lobby",
    allowJoin: true,
    members: [],
    teams: [],
    playlist: [],
    game: null,
    history: [],
    ledger: [],
    usedQuestions: [],
    pairings: {},
    requests: [],
    election: null,
    events: [],
  };
  room.hostId = joinRoom(room, name, token, now).id;
  return room;
}
export function auth(room: Room, token?: string) {
  const member =
    token &&
    room.members.find((m) => !m.removed && m.tokenHash === hashToken(token));
  assert(member, "請重新加入房間");
  return member;
}
export function host(room: Room, m: Member) {
  assert(room.hostId === m.id, "只有主持人可以操作");
}
export function addScore(
  room: Room,
  event: Omit<ScoreEvent, "id" | "roomId" | "ruleVersion">,
) {
  room.ledger.push({
    ...event,
    id: randomUUID(),
    roomId: room.id,
    ruleVersion: "1.0",
  });
}
export function scores(room: Room) {
  const total: Record<string, number> = {};
  for (const e of room.ledger)
    if (e.layer === "party")
      total[e.target] = roundPoints((total[e.target] ?? 0) + e.delta);
  return total;
}
function context(room: Room, now: number) {
  assert(room.game, "遊戲尚未開始");
  return { room, game: room.game, round: room.game.round, now };
}
export function startGame(
  room: Room,
  m: Member,
  id: GameId,
  partial: Partial<GameSettings>,
  now = Date.now(),
  bank: Question[] = seedQuestions,
) {
  host(room, m);
  assert(room.status !== "ended", "聚會已結束");
  assert(
    !room.game || room.game.status === "game_result",
    "遊戲已經開始，請先結束目前遊戲",
  );
  const card = getCard(id);
  const settings: GameSettings = {
    ...defaultSettings,
    seconds: id === "quiz" ? 20 : 30,
    ...partial,
  };
  assert(
    card.modes.some((mode) => mode.id === settings.mode),
    "遊戲模式無效",
  );
  assert(
    Number.isInteger(settings.rounds) &&
      settings.rounds >= 1 &&
      settings.rounds <= 40,
    "題數需為 1–40",
  );
  assert(
    Number.isInteger(settings.seconds) &&
      settings.seconds >= 10 &&
      settings.seconds <= 300,
    "時間需為 10–300 秒",
  );
  assert(
    ["balanced", "raw", "independent"].includes(settings.scoring),
    "計分模式無效",
  );
  assert(
    settings.team ? card.supportsTeam : card.supportsIndividual,
    "此遊戲不支援選擇的賽制",
  );
  const members = room.members.filter((p) => !p.removed);
  assert(
    members.length >= card.minPlayers && members.length <= card.maxPlayers,
    `這款遊戲需要 ${card.minPlayers}–${card.maxPlayers} 人`,
  );
  if (settings.team) {
    assert(room.teams.length >= 2, "請先建立至少兩隊");
    assert(
      members.every(
        (p) => p.teamId && room.teams.some((t) => t.id === p.teamId),
      ),
      "請先完成所有玩家分隊",
    );
    if (id === "intel-station")
      assert(
        room.teams.filter((t) => members.some((p) => p.teamId === t.id))
          .length >= 2 &&
          room.teams.every(
            (t) => members.filter((p) => p.teamId === t.id).length >= 2,
          ),
        "星際情報站每隊至少需要兩人",
      );
  }
  if (id === "werewolf" && settings.roles) {
    assert(
      settings.roles.length === members.length &&
        settings.roles.every((r) => roles.some((role) => role.id === r)),
      "角色數量必須等於玩家人數",
    );
    assert(
      settings.roles.includes("wolf") &&
        settings.roles.some((r) => r !== "wolf"),
      "角色必須包含狼人與好人",
    );
  }
  if (room.game) room.history.push(room.game);
  if (
    room.playlist[0]?.gameId === id &&
    room.playlist[0]?.mode === settings.mode
  )
    room.playlist.shift();
  const questions = selectQuestions(
    bank,
    id,
    settings,
    room.usedQuestions,
    id === "werewolf" ? 20 : settings.rounds,
  );
  const game = {
    id: randomUUID(),
    gameId: id,
    settings,
    status: "collecting",
    roster: members.map((p) => p.id),
    teamSnapshot: Object.fromEntries(members.map((p) => [p.id, p.teamId])),
    rounds: [],
    raw: {},
    max: {},
    startedAt: now,
    data: { questions },
  } as unknown as Game;
  room.game = game;
  room.status = "playing";
  members.forEach((p) => {
    p.waiting = false;
    p.ready = false;
  });
  game.round = modules[id].createRound({ room, game, now }, questions[0]);
  room.usedQuestions.push(questions[0].question_id);
  for (const team of room.teams) {
    const ids = members.filter((p) => p.teamId === team.id).map((p) => p.id);
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const key = [ids[i], ids[j]].sort().join(":");
        room.pairings[key] = (room.pairings[key] ?? 0) + 1;
      }
  }
  log(room, `開始玩${card.name}`, now);
}
export function resolveRound(room: Room, operator: string, now: number) {
  const ctx = context(room, now);
  const g = ctx.game;
  const r = ctx.round;
  if (r.resolved) return;
  const result = modules[g.gameId].resolve(ctx);
  const targets = g.settings.team
    ? [
        ...new Set(
          Object.values(g.teamSnapshot).filter((id): id is string => !!id),
        ),
      ]
    : g.roster;
  if (!result.unscored)
    for (const target of targets) {
      const participants = g.settings.team
        ? g.roster.filter((id) => g.teamSnapshot[id] === target)
        : [target];
      const value = g.settings.team
        ? Math.max(0, ...participants.map((id) => result.scores[id] ?? 0))
        : (result.scores[target] ?? 0);
      g.raw[target] = roundPoints((g.raw[target] ?? 0) + value);
      g.max[target] = (g.max[target] ?? 0) + result.max;
      addScore(room, {
        gameSessionId: g.id,
        roundId: r.id,
        target,
        layer: "raw",
        delta: value,
        reason: `第 ${r.number} 回合`,
        operator,
        timestamp: now,
      });
    }
  for (const id of g.roster) {
    const member = room.members.find((m) => m.id === id);
    if (member && result.max > 0 && !result.unscored) {
      const key = modules[g.gameId].ability;
      (room.skillEvents ??= []).push({
        id: randomUUID(),
        memberId: id,
        gameId: g.id,
        roundId: r.id,
        ability: key,
        value: clamp((result.scores[id] ?? 0) / result.max),
      });
      member.abilities[key] = clamp(
        (member.abilities[key] ?? 0.5) * 0.7 +
          clamp((result.scores[id] ?? 0) / result.max) * 0.3,
      );
    }
  }
  if (g.gameId === "werewolf") {
    const summary = result.summary as { eliminated: string | null };
    if (summary.eliminated) eliminateWerewolf(room, summary.eliminated, now);
  }
  r.resolved = true;
  r.data.result = result;
  g.status = "round_result";
}
function finishGame(room: Room, operator: string, now: number) {
  const g = room.game!;
  if (g.status === "game_result") return;
  if (!g.round.resolved) resolveRound(room, operator, now);
  if (!g.rounds.some((r) => r.id === g.round.id)) g.rounds.push(g.round);
  if (g.settings.scoring !== "independent")
    for (const [target, raw] of Object.entries(g.raw))
      addScore(room, {
        gameSessionId: g.id,
        roundId: null,
        target,
        layer: "party",
        delta:
          g.settings.scoring === "raw" ? raw : partyPoints(raw, g.max[target]),
        reason: `${getCard(g.gameId).name}結算`,
        operator,
        timestamp: now,
      });
  g.status = "game_result";
  g.finishedAt = now;
  log(room, `${getCard(g.gameId).name}結算完成`, now);
}
export function tick(room: Room, now = Date.now()) {
  const g = room.game;
  if (g?.status === "collecting" && now >= g.round.endsAt) {
    if (!modules[g.gameId].advance?.(context(room, now)))
      g.status = "revealing";
  }
  const h = room.members.find((m) => m.id === room.hostId);
  if (h && now - h.lastSeen > 90000 && room.status !== "ended") {
    const online = room.members.filter(
      (m) => !m.removed && now - m.lastSeen < 20000,
    );
    if (online.length && !room.election)
      room.election = {
        round: 1,
        votes: {},
        candidates: online.map((m) => m.id),
        endsAt: now + 20000,
      };
    const e = room.election;
    if (e && now >= e.endsAt) {
      const eligible = e.candidates.filter((id) =>
        online.some((m) => m.id === id),
      );
      const count = Object.fromEntries(
        eligible.map((id) => [
          id,
          Object.entries(e.votes).filter(
            ([v, c]) => c === id && online.some((m) => m.id === v),
          ).length,
        ]),
      );
      const max = Math.max(0, ...Object.values(count));
      const winners = eligible.filter((id) => count[id] === max);
      if (winners.length === 1 || (winners.length > 1 && e.round === 2)) {
        room.hostId = winners[randomInt(winners.length)];
        room.election = null;
        log(room, "選出了新主持人", now);
      } else if (winners.length) {
        room.election = {
          round: 2,
          votes: {},
          candidates: winners,
          endsAt: now + 20000,
        };
      } else room.election = null;
    }
  } else if (h && now - h.lastSeen <= 90000) room.election = null;
}
function eliminateWerewolf(room: Room, target: string, now: number) {
  const g = room.game!;
  const alive = g.data.alive as string[];
  if (!alive.includes(target)) return;
  g.data.alive = alive.filter((id) => id !== target);
  (g.data.log as string[]).push(
    `${room.members.find((m) => m.id === target)?.name} 出局`,
  );
  const assignment = g.data.roles as Record<string, string>;
  const remaining = g.data.alive as string[];
  const wolves = remaining.filter((id) => assignment[id] === "wolf").length;
  if (!wolves) g.data.winner = "好人陣營";
  else if (wolves >= remaining.length - wolves) g.data.winner = "狼人陣營";
  log(room, "狼人殺更新存活名單", now);
}
export type Command = {
  type: string;
  roundId?: string;
  requestId: string;
  target?: string;
  teamId?: string | null;
  value?: string;
  values?: string[];
  gameId?: GameId;
  settings?: Partial<GameSettings>;
  count?: number;
  method?: string;
  delta?: number;
  valid?: boolean;
  action?: GameAction;
  playlist?: { gameId: GameId; mode: string }[];
  eventId?: string;
};
export function command(
  room: Room,
  m: Member,
  c: Command,
  now = Date.now(),
  bank: Question[] = seedQuestions,
) {
  assert(c.requestId && c.requestId.length <= 100, "缺少操作識別碼");
  const key = `${m.id}:${c.requestId}`;
  if (room.requests.includes(key)) return;
  tick(room, now);
  m.lastSeen = now;
  if (c.type === "heartbeat") {
    return;
  }
  if (c.type === "ready") {
    m.ready = !m.ready;
  } else if (c.type === "vote-host") {
    assert(
      room.election && room.election.candidates.includes(c.target ?? ""),
      "目前沒有有效的主持人選舉",
    );
    room.election.votes[m.id] = c.target!;
  } else if (c.type === "submit") {
    const ctx = context(room, now);
    assert(ctx.game.status === "collecting", "目前已停止作答");
    assert(c.roundId === ctx.round.id, "題目已更新，請重新作答");
    assert(ctx.game.roster.includes(m.id) && !m.waiting, "你將於下一局加入");
    assert(now < ctx.round.endsAt, "作答時間已結束");
    assert(c.action, "缺少作答內容");
    modules[ctx.game.gameId].submit(ctx, m, c.action);
  } else {
    host(room, m);
    if (c.type === "start") {
      assert(c.gameId, "請選擇遊戲");
      startGame(room, m, c.gameId, c.settings ?? {}, now, bank);
    } else if (c.type === "teams") {
      assert(
        room.status === "lobby" || room.game?.status === "game_result",
        "請在遊戲大廳調整隊伍",
      );
      assert(
        Number.isInteger(c.count) && c.count! >= 2 && c.count! <= 6,
        "隊數需為 2–6",
      );
      const names = [
        "今天不想上班隊",
        "等等誰買單隊",
        "被抓來玩的隊",
        "最後一名洗碗隊",
        "先吃再說隊",
        "今晚不睡隊",
      ];
      const colors = [
        "#7155e8",
        "#ef7158",
        "#3ba4ac",
        "#d8a92f",
        "#cc69a0",
        "#62a071",
      ];
      while (room.teams.length < c.count!) {
        const i = room.teams.length;
        room.teams.push({
          id: randomUUID(),
          name: names[i],
          emoji: ["🛸", "🍟", "🧋", "🧽", "🍕", "🌙"][i],
          color: colors[i],
        });
      }
      if (room.teams.length > c.count!) {
        const remove = room.teams.slice(c.count).map((t) => t.id);
        assert(
          !room.ledger.some((e) => remove.includes(e.target)),
          "已有歷史分數的隊伍不能刪除",
        );
        room.teams = room.teams.slice(0, c.count);
      }
      assignTeams(room, c.method === "smart");
    } else if (c.type === "move" || c.type === "lock") {
      assert(
        room.status === "lobby" || room.game?.status === "game_result",
        "請在遊戲大廳調整队伍",
      );
      const target = room.members.find((p) => p.id === c.target && !p.removed);
      assert(target, "找不到玩家");
      if (c.type === "lock") target.locked = !target.locked;
      else {
        assert(
          c.teamId === null || room.teams.some((t) => t.id === c.teamId),
          "找不到隊伍",
        );
        target.teamId = c.teamId ?? null;
      }
    } else if (c.type === "rename-team") {
      const t = room.teams.find((t) => t.id === c.target);
      assert(
        t && c.value?.trim() && c.value.length <= 24,
        "請輸入 1–24 字隊名",
      );
      t.name = c.value!.trim();
    } else if (c.type === "allow-join") room.allowJoin = !room.allowJoin;
    else if (c.type === "transfer") {
      assert(
        room.members.some(
          (p) => p.id === c.target && !p.removed && now - p.lastSeen < 20000,
        ),
        "請選在線玩家",
      );
      room.hostId = c.target!;
      room.election = null;
      log(room, "主持人已轉移", now);
    } else if (c.type === "remove") {
      assert(c.target !== room.hostId, "請先轉移主持人");
      const p = room.members.find((p) => p.id === c.target);
      assert(p, "找不到玩家");
      p.removed = true;
      log(room, `${p.name} 已離開房間`, now);
    } else if (c.type === "playlist") {
      assert(c.playlist && c.playlist.length <= 20, "最多排 20 款遊戲");
      for (const p of c.playlist) {
        const card = getCard(p.gameId);
        assert(
          card.modes.some((m) => m.id === p.mode),
          "播放清單模式無效",
        );
      }
      room.playlist = c.playlist;
    } else if (c.type === "adjust") {
      assert(
        (room.members.some((p) => p.id === c.target) ||
          room.teams.some((t) => t.id === c.target)) &&
          Number.isFinite(c.delta) &&
          Math.abs(c.delta!) <= 1000,
        "調分對象或分數無效",
      );
      addScore(room, {
        gameSessionId: room.game?.id ?? null,
        roundId: null,
        target: c.target!,
        layer: "party",
        delta: c.delta!,
        reason: c.value?.slice(0, 100) || "主持人調整",
        operator: m.id,
        timestamp: now,
      });
    } else if (c.type === "undo-score") {
      const e = room.ledger.find((e) => e.id === c.eventId);
      assert(
        e &&
          e.layer === "party" &&
          !e.inverseOf &&
          !room.ledger.some((x) => x.inverseOf === e.id),
        "這筆分數不能重複復原",
      );
      addScore(room, {
        gameSessionId: e.gameSessionId,
        roundId: e.roundId,
        target: e.target,
        layer: "party",
        delta: -e.delta,
        reason: `復原：${e.reason}`,
        operator: m.id,
        timestamp: now,
        inverseOf: e.id,
      });
    } else if (c.type === "end-party") {
      if (room.game && room.game.status !== "game_result")
        finishGame(room, m.id, now);
      room.status = "ended";
      room.allowJoin = false;
    } else if (c.type === "lobby") {
      assert(
        !room.game || room.game.status === "game_result",
        "請先結束這款遊戲",
      );
      if (room.game) room.history.push(room.game);
      room.game = null;
      room.status = "lobby";
      room.members.forEach((p) => (p.waiting = false));
    } else {
      const ctx = context(room, now);
      const g = ctx.game;
      const r = ctx.round;
      if (c.type === "pause") {
        assert(g.status === "collecting", "只有作答中可暫停");
        g.previousStatus = g.status;
        g.status = "paused";
        r.remainingMs = Math.max(0, r.endsAt - now);
      } else if (c.type === "resume") {
        assert(g.status === "paused", "遊戲沒有暫停");
        g.status = "collecting";
        r.endsAt = now + (r.remainingMs ?? 0);
      } else if (c.type === "advance") {
        assert(g.status === "collecting", "只有作答中可以推進階段");
        if (!modules[g.gameId].advance?.(ctx)) g.status = "revealing";
      } else if (c.type === "reveal") {
        assert(g.status === "collecting", "目前無法公布");
        assert(
          ![
            "reading",
            "describe",
            "arrange",
            "writing",
            "night",
            "day",
          ].includes(r.phase),
          "請先完成準備階段",
        );
        g.status = "revealing";
      } else if (c.type === "judge") {
        assert(!r.resolved && g.status !== "game_result", "這回合已計分");
        assert(
          c.target &&
            (g.roster.includes(c.target) ||
              g.roster.includes(c.target.split(":")[0])),
          "判定對象無效",
        );
        r.judgments[c.target] = !!c.valid;
      } else if (c.type === "merge") {
        assert(
          g.status === "revealing" &&
            ["same-answer", "friend-sync"].includes(g.gameId),
          "只有公布答案後可合併",
        );
        assert(
          c.values?.length === 2 &&
            normalize(c.values[0]) !== normalize(c.values[1]),
          "請輸入兩個不同答案",
        );
        const [a, b] = c.values.map(normalize);
        assert(
          !r.merges.some(([from, to]) => from === a || to === a || from === b),
          "請避免循環合併；可先復原",
        );
        r.merges.push([a, b]);
      } else if (c.type === "undo-merge") {
        assert(g.status === "revealing", "已計分無法復原合併");
        r.merges.pop();
      } else if (c.type === "score") {
        assert(g.status === "revealing", "請先公布答案");
        resolveRound(room, m.id, now);
      } else if (c.type === "next") {
        assert(g.status === "round_result", "請先完成本題計分");
        g.rounds.push(r);
        if (
          g.gameId === "werewolf"
            ? !!g.data.winner
            : g.rounds.length >= g.settings.rounds
        )
          finishGame(room, m.id, now);
        else {
          const qs = g.data.questions as Question[];
          const q = qs[g.rounds.length % qs.length];
          g.round = modules[g.gameId].createRound({ room, game: g, now }, q);
          g.status = "collecting";
          room.usedQuestions.push(q.question_id);
        }
      } else if (c.type === "skip") {
        assert(g.status !== "game_result", "遊戲已結束");
        if (!r.resolved) {
          r.submissions = {};
          r.judgments = {};
          r.resolved = true;
          r.data.result = {
            scores: {},
            max: 0,
            summary: { skipped: true },
            unscored: true,
          };
        }
        g.status = "round_result";
      } else if (c.type === "finish") {
        finishGame(room, m.id, now);
      } else if (c.type === "hide-story") {
        assert(g.gameId === "anonymous-story", "不適用此遊戲");
        r.data.hidden = true;
      } else if (c.type === "werewolf") {
        assert(
          g.gameId === "werewolf" && g.roster.includes(c.target ?? ""),
          "無效的狼人殺操作",
        );
        if (c.value === "eliminate") eliminateWerewolf(room, c.target!, now);
        else if (c.value === "revive") {
          const alive = g.data.alive as string[];
          if (!alive.includes(c.target!)) alive.push(c.target!);
          delete g.data.winner;
        } else if (c.value === "inspect") {
          const assignment = g.data.roles as Record<string, string>;
          const seer = Object.entries(assignment).find(
            ([, role]) => role === "seer",
          )?.[0];
          assert(seer, "本局沒有預言家");
          g.data.inspections = {
            ...(g.data.inspections as object),
            [seer]: {
              target: c.target,
              isWolf: assignment[c.target!] === "wolf",
            },
          };
        } else if (c.value === "heal" || c.value === "poison") {
          const potions = g.data.potions as Record<string, boolean>;
          assert(potions[c.value], "這瓶藥已使用");
          potions[c.value] = false;
          if (c.value === "poison") eliminateWerewolf(room, c.target!, now);
          (g.data.log as string[]).push("主持人記錄了一次藥水使用");
        } else assert(false, "未知的狼人殺動作");
      } else assert(false, "未知操作");
    }
  }
  room.requests.push(key);
  room.requests = room.requests.slice(-1000);
  room.revision++;
}
