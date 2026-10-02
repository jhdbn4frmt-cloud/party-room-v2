"use client";
import { useEffect, useState } from "react";
import type { GameView, RoomView } from "@/features/room/project";
import type { HostProps } from "./teams-panel";
import type { Result, GameAction } from "@/games/types";
import { getCard } from "@/games/catalog";
import { instructions } from "@/games/instructions";
import { views } from "@/games/views";
import { names, Waiting } from "./game-shared";
import { roles } from "@/games/werewolf/roles";
function Timer({ game, serverNow }: { game: GameView; serverNow: number }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, game.round.endsAt - serverNow),
  );
  useEffect(() => {
    const base = performance.now();
    const update = () =>
      setRemaining(
        game.status === "paused"
          ? (game.round.remainingMs ?? 0)
          : Math.max(
              0,
              game.round.endsAt - serverNow - performance.now() + base,
            ),
      );
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [serverNow, game.round.endsAt, game.status, game.round.remainingMs]);
  const secs = Math.ceil(remaining / 1000);
  return (
    <div
      className={`timer ${secs <= 5 ? "urgent" : ""}`}
      role="timer"
      aria-label={`剩餘 ${secs} 秒`}
    >
      <span>{game.status === "paused" ? "Ⅱ" : secs}</span>
      <small>{game.status === "paused" ? "暫停中" : "SECONDS"}</small>
    </div>
  );
}
function Results({ room, game }: { room: RoomView; game: GameView }) {
  const result = game.result as Result | null;
  if (!result) return null;
  const summary = (result.summary ?? {}) as Record<string, unknown>;
  const groups = summary.groups as Record<string, string[]> | undefined;
  const votes = summary.votes as Record<string, number> | undefined;
  const answer = summary.answer ?? summary.rule;
  const questions = summary.questions as
    { question: string; answer: string }[] | undefined;
  return (
    <div className="reveal-panel">
      <div className="eyebrow">THE BIG REVEAL</div>
      <h2>
        {game.status === "round_result" ? "這回合，漂亮！" : "答案揭曉！"}
      </h2>
      {answer !== undefined && (
        <div className="revealed-answer">
          {Array.isArray(answer) ? answer.join(" · ") : String(answer)}
        </div>
      )}
      {summary.explanation ? <p>{String(summary.explanation)}</p> : null}
      {summary.story ? (
        <blockquote className="story">
          {String(summary.story)}
          <footer>
            —{" "}
            {summary.author
              ? names(room, [String(summary.author)])
              : "內容已隱藏"}
          </footer>
        </blockquote>
      ) : null}
      {questions && (
        <ol className="intel-results">
          {questions.map((q) => (
            <li key={q.question}>
              <span>{q.question}</span>
              <strong>{q.answer}</strong>
            </li>
          ))}
        </ol>
      )}
      {groups && (
        <div className="answer-groups">
          {Object.entries(groups)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([answer, ids]) => (
              <div key={answer}>
                <h3>
                  {answer}
                  <span>{ids.length} 人</span>
                </h3>
                <p>{names(room, ids)}</p>
              </div>
            ))}
        </div>
      )}
      {votes && (
        <div className="vote-results">
          {Object.entries(votes)
            .sort((a, b) => b[1] - a[1])
            .map(([id, n]) => (
              <div key={id}>
                <span>{names(room, [id])}</span>
                <div>
                  <i
                    style={{
                      width: `${
                        (n /
                          Math.max(
                            1,
                            Object.values(votes).reduce((a, b) => a + b, 0),
                          )) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <b>{n} 票</b>
              </div>
            ))}
        </div>
      )}
      {summary.ranking ? (
        <ol className="bomb-rank">
          {(summary.ranking as string[]).map((id, i) => (
            <li key={id}>
              {i + 1}. {names(room, [id])}
            </li>
          ))}
        </ol>
      ) : null}
      {summary.skipped ? <p>本題已跳過，不計分。</p> : null}
      {!result.unscored && (
        <div className="round-scores">
          {Object.entries(result.scores)
            .sort((a, b) => b[1] - a[1])
            .map(([id, n]) => (
              <span key={id}>
                {room.members.find((m) => m.id === id)?.emoji}{" "}
                {names(room, [id])}
                <b>+{n}</b>
              </span>
            ))}
        </div>
      )}
      {game.status === "revealing" && (
        <p className="muted">主持人確認答案後計分；目前顯示為預估回合分數。</p>
      )}
    </div>
  );
}
export function GameStage({
  room,
  send,
  busy,
  display,
  playerSend,
}: HostProps & {
  display: boolean;
  playerSend: (action: GameAction) => Promise<boolean>;
}) {
  const game = room.game!;
  const card = getCard(game.gameId);
  const View = views[game.gameId];
  const me = room.members.find((m) => m.id === room.me);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [confirm, setConfirm] = useState(false);
  const isHost = room.isHost && !display;
  const status = game.status;
  const waiting =
    me?.waiting || (!game.roster.includes(room.me ?? "") && !display);
  const phaseLabels: Record<string, string> = {
    answer: "現在請在手機作答",
    arrange: "指揮官秘密排序",
    guess: "猜猜看，答案是什麼？",
    reading: "情報員閱讀時間",
    describe: "情報員口頭傳遞",
    writing: "寫下你的匿名故事",
    night: "依主持人指示完成夜晚行動",
    day: "大家一起討論",
    vote: "投出你的一票",
  };
  if (status === "game_result")
    return (
      <section className="panel game-finished">
        <div className="finish-confetti">
          ✦ <span>{card.emoji}</span> ✦
        </div>
        <div className="eyebrow">THAT WAS A GOOD ONE</div>
        <h2>{card.name}，完美收工！</h2>
        <p>
          {game.settings.scoring === "independent"
            ? "本款獨立計分，未加入 Party Score。"
            : "這局分數已加入整晚的 Party Score。"}
        </p>
        <div className="round-scores">
          {Object.entries(game.raw)
            .sort((a, b) => b[1] - a[1])
            .map(([id, n]) => (
              <span key={id}>
                {room.members.find((m) => m.id === id)?.name ??
                  room.teams.find((t) => t.id === id)?.name}
                <b>{n} 分</b>
              </span>
            ))}
        </div>
        {isHost ? (
          <div className="button-row wrap">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void send({ type: "lobby" })}
            >
              回遊戲大廳，換一款 ↗
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void send({
                  type: "start",
                  gameId: game.gameId,
                  settings: game.settings,
                })
              }
            >
              再玩一局
            </button>
            {room.playlist.length > 0 && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  const next = room.playlist[0];
                  const card = getCard(next.gameId);
                  void send({
                    type: "start",
                    gameId: next.gameId,
                    settings: {
                      ...game.settings,
                      mode: next.mode,
                      team:
                        !card.supportsIndividual ||
                        (game.settings.team && card.supportsTeam),
                    },
                  });
                }}
              >
                下一款：{getCard(room.playlist[0].gameId).name}
              </button>
            )}
          </div>
        ) : (
          <p>等主持人選下一款，大家繼續留在這個房間。</p>
        )}
      </section>
    );
  return (
    <section className="panel game-stage">
      <div className="stage-top">
        <div>
          <div className="eyebrow">
            {card.emoji} {card.name} ·{" "}
            {card.modes.find((m) => m.id === game.settings.mode)?.name}
          </div>
          <span className="round-indicator">
            ROUND <b>{String(game.round.number).padStart(2, "0")}</b>
            <small>
              / {game.gameId === "werewolf" ? "∞" : game.settings.rounds}
            </small>
          </span>
        </div>
        {(status === "collecting" || status === "paused") && (
          <Timer game={game} serverNow={room.serverNow} />
        )}
      </div>
      <div className="progress-track">
        <i
          style={{
            width: `${(game.round.answered.length / Math.max(1, game.roster.length)) * 100}%`,
          }}
        />
      </div>
      <div className="stage-progress">
        <span>
          {status === "paused"
            ? "主持人暫停了遊戲，稍作休息。"
            : status === "collecting"
              ? phaseLabels[game.round.phase]
              : "一起看看大家的答案"}
        </span>
        <span>
          {game.round.answered.length} / {game.roster.length} 已作答
        </span>
      </div>
      <details className="game-instructions">
        <summary>玩法小抄</summary>
        <p>{instructions(game.gameId, game.settings.mode)}</p>
      </details>
      <div
        className="stage-content"
        key={`${game.round.id}-${status}-${game.round.phase}`}
      >
        <h2 className="question">{game.round.question.text}</h2>
        {status === "paused" ? (
          <Waiting>遊戲暫停中，計時也停止了。</Waiting>
        ) : ["revealing", "round_result"].includes(status) ? (
          <Results room={room} game={game} />
        ) : waiting ? (
          <Waiting>遊戲進行中，你將於下一局加入。先幫朋友加油！</Waiting>
        ) : (
          <View
            key={`${game.round.id}-${game.round.phase}`}
            room={room}
            game={game}
            busy={busy}
            display={display}
            send={playerSend}
          />
        )}
      </div>
      {isHost && (
        <div className="host-game-controls">
          <div className="eyebrow">🎛 主持人控制台</div>
          {status === "collecting" && (
            <div className="button-row wrap">
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void send({ type: "advance" })}
              >
                {[
                  "reading",
                  "describe",
                  "arrange",
                  "writing",
                  "night",
                  "day",
                ].includes(game.round.phase)
                  ? "進入下一階段 →"
                  : game.gameId === "same-answer" &&
                      game.settings.mode === "bomb"
                    ? "目前玩家超時，換下一位"
                    : "公布答案 ✦"}
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void send({ type: "pause" })}
              >
                Ⅱ 暫停
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void send({ type: "skip" })}
              >
                跳過這題
              </button>
            </div>
          )}
          {status === "paused" && (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void send({ type: "resume" })}
            >
              ▶ 繼續遊戲
            </button>
          )}
          {status === "revealing" && (
            <>
              <Judging room={room} game={game} send={send} busy={busy} />
              {["same-answer", "friend-sync"].includes(game.gameId) && (
                <details>
                  <summary>合併同義答案</summary>
                  <div className="merge-form">
                    <input
                      aria-label="要合併的答案"
                      placeholder="例如 711"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                    <span>→</span>
                    <input
                      aria-label="合併後答案"
                      placeholder="例如 7-11"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                    <button
                      className="button secondary"
                      disabled={busy || !from || !to}
                      onClick={() =>
                        void send({ type: "merge", values: [from, to] })
                      }
                    >
                      合併
                    </button>
                    <button
                      className="text-button"
                      disabled={busy || game.round.merges.length === 0}
                      onClick={() => void send({ type: "undo-merge" })}
                    >
                      復原合併
                    </button>
                  </div>
                </details>
              )}
              <button
                className="button primary full"
                disabled={busy}
                onClick={() => void send({ type: "score" })}
              >
                確認並計分 ↗
              </button>
            </>
          )}
          {status === "round_result" && (
            <button
              className="button primary full"
              disabled={busy}
              onClick={() => void send({ type: "next" })}
            >
              {game.gameId !== "werewolf" &&
              game.round.number >= game.settings.rounds
                ? "完成這款遊戲，累積 Party Score"
                : "下一回合 →"}
            </button>
          )}
          {game.gameId === "anonymous-story" && game.host?.stories && (
            <details>
              <summary>內容審核（公布前可移除）</summary>
              {game.host.stories.map((story) => (
                <div className="judging-row" key={story.id}>
                  <span>{story.text}</span>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void send({
                        type: "judge",
                        target: story.id,
                        valid: !story.valid,
                      })
                    }
                  >
                    {story.valid ? "移除此內容" : "恢復內容"}
                  </button>
                </div>
              ))}
            </details>
          )}
          {game.gameId === "werewolf" && (
            <WerewolfHost room={room} game={game} send={send} busy={busy} />
          )}
          <div className="end-game-row">
            {confirm ? (
              <>
                <span>提早結算已作答回合？</span>
                <button
                  className="text-button danger-text"
                  disabled={busy}
                  onClick={() => void send({ type: "finish" })}
                >
                  確定結束這款遊戲
                </button>
                <button
                  className="text-button"
                  onClick={() => setConfirm(false)}
                >
                  取消
                </button>
              </>
            ) : (
              <button className="text-button" onClick={() => setConfirm(true)}>
                提早結束這款遊戲
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
function Judging({ room, game, send, busy }: HostProps & { game: GameView }) {
  return (
    <details
      open={["commander", "lyrics-melody", "streetview-hunt"].includes(
        game.gameId,
      )}
    >
      <summary>答案判定／修正</summary>
      <p className="muted">✓ 正確或有效 · × 錯誤或無效；套用後再確認計分。</p>
      {Object.entries(game.round.submissions).map(([id, s]) => (
        <div className="judging-row" key={id}>
          <span>
            <b>{names(room, [id])}</b>
            <small>{s.values.join(" / ")}</small>
          </span>
          {game.gameId === "intel-station" ? (
            s.values.map((_, i) => (
              <div key={i}>
                <small>第 {i + 1} 題</small>
                <button
                  className="icon-button"
                  aria-label={`${names(room, [id])}第${i + 1}題正確`}
                  disabled={busy}
                  onClick={() =>
                    void send({
                      type: "judge",
                      target: `${id}:${i}`,
                      valid: true,
                    })
                  }
                >
                  ✓
                </button>
                <button
                  className="icon-button"
                  aria-label={`${names(room, [id])}第${i + 1}題錯誤`}
                  disabled={busy}
                  onClick={() =>
                    void send({
                      type: "judge",
                      target: `${id}:${i}`,
                      valid: false,
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <>
              <button
                className="icon-button"
                aria-label={`判定${names(room, [id])}正確`}
                disabled={busy}
                onClick={() =>
                  void send({ type: "judge", target: id, valid: true })
                }
              >
                ✓
              </button>
              <button
                className="icon-button"
                aria-label={`判定${names(room, [id])}錯誤`}
                disabled={busy}
                onClick={() =>
                  void send({ type: "judge", target: id, valid: false })
                }
              >
                ×
              </button>
            </>
          )}
        </div>
      ))}
    </details>
  );
}
function WerewolfHost({
  room,
  game,
  send,
  busy,
}: HostProps & { game: GameView }) {
  const assignments = (game.host?.roles ?? {}) as Record<string, string>;
  return (
    <details className="host-secret">
      <summary>狼人殺主持筆記（秘密角色，勿投影）</summary>
      <p>
        夜晚依序：狼人 → 預言家 → 女巫。主持人標記出局；獵人技能依現場規則操作。
      </p>
      {room.members
        .filter((m) => game.roster.includes(m.id))
        .map((m) => (
          <div className="wolf-admin" key={m.id}>
            <strong>
              {m.emoji} {m.name} ·{" "}
              {roles.find((r) => r.id === assignments[m.id])?.name}
            </strong>
            <div className="button-row wrap">
              {["eliminate", "revive", "inspect", "heal", "poison"].map(
                (value, i) => (
                  <button
                    className="text-button"
                    disabled={busy}
                    key={value}
                    onClick={() =>
                      void send({ type: "werewolf", target: m.id, value })
                    }
                  >
                    {
                      [
                        "出局 / 開槍",
                        "復活",
                        "給預言家查驗",
                        "使用解藥",
                        "使用毒藥",
                      ][i]
                    }
                  </button>
                ),
              )}
            </div>
          </div>
        ))}
      <p>
        藥水：
        {Object.entries((game.host?.potions ?? {}) as Record<string, boolean>)
          .map(
            ([key, value]) =>
              `${key === "heal" ? "解藥" : "毒藥"}${value ? "可用" : "已用"}`,
          )
          .join(" · ")}
      </p>
    </details>
  );
}
