"use client";
import {
  AnswerForm,
  Waiting,
  type PlayProps,
  names,
} from "@/components/game-shared";
export default function SameAnswerView({
  room,
  game,
  send,
  busy,
  display,
}: PlayProps) {
  const mode = game.settings.mode;
  if (mode === "bomb") {
    const turn = String(game.public.turn);
    const alive = (game.public.alive ?? []) as string[];
    return (
      <>
        <div className="spotlight">
          💣 現在輪到 <b>{names(room, [turn])}</b>
          <p>剩下 {alive.length} 人 · 重複、無效或超時即出局</p>
        </div>
        {!display &&
          (turn === room.me ? (
            <AnswerForm
              key={turn + String(game.public.used)}
              send={send}
              busy={busy}
              placeholder="快！說一個有效答案"
            />
          ) : (
            <Waiting>輪到你時，手機會顯示輸入框。</Waiting>
          ))}
        <div className="tags">
          {((game.public.used ?? []) as string[]).map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
      </>
    );
  }
  if (display) return <Waiting>大家正在手機上秘密作答。</Waiting>;
  if (game.mine && mode !== "burst") return <Waiting />;
  return (
    <>
      {mode === "burst" && (
        <p>
          已收集 <b>{game.mine?.values.length ?? 0} / 10</b> 個有效答案 ·
          稀有答案有加分
        </p>
      )}
      <AnswerForm
        send={send}
        busy={busy || (game.mine?.values.length ?? 0) >= 10}
      />
      {mode === "burst" && (
        <div className="tags">
          {game.mine?.values.map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
      )}
    </>
  );
}
