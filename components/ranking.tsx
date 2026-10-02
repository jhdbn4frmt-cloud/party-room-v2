"use client";
import { useState } from "react";
import type { RoomView } from "@/features/room/project";
import { getCard } from "@/games/catalog";
export function Ranking({
  room,
  final = false,
}: {
  room: RoomView;
  final?: boolean;
}) {
  const [tab, setTab] = useState<"individual" | "team">("individual");
  const entries = (tab === "team" ? room.teams : room.members)
    .slice()
    .sort((a, b) => b.score - a.score);
  return (
    <section className={`panel ranking ${final ? "result-card" : ""}`}>
      {final && (
        <>
          <div className="eyebrow">TONIGHT’S GOOD MEMORIES</div>
          <h2>今晚戰績，值得收藏。</h2>
          <div className="result-stats">
            <span>
              <b>{room.stats.games}</b> 款遊戲
            </span>
            <span>
              <b>{room.stats.rounds}</b> 回合
            </span>
            <span>
              <b>{room.stats.players}</b> 位朋友
            </span>
          </div>
          {room.stats.games >= 2 && entries[0]?.score > 0 && (
            <div className="winner">
              <span>👑</span>
              <small>
                {entries.filter((e) => e.score === entries[0].score).length > 1
                  ? "並列 MVP"
                  : "今晚 MVP"}
              </small>
              <h3>
                {entries
                  .filter((e) => e.score === entries[0].score)
                  .map((e) => `${e.emoji} ${e.name}`)
                  .join("、")}
              </h3>
            </div>
          )}
        </>
      )}
      <div className="panel-heading">
        <h3>{final ? "🏆 最終排行榜" : "🏆 Party Score"}</h3>
        <small>整晚累積</small>
      </div>
      <div className="segmented">
        <button
          className={tab === "individual" ? "active" : ""}
          onClick={() => setTab("individual")}
        >
          個人榜
        </button>
        <button
          className={tab === "team" ? "active" : ""}
          onClick={() => setTab("team")}
        >
          團隊榜
        </button>
      </div>
      <ol className="rank-list">
        {entries.map((entry) => (
          <li key={entry.id} className={entry.id === room.me ? "is-me" : ""}>
            <span className="rank-number">
              {entry.score === entries[0].score && entry.score > 0
                ? "★"
                : entries.findIndex((e) => e.score === entry.score) + 1}
            </span>
            <span className="avatar small">{entry.emoji}</span>
            <span>
              {entry.name}
              {entry.id === room.me && <small>你</small>}
            </span>
            <b>
              {entry.score}
              <small>pt</small>
            </b>
          </li>
        ))}
      </ol>
      {!entries.length && (
        <p className="muted">還沒有隊伍，先由主持人分隊吧。</p>
      )}
      <p className="score-note">團隊得分留在原隊伍，不加入每位隊員個人榜。</p>
      {final && (
        <>
          <div className="tags">
            {room.history.map((g) => (
              <span key={g.id}>
                {getCard(g.gameId).emoji} {getCard(g.gameId).name}
              </span>
            ))}
          </div>
          <p className="muted center">截圖留念，分享今晚的快樂 ✦</p>
          <button
            className="button secondary full"
            onClick={async () => {
              try {
                if (navigator.share)
                  await navigator.share({
                    title: "今晚 Party Room 戰績",
                    text: `今晚 ${room.stats.players} 位朋友玩了 ${room.stats.games} 款遊戲！${entries[0]?.name ?? ""} 拿下 ${entries[0]?.score ?? 0} 分。`,
                  });
                else window.print();
              } catch {}
            }}
          >
            分享今晚戰績 ↗
          </button>
        </>
      )}
    </section>
  );
}
