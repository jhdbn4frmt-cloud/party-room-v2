"use client";
import { AnswerForm, Waiting, type PlayProps } from "@/components/game-shared";
import { mapsAdapter } from "@/lib/maps";
export default function StreetView({ game, send, busy, display }: PlayProps) {
  const location = String(game.public.startLocation);
  return (
    <>
      <div className="spotlight">
        <small>📍 起點</small>
        <h3>{location}</h3>
        <p>{String(game.public.range)}</p>
      </div>
      <a
        className="button secondary full"
        target="_blank"
        rel="noreferrer"
        href={mapsAdapter.external(location)}
      >
        開啟 Google Maps ↗
      </a>
      <p className="muted">
        切換到街景找目標，再回來提交位置或畫面描述，交給主持人核對。
      </p>
      {!display &&
        (game.mine ? (
          <Waiting>找到的位置已送出，請把地圖畫面給主持人看。</Waiting>
        ) : (
          <AnswerForm
            send={send}
            busy={busy}
            label="你找到的地點或特徵"
            placeholder="例如：出口右轉的紅色招牌…"
          />
        ))}
    </>
  );
}
