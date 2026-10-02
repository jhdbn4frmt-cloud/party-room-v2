"use client";
import { useState } from "react";
import { catalog } from "@/games/catalog";
import type { GameCard } from "@/games/types";
export function GameLibrary({
  onSelect,
  compact = false,
  selected,
}: {
  onSelect?: (game: GameCard, mode?: string) => void;
  compact?: boolean;
  selected?: string;
}) {
  const [filter, setFilter] = useState("全部遊戲");
  const categories = [
    "全部遊戲",
    "默契 / 反應",
    "音樂",
    "團隊",
    "知識",
    "創意",
    "推理",
    "探索",
  ];
  const list = catalog.filter(
    (g) => filter === "全部遊戲" || g.category === filter,
  );
  return (
    <div className={compact ? "library compact" : "library"}>
      <div className="filter-tabs" aria-label="遊戲分類">
        {categories.map((c) => (
          <button
            className={filter === c ? "active" : ""}
            onClick={() => setFilter(c)}
            key={c}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="game-grid">
        {list.map((g, i) => (
          <button
            className={`game-card ${g.color} ${selected === g.id ? "selected" : ""}`}
            key={g.id}
            onClick={() => onSelect?.(g)}
            disabled={!onSelect}
            style={{ animationDelay: `${i * 0.025}s` }}
          >
            <div className="game-art">
              <span>{g.emoji}</span>
              <i className="art-star">✦</i>
              <i className="art-ring" />
              <small>{g.assisted ? "現場互動" : "手機一起玩"}</small>
            </div>
            <div className="game-card-body">
              <div className="card-category">
                {g.category}
                <span>{g.minutes} 分鐘</span>
              </div>
              <h3>
                {g.name}
                <span>↗</span>
              </h3>
              <p>{g.description}</p>
              <div className="card-meta">
                <span>
                  {g.minPlayers}–{g.maxPlayers} 人
                </span>
                <span>
                  {g.supportsTeam
                    ? g.supportsIndividual
                      ? "個人 / 團隊"
                      : "團隊"
                    : "個人"}
                </span>
                <span>{g.difficulty}</span>
              </div>
              <div className="card-modes">
                {g.modes.map((m) => (
                  <span key={m.id}>{m.name}</span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
