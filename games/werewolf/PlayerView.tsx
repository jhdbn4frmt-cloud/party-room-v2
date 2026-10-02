"use client";
import { useState } from "react";
import {
  PlayerPicker,
  Waiting,
  type PlayProps,
  names,
} from "@/components/game-shared";
export default function WerewolfView({
  room,
  game,
  send,
  busy,
  display,
}: PlayProps) {
  const [show, setShow] = useState(false);
  const role = game.private.role as
    { name: string; description: string } | undefined;
  const alive = (game.public.alive ?? []) as string[];
  const inspection = game.private.inspection as
    { target: string; isWolf: boolean } | undefined;
  return (
    <>
      {!display && role && (
        <div className="secret-card">
          <button className="button secondary" onClick={() => setShow(!show)}>
            {show ? "收起身份" : "🤫 查看我的秘密身份"}
          </button>
          {show && (
            <>
              <h3>{role.name}</h3>
              <p>{role.description}</p>
              {(game.private.allies as string[] | undefined)?.length ? (
                <p>狼隊友：{names(room, game.private.allies as string[])}</p>
              ) : null}
              {inspection && (
                <p>
                  上次查驗 {names(room, [inspection.target])}：
                  {inspection.isWolf ? "是狼人" : "不是狼人"}
                </p>
              )}
            </>
          )}
        </div>
      )}
      <div className="spotlight">
        <h3>
          {game.round.phase === "night"
            ? "🌙 天黑請閉眼"
            : game.round.phase === "day"
              ? "☀️ 天亮了，開始討論"
              : "🗳️ 投票時間"}
        </h3>
        <p>存活 {alive.length} 人 · 依主持人指示現場行動</p>
      </div>
      {game.public.winner ? <h3>{String(game.public.winner)}獲勝！</h3> : null}
      {!display &&
        game.round.phase === "vote" &&
        (alive.includes(room.me ?? "") && !game.mine ? (
          <PlayerPicker room={room} ids={alive} send={send} busy={busy} />
        ) : (
          <Waiting>等待投票完成。</Waiting>
        ))}
      <div className="event-log">
        {((game.public.log ?? []) as string[]).map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </>
  );
}
