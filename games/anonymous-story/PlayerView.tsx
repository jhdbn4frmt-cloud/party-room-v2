"use client";
import {
  AnswerForm,
  PlayerPicker,
  Waiting,
  type PlayProps,
} from "@/components/game-shared";
export default function StoryView({
  room,
  game,
  send,
  busy,
  display,
}: PlayProps) {
  if (game.round.phase === "writing")
    return display || game.mine ? (
      <Waiting>大家正在寫匿名小故事。</Waiting>
    ) : (
      <AnswerForm send={send} busy={busy} label="寫一段可以和朋友分享的趣事" />
    );
  return (
    <>
      <blockquote className="story">“{String(game.public.story)}”</blockquote>
      {!display && (
        <>
          {game.private.isAuthor ? (
            <Waiting>這是你的故事！先保守秘密，讓朋友猜。</Waiting>
          ) : game.mine ? (
            <Waiting />
          ) : (
            <PlayerPicker
              room={room}
              ids={game.roster}
              send={send}
              busy={busy}
              label="你覺得是誰寫的？"
            />
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void send({ type: "report" })}
          >
            檢舉並隱藏這段內容
          </button>
        </>
      )}
    </>
  );
}
