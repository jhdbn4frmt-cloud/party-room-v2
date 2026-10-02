"use client";
import {
  AnswerForm,
  Waiting,
  SortList,
  type PlayProps,
  names,
} from "@/components/game-shared";
export default function CommanderView({
  room,
  game,
  send,
  busy,
  display,
}: PlayProps) {
  const leader = String(game.public.commander);
  if (game.round.phase === "arrange")
    return !display && leader === room.me ? (
      <>
        <div className="secret-card">
          <small>🤫 只有你看得到</small>
          <h3>{String(game.private.rule)}</h3>
          <p>現場詢問大家，再依規則排列。不要說出規則！</p>
        </div>
        <SortList
          initial={room.members
            .filter((m) => game.roster.includes(m.id))
            .map((m) => ({ id: m.id, label: `${m.emoji} ${m.name}` }))}
          label="你的秘密排列"
          busy={busy}
          onDone={(values) => send({ type: "order", values })}
        />
      </>
    ) : (
      <Waiting>
        {names(room, [leader])} 正在排列大家，猜猜他發現了什麼？
      </Waiting>
    );
  return (
    <>
      <div className="ordered-players">
        {((game.public.order ?? []) as string[]).map((id, i) => (
          <span key={id}>
            <b>{i + 1}</b>
            {names(room, [id])}
          </span>
        ))}
      </div>
      {!display && leader !== room.me && (
        <AnswerForm
          send={send}
          busy={busy}
          label={`他依照什麼規則？已猜 ${game.mine?.values.length ?? 0} 次（最多 2 次）`}
        />
      )}
    </>
  );
}
