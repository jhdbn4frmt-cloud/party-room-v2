"use client";
import {
  AnswerForm,
  Waiting,
  SortList,
  type PlayProps,
} from "@/components/game-shared";
export default function QuizView({ game, send, busy, display }: PlayProps) {
  const q = game.round.question;
  if (display)
    return (
      <div className="option-display">
        {q.options.map((o, i) => (
          <div key={o}>
            <b>{String.fromCharCode(65 + i)}</b>
            {o}
          </div>
        ))}
      </div>
    );
  if (game.mine) return <Waiting />;
  if (q.mode === "order")
    return (
      <SortList
        initial={q.options.map((o) => ({ id: o, label: o }))}
        label="拖曳或按箭頭排序"
        busy={busy}
        onDone={(values) => send({ type: "answer", values })}
      />
    );
  if (q.mode === "number")
    return (
      <AnswerForm send={send} busy={busy} numeric label="估一個最接近的數字" />
    );
  return (
    <div className="answer-options">
      {q.options.map((o, i) => (
        <button
          key={o}
          disabled={busy}
          onClick={() => void send({ type: "answer", value: o })}
        >
          <span>{String.fromCharCode(65 + i)}</span>
          {o}
        </button>
      ))}
    </div>
  );
}
