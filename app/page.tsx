"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Plus,
  Users,
  ChevronDown,
  Gamepad2,
  Sparkles,
  X,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { GameLibrary } from "@/components/game-library";
export default function Home() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [dialog, setDialog] = useState<"create" | "join" | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (dialog === "join") {
        router.push(`/r/${code}`);
        return;
      }
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code: custom ? code : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/r/${data.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <header className="site-header">
        <Brand />
        <nav>
          <a href="#games">遊戲收藏</a>
          <a href="#how">怎麼玩</a>
          <span className="small-pill">
            <span className="dot" />
            今晚，來玩點什麼
          </span>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-star">✦</span>{" "}
              把朋友聚在一起，好玩的事就會發生
            </div>
            <h1>
              同一個房間，
              <br />
              不一樣的
              <span className="fun-word">
                好玩<span>✧</span>
                <svg viewBox="0 0 280 20" aria-hidden="true">
                  <path d="M4 11Q130 -2 275 9M26 18Q150 4 251 15" />
                </svg>
              </span>
              。
            </h1>
            <p className="hero-description">
              手機拿出來，默契準備好。
              <br />
              不用下載、不用註冊，和朋友一路玩到捨不得散場。
            </p>
            <div className="hero-actions">
              <button
                className="button primary big"
                disabled={!hydrated}
                onClick={() => {
                  setDialog("create");
                  setError("");
                  setBusy(false);
                }}
              >
                <Plus size={22} />
                建立房間
                <ArrowUpRight size={21} />
              </button>
              <button
                className="button secondary big"
                disabled={!hydrated}
                onClick={() => {
                  setDialog("join");
                  setError("");
                  setBusy(false);
                }}
              >
                <Users size={21} />
                加入房間
                <ArrowUpRight size={21} />
              </button>
            </div>
            <div className="hero-footnote">
              <div className="mini-avatars">
                <span>🐸</span>
                <span>🦊</span>
                <span>🐰</span>
                <span>🐼</span>
              </div>
              <span>
                <b>4–16 位朋友</b> · 一個房間玩整晚
              </span>
            </div>
          </div>
          <div className="hero-art" aria-label="彩色聚會遊戲插畫">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="sticker sticker-yellow">
              GOOD
              <br />
              TIMES! <span>✹</span>
            </span>
            <div className="art-ticket">
              <span>ADMIT EVERYONE</span>
              <b>
                今晚
                <br />
                一起玩。
              </b>
              <i>PARTY PASS / 001</i>
            </div>
            <div className="art-controller">
              <div className="controller-face">
                <span />
                <span />
              </div>
              <div className="controller-smile" />
              <div className="dpad">✚</div>
              <div className="controller-buttons">
                <i />
                <i />
              </div>
              <div className="controller-label">LET’S PLAY</div>
            </div>
            <div className="art-chat">
              默契在線！<span>♡</span>
            </div>
            <div className="art-dice">⚄</div>
            <span className="spark spark-a">✦</span>
            <span className="spark spark-b">✷</span>
            <span className="spark spark-c">✧</span>
            <span className="art-caption">LESS SCROLLING. MORE LAUGHING.</span>
          </div>
          <a className="scroll-hint" href="#games">
            往下挖寶 <ChevronDown size={16} />
          </a>
        </section>
        <div className="marquee" aria-hidden="true">
          <span>GOOD FRIENDS</span>✦<span>GREAT NIGHTS</span>✦
          <span>一起笑到沒電</span>✦<span>ONE ROOM, ALL NIGHT</span>✦
          <span>GOOD FRIENDS</span>
        </div>
        <section className="section" id="games">
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE GAME SHELF</div>
              <h2>
                今晚，想玩哪一款？<span>✷</span>
              </h2>
              <p>從「也太有默契」到「怎麼會猜不到」，每個人都有主場。</p>
            </div>
            <span className="outline-sticker">
              <Gamepad2 size={20} />
              12 款遊戲 · 多種玩法
            </span>
          </div>
          <GameLibrary
            onSelect={() => {
              setDialog("create");
              setBusy(false);
              setError("");
            }}
          />
          <p className="library-note">
            估數字、排序收在知識問答；混音猜歌收在猜音樂。音樂與街景採現場輔助玩法。
          </p>
        </section>
        <section className="how-section" id="how">
          <div className="eyebrow">LESS SETUP. MORE PARTY.</div>
          <h2>把時間留給好朋友。</h2>
          <div className="how-grid">
            {[
              [
                "01",
                "開個房間",
                "取個暱稱，一鍵開房。把 QR Code 或 LINE 連結丟進群組。",
              ],
              [
                "02",
                "朋友到齊",
                "手機就是控制器，電視就是大舞台。自由分隊，隨時加入。",
              ],
              [
                "03",
                "一路玩下去",
                "換遊戲不用重來，分數一路累積。今晚誰是 MVP？",
              ],
            ].map(([n, title, desc]) => (
              <div key={n}>
                <b>{n}</b>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
          <button
            className="button primary"
            disabled={!hydrated}
            onClick={() => {
              setDialog("create");
              setBusy(false);
              setError("");
            }}
          >
            <Sparkles size={18} />
            開始今晚的聚會
          </button>
        </section>
      </main>
      <footer>
        <Brand />
        <p>
          為面對面的笑聲而做。
          <br />
          Made for your kind of party.
        </p>
        <span>© {new Date().getFullYear()} PARTY ROOM</span>
      </footer>
      {dialog && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setDialog(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <button
              className="close-button"
              aria-label="關閉"
              onClick={() => setDialog(null)}
            >
              <X />
            </button>
            <span className="modal-emoji">
              {dialog === "create" ? "🪩" : "🎟️"}
            </span>
            <div className="eyebrow">
              {dialog === "create"
                ? "MAKE SOME MEMORIES"
                : "YOUR FRIENDS ARE WAITING"}
            </div>
            <h2 id="dialog-title">
              {dialog === "create" ? "今晚，你來開場。" : "好玩，就差你一個。"}
            </h2>
            <p>
              {dialog === "create"
                ? "先告訴大家怎麼叫你，其他的我們準備好了。"
                : "輸入朋友分享的 4 位數房號。"}
            </p>
            <form onSubmit={submit}>
              {dialog === "create" && (
                <label>
                  你的暱稱
                  <input
                    autoFocus
                    required
                    maxLength={20}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="大家都叫我…"
                  />
                </label>
              )}
              {dialog === "create" && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={custom}
                    onChange={(e) => setCustom(e.target.checked)}
                  />
                  自訂幸運房號
                </label>
              )}
              {(dialog === "join" || custom) && (
                <label>
                  4 位數房號
                  <input
                    autoFocus={dialog === "join"}
                    required
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="例如 0520"
                    className="code-input"
                  />
                </label>
              )}
              {error && (
                <div role="alert" className="error-message">
                  {error}
                </div>
              )}
              <button className="button primary full" disabled={busy}>
                {busy
                  ? "正在準備好玩的事…"
                  : dialog === "create"
                    ? "建立房間 ↗"
                    : "前往房間 ↗"}
              </button>
            </form>
            <small className="muted">不用註冊 · 不用下載 · 免費開玩</small>
          </section>
        </div>
      )}
    </>
  );
}
