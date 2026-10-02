import { randomUUID } from "node:crypto";
import { createRoom, joinRoom, command } from "../features/room/engine";
import type { Command } from "../features/room/engine";
import type { Room, Member } from "../games/types";
export const NOW = 1800000000000;
export function fixture(n = 4, code = "1234") {
  const room = createRoom(code, "Host", "host-token", NOW);
  for (let i = 1; i < n; i++) joinRoom(room, `Player${i}`, `token-${i}`, NOW);
  return room;
}
export function act(
  room: Room,
  c: Omit<Command, "requestId">,
  member: Member = room.members[0],
  now = NOW,
) {
  command(
    room,
    member,
    {
      ...c,
      roundId: c.roundId ?? room.game?.round.id,
      requestId: randomUUID(),
    },
    now,
  );
}
export function start(
  room: Room,
  id: NonNullable<Command["gameId"]>,
  mode = "default",
  team = false,
) {
  act(room, {
    type: "start",
    gameId: id,
    settings: { mode, team, rounds: 1, seconds: 30 },
  });
}
export function finish(room: Room) {
  if (room.game!.status === "collecting") act(room, { type: "reveal" });
  if (room.game!.status === "revealing") act(room, { type: "score" });
  act(room, { type: "next" });
}
