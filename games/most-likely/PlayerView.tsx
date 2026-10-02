"use client";
import {
  PlayerPicker,
  Waiting,
  type PlayProps,
} from "@/components/game-shared";
export default function LikelyView({
  room,
  game,
  send,
  busy,
  display,
}: PlayProps) {
  return display || game.mine ? (
    <Waiting>投票是匿名的，等大家一起揭曉！</Waiting>
  ) : (
    <PlayerPicker room={room} ids={game.roster} send={send} busy={busy} />
  );
}
