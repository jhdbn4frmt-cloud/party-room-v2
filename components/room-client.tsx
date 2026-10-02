"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Monitor, Maximize, Wifi, WifiOff } from "lucide-react";
import { Brand } from "./brand";
import { useRoom } from "@/features/room/use-room";
import { ShareRoom } from "./share-room";
import { Ranking } from "./ranking";
import { TeamsPanel } from "./teams-panel";
import { GameSetup, HostAdministration } from "./host-settings";
import { GameStage } from "./game-stage";
import type { Command } from "@/features/room/engine";
export function RoomClient({
  code,
  display = false,
}: {
  code: string;
  display?: boolean;
}) {
  const { room, error, busy, connected, send, clearError } = useRoom(
    code,
    display,
  );
  const [name, setName] = useState("");
  const [tab, setTab] = useState("games");
  useEffect(() => {
    const target = document.querySelector(
      ".game-stage,.game-finished,.lobby-hero,.result-card",
    );
    target?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }, [
    room?.me,
    room?.status,
    room?.game?.id,
    room?.game?.round.id,
    room?.game?.round.phase,
    room?.game?.status,
  ]);
  async function safeSend(c: Omit<Command, "requestId">) {
    try {
      await send(c);
    } catch {}
  }
  if (!room)
    return (
      <div className="loading-page">
        <Brand />
        <div className="loading-orbit">✦</div>
        <h2>{error ? "還沒找到這個房間" : "正在把朋友聚在一起…"}</h2>
        <p role={error ? "alert" : undefined}>{error || `連接房間 ${code}`}</p>
        {error && (
          <Link className="button primary" href="/">
            回首頁確認房號
          </Link>
        )}
      </div>
    );
  if (!room.me && !display)
    return (
      <main className="join-page">
        <Brand />
        <section className="panel join-panel">
          <div className="eyebrow">YOU’RE INVITED</div>
          <span className="join-emoji">🎟️</span>
          <h1>你的朋友在這裡。</h1>
          <div className="room-code compact-code">{code}</div>
          <p>{room.members.length} 位朋友已入場，取個暱稱就能加入。</p>
          <div className="mini-avatars">
            {room.members.slice(0, 8).map((m) => (
              <span key={m.id} title={m.name}>
                {m.emoji}
              </span>
            ))}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await send({ type: "join", name });
              } catch {}
            }}
          >
            <label>
              你的暱稱
              <input
                autoFocus
                required
                maxLength={20}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="朋友都怎麼叫你？"
              />
            </label>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <button
              className="button primary full"
              disabled={busy || !room.allowJoin || room.status === "ended"}
            >
              {busy
                ? "正在加入…"
                : room.status === "ended"
                  ? "這場聚會已結束"
                  : !room.allowJoin
                    ? "主持人暫時關閉加入"
                    : "加入這場聚會 ↗"}
            </button>
          </form>
          <p className="muted">
            {room.status === "playing"
              ? "遊戲進行中，你會在下一局加入。"
              : "不用帳號，你的手機就是控制器。"}
          </p>
        </section>
      </main>
    );
  const me = room.members.find((m) => m.id === room.me);
  return (
    <div className={display ? "room-app tv-mode" : "room-app"}>
      <header className="room-header">
        <Brand />
        <div className="room-header-right">
          <span className={`connection ${connected ? "online" : ""}`}>
            {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
            <span>{connected ? "即時連線中" : "重新連線中…"}</span>
          </span>
          <span className="header-code">
            ROOM <b>{code}</b>
          </span>
          {display ? (
            <button
              className="icon-button"
              aria-label="全螢幕"
              onClick={() => {
                if (!document.fullscreenElement)
                  void document.documentElement.requestFullscreen?.();
                else void document.exitFullscreen?.();
              }}
            >
              <Maximize size={20} />
            </button>
          ) : (
            <Link
              className="button small secondary"
              href={`/tv/${code}`}
              target="_blank"
            >
              <Monitor size={16} />
              <span>大螢幕</span>
            </Link>
          )}
        </div>
      </header>
      {error && (
        <div className="toast error-message" role="alert">
          <span>{error}</span>
          <button aria-label="關閉錯誤提示" onClick={clearError}>
            ×
          </button>
        </div>
      )}
      {room.election && (
        <section className="election-banner">
          <h3>主持人離線超過 90 秒，選出新的主持人</h3>
          <p>
            第 {room.election.round}{" "}
            輪投票。第一輪平票重新投票，第二輪平票由伺服器抽選。
          </p>
          {!display &&
            !room.election.voted &&
            room.election.candidates.map((id) => (
              <button
                className="button secondary"
                disabled={busy}
                key={id}
                onClick={() => void safeSend({ type: "vote-host", target: id })}
              >
                {room.members.find((m) => m.id === id)?.name}
              </button>
            ))}
          {room.election.voted && <span>已投票，等待結果。</span>}
        </section>
      )}
      <main className="room-shell">
        <div className="room-main">
          {room.status === "ended" ? (
            <Ranking room={room} final />
          ) : room.game ? (
            <GameStage
              key={room.game.id}
              room={room}
              send={safeSend}
              busy={busy}
              display={display}
              playerSend={async (action) => {
                try {
                  await send({
                    type: "submit",
                    roundId: room.game!.round.id,
                    action,
                  });
                  return true;
                } catch {
                  return false;
                }
              }}
            />
          ) : (
            <>
              <section className="lobby-hero">
                <div>
                  <div className="eyebrow">THE NIGHT IS STILL YOUNG</div>
                  <h1>
                    {display
                      ? "朋友到齊，快樂開局。"
                      : room.isHost
                        ? "你的聚會，準備開場。"
                        : "朋友到齊，就差開玩。"}
                  </h1>
                  <p>
                    {room.isHost
                      ? "分享房號、挑款遊戲，剩下的交給今晚的默契。"
                      : "先準備好，主持人會帶大家進入遊戲。"}
                  </p>
                </div>
                <div className="lobby-code">
                  <small>今晚的通關密語</small>
                  <div className="room-code">{code}</div>
                </div>
              </section>
              {!display && !room.isHost && (
                <section className="panel player-ready-banner">
                  <div>
                    <h3>
                      {me?.ready ? "你準備好了！" : "先準備好，等等就開玩。"}
                    </h3>
                    <p>主持人選好遊戲後，手機會自動切換。</p>
                  </div>
                  <button
                    className={`button ${me?.ready ? "ready" : "primary"}`}
                    disabled={busy}
                    onClick={() => void safeSend({ type: "ready" })}
                  >
                    {me?.ready ? "✓ 已準備，點此取消" : "我準備好了 ✦"}
                  </button>
                </section>
              )}
              {display ? (
                <>
                  <ShareRoom code={code} large />
                  <div className="tv-waiting">
                    <span>✦</span>
                    <h2>手機準備好，好玩的要來了。</h2>
                    <p>請在手機選遊戲並開始，這裡會自動同步。</p>
                  </div>
                  <TeamsPanel room={room} send={safeSend} busy={busy} />
                </>
              ) : (
                <>
                  <div className="lobby-tabs">
                    <button
                      className={tab === "games" ? "active" : ""}
                      onClick={() => setTab("games")}
                    >
                      🎮 遊戲大廳
                    </button>
                    <button
                      className={tab === "teams" ? "active" : ""}
                      onClick={() => setTab("teams")}
                    >
                      🧩 隊伍
                    </button>
                    <button
                      className={tab === "scores" ? "active" : ""}
                      onClick={() => setTab("scores")}
                    >
                      🏆 排行榜
                    </button>
                  </div>
                  {tab === "games" ? (
                    <GameSetup room={room} send={safeSend} busy={busy} />
                  ) : tab === "teams" ? (
                    <TeamsPanel room={room} send={safeSend} busy={busy} />
                  ) : (
                    <Ranking room={room} />
                  )}
                </>
              )}
            </>
          )}
          {!display && (
            <HostAdministration room={room} send={safeSend} busy={busy} />
          )}
        </div>
        <aside className="room-sidebar">
          {!display && (
            <section className="panel">
              <div className="panel-heading">
                <h3>🎟️ 邀朋友進房</h3>
                <small>房號 {code}</small>
              </div>
              <ShareRoom code={code} />
            </section>
          )}
          <section className="panel players-panel">
            <div className="panel-heading">
              <h3>今晚的好朋友</h3>
              <span className="count-badge">{room.members.length} / 16</span>
            </div>
            <p className="muted">
              {room.members.filter((m) => m.ready).length} /{" "}
              {room.members.length} 已準備
            </p>
            <div className="player-list">
              {room.members.map((m) => (
                <div
                  className={`player ${m.id === room.me ? "is-me" : ""}`}
                  key={m.id}
                >
                  <span className="avatar">{m.emoji}</span>
                  <span className="player-info">
                    <b>
                      {m.name} {m.id === room.hostId && <small>主持人</small>}
                      {m.id === room.me && <small>你</small>}
                    </b>
                    <small>
                      {m.waiting
                        ? "下局加入"
                        : room.teams.find((t) => t.id === m.teamId)
                          ? `${room.teams.find((t) => t.id === m.teamId)?.emoji} ${room.teams.find((t) => t.id === m.teamId)?.name}`
                          : "一起玩，不用客氣"}
                    </small>
                  </span>
                  <span
                    className={`presence ${m.online ? "online" : ""}`}
                    aria-label={m.online ? "在線" : "離線"}
                  />
                  {m.ready && (
                    <span className="ready-check" title="已準備">
                      ✓
                    </span>
                  )}
                </div>
              ))}
            </div>
            {!display && room.isHost && room.status === "lobby" && (
              <button
                className={`button full ${me?.ready ? "ready" : "primary"}`}
                disabled={busy}
                onClick={() => void safeSend({ type: "ready" })}
              >
                {me?.ready ? "✓ 已準備，點此取消" : "我準備好了 ✦"}
              </button>
            )}
          </section>
          {room.game && <Ranking room={room} />}
          <section className="room-note">
            <span>✦</span>
            <p>
              一個房間，玩一整晚。
              <br />
              換遊戲，朋友和分數都還在。
            </p>
          </section>
          <details className="event-panel">
            <summary>聚會動態</summary>
            {room.events
              .slice()
              .reverse()
              .map((e) => (
                <p key={e.id}>{e.text}</p>
              ))}
          </details>
        </aside>
      </main>
      <footer className="room-footer">
        <span>PARTY ROOM</span>
        <span>Good friends. Great nights.</span>
      </footer>
    </div>
  );
}
