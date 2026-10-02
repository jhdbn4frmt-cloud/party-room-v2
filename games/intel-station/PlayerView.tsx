"use client";
import { useState } from "react";
import { Waiting, type PlayProps, names } from "@/components/game-shared";
export default function IntelView({
  room,
  game,
  send,
  busy,
  display,
}: PlayProps) {
  const [answers, setAnswers] = useState(["", "", ""]);
  const agents = Object.values(
    (game.public.agents ?? {}) as Record<string, string>,
  );
  if (game.round.phase === "reading")
    return (
      <>
        {game.private.passage && !display ? (
          <div className="secret-card">
            <small>🤫 情報員限定 · 時間到內容即消失</small>
            <p className="passage">{String(game.private.passage)}</p>
          </div>
        ) : (
          <Waiting>
            情報員 {names(room, agents)}{" "}
            正在閱讀。隊友先放下手機，準備接收消息。
          </Waiting>
        )}
      </>
    );
  if (game.round.phase === "describe")
    return (
      <Waiting>情報員請口頭描述剛剛的情報，隊友仔細聽！短文已收起。</Waiting>
    );
  const qs = (game.public.questions ?? []) as {
    question: string;
    options: string[];
    type: string;
  }[];
  if (!display && (game.mine || agents.includes(room.me ?? "")))
    return (
      <Waiting>
        {agents.includes(room.me ?? "")
          ? "情報員休息一下，這次交給隊友回答。"
          : "三題已送出！"}
      </Waiting>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send({ type: "answer", values: answers });
      }}
      className="intel-questions"
    >
      {qs.map((q, i) => (
        <label key={q.question}>
          <b>
            {i + 1}. {q.question}
          </b>
          {!display &&
            (q.options.length ? (
              <select
                value={answers[i]}
                required
                onChange={(e) =>
                  setAnswers((v) =>
                    v.map((s, j) => (i === j ? e.target.value : s)),
                  )
                }
              >
                <option value="">選擇答案</option>
                {q.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                required
                value={answers[i]}
                type={q.type === "number" ? "number" : "text"}
                onChange={(e) =>
                  setAnswers((v) =>
                    v.map((s, j) => (i === j ? e.target.value : s)),
                  )
                }
              />
            ))}
        </label>
      ))}
      {!display && (
        <button disabled={busy} className="button primary full">
          送出三題答案 ↗
        </button>
      )}
    </form>
  );
}
