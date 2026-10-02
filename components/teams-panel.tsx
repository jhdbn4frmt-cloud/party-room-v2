"use client";
import { useState } from "react";
import type { RoomView } from "@/features/room/project";
import type { Command } from "@/features/room/engine";
export type HostProps = {
  room: RoomView;
  send: (c: Omit<Command, "requestId">) => Promise<void>;
  busy: boolean;
};
export function TeamsPanel({ room, send, busy }: HostProps) {
  const [count, setCount] = useState(room.teams.length || 2);
  const [notice, setNotice] = useState("");
  const [edit, setEdit] = useState("");
  const [name, setName] = useState("");
  const can =
    room.isHost &&
    (room.status === "lobby" || room.game?.status === "game_result");
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>🧩 我們怎麼組隊？</h3>
        <small>{room.teams.length} 隊</small>
      </div>
      {can && (
        <>
          <div className="button-row wrap">
            <label>
              隊伍數
              <select value={count} onChange={(e) => setCount(+e.target.value)}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            {["random", "smart"].map((method) => (
              <button
                key={method}
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void send({ type: "teams", count, method }).then(() =>
                    setNotice(
                      method === "smart"
                        ? "已參考本場表現平衡隊伍"
                        : "已平均隨機分隊",
                    ),
                  )
                }
              >
                {method === "smart" ? "✦ 智慧分隊" : "🎲 隨機分隊"}
              </button>
            ))}
          </div>
          <p className="muted" role="status">
            {notice || "拖曳玩家或使用選單換隊；鎖定的玩家會保留隊伍。"}
          </p>
        </>
      )}
      <div className="teams-grid">
        {room.teams.map((t) => (
          <div
            className="team-card"
            key={t.id}
            style={{ borderTopColor: t.color }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (can)
                void send({
                  type: "move",
                  target: e.dataTransfer.getData("text/plain"),
                  teamId: t.id,
                });
            }}
          >
            <div className="panel-heading">
              <h4>
                {t.emoji} {t.name}
              </h4>
              {can && (
                <button
                  className="icon-button"
                  aria-label={`修改${t.name}隊名`}
                  onClick={() => {
                    setEdit(t.id);
                    setName(t.name);
                  }}
                >
                  ✎
                </button>
              )}
            </div>
            {edit === t.id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send({
                    type: "rename-team",
                    target: t.id,
                    value: name,
                  }).then(() => setEdit(""));
                }}
              >
                <input
                  aria-label="新隊名"
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                />
                <button disabled={busy} className="button secondary">
                  儲存
                </button>
              </form>
            )}
            <div className="tags">
              {room.members
                .filter((m) => m.teamId === t.id)
                .map((m) => (
                  <span
                    key={m.id}
                    draggable={can && !m.locked}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", m.id)
                    }
                  >
                    {m.emoji} {m.name}
                    {m.locked ? " 🔒" : ""}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
      {can && room.teams.length > 0 && (
        <div className="team-roster">
          {room.members.map((m) => (
            <div key={m.id}>
              <span>
                {m.emoji} {m.name}
              </span>
              <select
                aria-label={`${m.name}的隊伍`}
                value={m.teamId ?? ""}
                disabled={busy}
                onChange={(e) =>
                  void send({
                    type: "move",
                    target: m.id,
                    teamId: e.target.value || null,
                  })
                }
              >
                <option value="">未分隊</option>
                {room.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji} {t.name}
                  </option>
                ))}
              </select>
              <button
                className="icon-button"
                disabled={busy}
                aria-label={`${m.locked ? "解鎖" : "鎖定"}${m.name}`}
                onClick={() => void send({ type: "lock", target: m.id })}
              >
                {m.locked ? "🔒" : "🔓"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
