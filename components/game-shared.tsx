"use client";
import { useState } from "react";
import type { GameView, RoomView } from "@/features/room/project";
import type { GameAction } from "@/games/types";
export type PlayProps = {
  room: RoomView;
  game: GameView;
  send: (action: GameAction) => Promise<boolean>;
  busy: boolean;
  display: boolean;
};
export function AnswerForm({
  send,
  busy,
  label = "輸入你的答案",
  placeholder = "在這裡偷偷作答…",
  multiple = false,
  numeric = false,
}: {
  send: (a: GameAction) => Promise<boolean>;
  busy: boolean;
  label?: string;
  placeholder?: string;
  multiple?: boolean;
  numeric?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="answer-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await send(
          multiple
            ? {
                type: "answer",
                values: value
                  .split(/[,，\n]/)
                  .map((v) => v.trim())
                  .filter(Boolean),
              }
            : { type: "answer", value },
        );
        if (ok) setValue("");
      }}
    >
      <label>
        {label}
        <input
          required
          type={numeric ? "number" : "text"}
          maxLength={300}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
        />
      </label>
      <button className="button primary full" disabled={busy || !value.trim()}>
        送出答案 <span>↗</span>
      </button>
    </form>
  );
}
export function PlayerPicker({
  room,
  send,
  busy,
  ids,
  label = "選擇一位玩家",
}: {
  room: RoomView;
  send: (a: GameAction) => Promise<boolean>;
  busy: boolean;
  ids?: string[];
  label?: string;
}) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <div className="pick-grid">
        {room.members
          .filter((m) => !ids || ids.includes(m.id))
          .map((m) => (
            <button
              className="pick"
              key={m.id}
              disabled={busy}
              onClick={() => void send({ type: "answer", value: m.id })}
            >
              <span>{m.emoji}</span>
              {m.name}
            </button>
          ))}
      </div>
    </div>
  );
}
export function Waiting({
  children = "答案已送出，看看朋友們準備好了沒！",
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="waiting">
      <span className="waiting-icon">✦</span>
      <h3>這裡準備好了</h3>
      <p>{children}</p>
    </div>
  );
}
export function SortList({
  initial,
  label,
  onDone,
  busy,
}: {
  initial: { id: string; label: string }[];
  label: string;
  onDone: (ids: string[]) => Promise<unknown>;
  busy: boolean;
}) {
  const [order, setOrder] = useState(initial);
  const [drag, setDrag] = useState<number | null>(null);
  function move(from: number, to: number) {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [entry] = next.splice(from, 1);
    next.splice(to, 0, entry);
    setOrder(next);
  }
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <ol className="sort-list">
        {order.map((item, i) => (
          <li
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null) move(drag, i);
              setDrag(null);
            }}
            key={item.id}
          >
            <span className="sort-number">{i + 1}</span>
            <strong>{item.label}</strong>
            <button
              className="icon-button"
              aria-label={`向上移動 ${item.label}`}
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
            >
              ↑
            </button>
            <button
              className="icon-button"
              aria-label={`向下移動 ${item.label}`}
              disabled={i === order.length - 1}
              onClick={() => move(i, i + 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <button
        className="button primary full"
        disabled={busy}
        onClick={() => void onDone(order.map((i) => i.id))}
      >
        確認順序 ↗
      </button>
    </div>
  );
}
export function names(room: RoomView, ids: string[]) {
  return ids
    .map((id) => room.members.find((m) => m.id === id)?.name ?? "玩家")
    .join("、");
}
