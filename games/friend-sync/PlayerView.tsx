"use client";
import {
  AnswerForm,
  Waiting,
  type PlayProps,
  names,
} from "@/components/game-shared";
export default function FriendView({
  room,
  game,
  send,
  busy,
  display,
}: PlayProps) {
  return (
    <>
      <div className="spotlight">
        這題的主角是 <b>{names(room, [String(game.public.target)])}</b>
      </div>
      {display ? (
        <Waiting>主角寫自己的答案，大家猜猜看！</Waiting>
      ) : game.mine ? (
        <Waiting />
      ) : (
        <AnswerForm
          send={send}
          busy={busy}
          label={
            game.private.isTarget
              ? "秘密寫下你的真實答案"
              : "猜猜主角會怎麼回答"
          }
        />
      )}
    </>
  );
}
