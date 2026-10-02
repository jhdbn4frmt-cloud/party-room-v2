"use client";
import { Waiting, type PlayProps } from "@/components/game-shared";
export default function LyricsView({ game, send, busy, display }: PlayProps) {
  return (
    <>
      <div className="lyrics-pair">
        <div>
          <small>這首的歌詞</small>
          <h3>{String(game.public.lyricsSong)}</h3>
        </div>
        <span>×</span>
        <div>
          <small>那首的旋律</small>
          <h3>{String(game.public.melodySong)}</h3>
        </div>
      </div>
      <p className="center muted">
        現場開唱，主持人決定是否挑戰成功。網站不提供歌詞或音訊。
      </p>
      {!display &&
        (game.mine ? (
          <Waiting>表演已登記，等主持人給分！</Waiting>
        ) : (
          <button
            className="button primary full"
            disabled={busy}
            onClick={() => void send({ type: "answer" })}
          >
            🎤 我完成表演了
          </button>
        ))}
    </>
  );
}
