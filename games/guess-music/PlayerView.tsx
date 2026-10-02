"use client";
import {
  AnswerForm,
  Waiting,
  type PlayProps,
  names,
} from "@/components/game-shared";
export default function MusicView({
  room,
  game,
  send,
  busy,
  display,
}: PlayProps) {
  const buzz = (game.public.buzz ?? []) as string[];
  return (
    <>
      <div className="music-visual" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <i
            key={i}
            style={{
              animationDelay: `${i * 0.11}s`,
              height: `${20 + ((i * 17) % 60)}px`,
            }}
          />
        ))}
      </div>
      <p className="muted center">
        由主持人從合法音樂來源現場播放 · 以伺服器收到的順序搶答
      </p>
      {game.host?.music && (
        <details className="host-secret">
          <summary>主持人播放提示（請勿投影）</summary>
          <p>答案：{String(game.host.music.answer)}</p>
          <p>
            {String(
              (game.host.music as Record<string, unknown>).hostNote ?? "",
            )}
          </p>
        </details>
      )}
      {buzz.length > 0 && (
        <p className="spotlight">搶答順序：{names(room, buzz)}</p>
      )}
      {!display &&
        (game.mine ? (
          <Waiting />
        ) : game.settings.mode === "mashup" ? (
          <AnswerForm
            send={send}
            busy={busy}
            multiple
            label="三首歌，用逗號分開"
          />
        ) : buzz.includes(room.me ?? "") ? (
          <AnswerForm send={send} busy={busy} label="你搶到了！輸入歌名" />
        ) : (
          <button
            className="buzz-button"
            disabled={busy}
            onClick={() => void send({ type: "buzz" })}
          >
            我知道！<small>點一下搶答</small>
          </button>
        ))}
    </>
  );
}
