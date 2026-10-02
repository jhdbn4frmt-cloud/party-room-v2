"use client";
import { useState } from "react";
import { defaultSettings, getCard } from "@/games/catalog";
import { GameLibrary } from "./game-library";
import type { GameId, GameSettings } from "@/games/types";
import type { HostProps } from "./teams-panel";
import { roles } from "@/games/werewolf/roles";
export function GameSetup({ room, send, busy }: HostProps) {
  const [gameId, setGameId] = useState<GameId>(
    room.playlist[0]?.gameId ?? "same-answer",
  );
  const card = getCard(gameId);
  const [settings, setSettings] = useState<GameSettings>({
    ...defaultSettings,
    mode: room.playlist[0]?.mode ?? "sync",
  });
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({
    wolf: 1,
    villager: 2,
    seer: 1,
    witch: 1,
    hunter: 0,
  });
  const [customRoles, setCustomRoles] = useState(false);
  function choose(id: GameId, mode?: string) {
    const c = getCard(id);
    setGameId(id);
    setSettings({
      ...settings,
      mode: mode ?? c.modes[0].id,
      team: !c.supportsIndividual,
      seconds: id === "quiz" ? 20 : id === "streetview-hunt" ? 120 : 30,
    });
    document
      .getElementById("game-config")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return (
    <section className="game-setup">
      <div className="section-heading">
        <div>
          <div className="eyebrow">PICK YOUR NEXT ADVENTURE</div>
          <h2>下一站，玩什麼？</h2>
        </div>
        <span className="small-pill">
          {room.isHost ? "主持人選遊戲" : "挑一款，告訴主持人"}
        </span>
      </div>
      <GameLibrary compact selected={gameId} onSelect={(g) => choose(g.id)} />
      <section className="panel config-panel" id="game-config">
        <div className="config-game">
          <span>{card.emoji}</span>
          <div>
            <div className="eyebrow">準備開玩</div>
            <h3>{card.name}</h3>
            <p>{card.description}</p>
          </div>
        </div>
        {room.isHost ? (
          <>
            <div className="settings-grid">
              <label>
                玩法
                <select
                  value={settings.mode}
                  onChange={(e) =>
                    setSettings({ ...settings, mode: e.target.value })
                  }
                >
                  {card.modes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                賽制
                <select
                  value={settings.team ? "team" : "individual"}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      team: e.target.value === "team",
                    })
                  }
                >
                  {card.supportsIndividual && (
                    <option value="individual">個人賽</option>
                  )}
                  {card.supportsTeam && <option value="team">團體賽</option>}
                </select>
              </label>
              <label>
                回合數
                <select
                  value={settings.rounds}
                  onChange={(e) =>
                    setSettings({ ...settings, rounds: +e.target.value })
                  }
                >
                  {[1, 3, 5, 8, 10, 20, 30, 40].map((n) => (
                    <option key={n} value={n}>
                      {n} 回合
                    </option>
                  ))}
                </select>
              </label>
              <label>
                每題時間
                <select
                  value={settings.seconds}
                  onChange={(e) =>
                    setSettings({ ...settings, seconds: +e.target.value })
                  }
                >
                  {[10, 20, 30, 45, 60, 90, 120, 180].map((n) => (
                    <option key={n} value={n}>
                      {n} 秒
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Party Score
                <select
                  value={settings.scoring}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      scoring: e.target.value as GameSettings["scoring"],
                    })
                  }
                >
                  <option value="balanced">平衡累積（每款最高 100）</option>
                  <option value="raw">原始分數累積</option>
                  <option value="independent">每款獨立計分</option>
                </select>
              </label>
              {gameId === "quiz" && (
                <label>
                  難度
                  <select
                    value={settings.difficulty}
                    onChange={(e) =>
                      setSettings({ ...settings, difficulty: e.target.value })
                    }
                  >
                    {[
                      ["all", "全部難度"],
                      ["easy", "輕鬆"],
                      ["normal", "普通"],
                      ["hard", "挑戰"],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {gameId === "most-likely" && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={settings.competitive}
                  onChange={(e) =>
                    setSettings({ ...settings, competitive: e.target.checked })
                  }
                />
                將票數加入競賽（預設只看票數）
              </label>
            )}
            {gameId === "werewolf" && (
              <>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={customRoles}
                    onChange={(e) => setCustomRoles(e.target.checked)}
                  />
                  自訂基礎角色數量
                </label>
                {customRoles && (
                  <div className="settings-grid">
                    {roles.map((r) => (
                      <label key={r.id}>
                        {r.name}
                        <input
                          type="number"
                          min={0}
                          max={16}
                          value={roleCounts[r.id]}
                          onChange={(e) =>
                            setRoleCounts({
                              ...roleCounts,
                              [r.id]: +e.target.value,
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
            <p className="muted">
              需要 {card.minPlayers}–{card.maxPlayers} 人，目前{" "}
              {room.members.length} 人。主持人可直接開始，無需全部
              Ready。團體回合採隊內最高分。
            </p>
            <div className="button-row wrap">
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  void send({
                    type: "start",
                    gameId,
                    settings: {
                      ...settings,
                      roles:
                        gameId === "werewolf" && customRoles
                          ? Object.entries(roleCounts).flatMap(([role, n]) =>
                              Array(Math.max(0, Math.min(16, n))).fill(role),
                            )
                          : undefined,
                    },
                  })
                }
              >
                開始{card.name} ↗
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void send({
                    type: "playlist",
                    playlist: [
                      ...room.playlist,
                      { gameId, mode: settings.mode },
                    ],
                  })
                }
              >
                ＋ 排入今晚清單
              </button>
            </div>
          </>
        ) : (
          <p>主持人會帶大家開始，先按「我準備好了」吧。</p>
        )}
      </section>
      {room.playlist.length > 0 && (
        <section className="panel">
          <h3>🎟️ 今晚的遊戲清單</h3>
          <ol className="playlist">
            {room.playlist.map((item, i) => (
              <li
                key={`${i}-${item.gameId}`}
                draggable={room.isHost}
                onDragStart={(e) =>
                  e.dataTransfer.setData("text/plain", String(i))
                }
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  if (!room.isHost) return;
                  const from = +e.dataTransfer.getData("text/plain");
                  if (
                    !Number.isInteger(from) ||
                    from < 0 ||
                    from >= room.playlist.length
                  )
                    return;
                  const next = [...room.playlist];
                  const [entry] = next.splice(from, 1);
                  next.splice(i, 0, entry);
                  void send({ type: "playlist", playlist: next });
                }}
              >
                <span>{i + 1}</span>
                <b>
                  {getCard(item.gameId).emoji} {getCard(item.gameId).name}
                </b>
                <small>
                  {
                    getCard(item.gameId).modes.find((m) => m.id === item.mode)
                      ?.name
                  }
                </small>
                {room.isHost && (
                  <>
                    <button
                      className="icon-button"
                      aria-label="移到上一款"
                      disabled={busy || i === 0}
                      onClick={() => {
                        const next = [...room.playlist];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        void send({ type: "playlist", playlist: next });
                      }}
                    >
                      ↑
                    </button>
                    <button
                      className="text-button"
                      onClick={() => choose(item.gameId, item.mode)}
                    >
                      選這款
                    </button>
                    <button
                      className="icon-button"
                      aria-label="移除清單遊戲"
                      disabled={busy}
                      onClick={() =>
                        void send({
                          type: "playlist",
                          playlist: room.playlist.filter((_, j) => j !== i),
                        })
                      }
                    >
                      ×
                    </button>
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}
export function HostAdministration({ room, send, busy }: HostProps) {
  const [target, setTarget] = useState(room.members[0]?.id ?? "");
  const [delta, setDelta] = useState(5);
  const [reason, setReason] = useState("主持人調整");
  const [confirm, setConfirm] = useState(false);
  if (!room.isHost) return null;
  return (
    <details className="panel host-admin">
      <summary>🎛 主持人管理與調分</summary>
      <div className="admin-controls">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void send({ type: "allow-join" })}
        >
          {room.allowJoin
            ? "🔓 目前允許加入，點此關閉"
            : "🔒 目前關閉加入，點此開放"}
        </button>
        <div className="admin-members">
          {room.members.map((m) => (
            <div key={m.id}>
              <span>
                {m.emoji} {m.name}
              </span>
              {m.id !== room.hostId && (
                <>
                  <button
                    className="text-button"
                    disabled={busy || !m.online}
                    onClick={() =>
                      void send({ type: "transfer", target: m.id })
                    }
                  >
                    轉移主持人
                  </button>
                  <button
                    className="text-button danger-text"
                    disabled={busy}
                    onClick={() => void send({ type: "remove", target: m.id })}
                  >
                    移除
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <h4>手動調分</h4>
        <form
          className="adjust-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send({ type: "adjust", target, delta, value: reason });
          }}
        >
          <label>
            對象
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {room.members.map((m) => (
                <option key={m.id} value={m.id}>
                  個人 · {m.name}
                </option>
              ))}
              {room.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  團隊 · {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            加減分
            <input
              type="number"
              min={-1000}
              max={1000}
              value={delta}
              onChange={(e) => setDelta(+e.target.value)}
            />
          </label>
          <label>
            原因
            <input
              maxLength={100}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button className="button secondary" disabled={busy}>
            新增調分紀錄
          </button>
        </form>
        <details>
          <summary>分數紀錄（{room.ledger.length} 筆）</summary>
          <div className="ledger">
            {room.ledger
              .slice()
              .reverse()
              .map((e) => (
                <div key={e.id}>
                  <span>
                    {room.members.find((m) => m.id === e.target)?.name ??
                      room.teams.find((t) => t.id === e.target)?.name}
                    <small>{e.reason}</small>
                  </span>
                  <b>
                    {e.delta > 0 ? "+" : ""}
                    {e.delta}
                  </b>
                  {!e.inverseOf &&
                    !room.ledger.some((x) => x.inverseOf === e.id) && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          void send({ type: "undo-score", eventId: e.id })
                        }
                      >
                        復原
                      </button>
                    )}
                </div>
              ))}
          </div>
        </details>
        {room.status !== "ended" &&
          (confirm ? (
            <div className="notice">
              <p>結束後關閉加入，並顯示今晚戰績。</p>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => void send({ type: "end-party" })}
              >
                確定結束今晚聚會
              </button>
              <button className="text-button" onClick={() => setConfirm(false)}>
                再玩一下
              </button>
            </div>
          ) : (
            <button
              className="button secondary"
              onClick={() => setConfirm(true)}
            >
              結束 Party，查看今晚戰績
            </button>
          ))}
      </div>
    </details>
  );
}
