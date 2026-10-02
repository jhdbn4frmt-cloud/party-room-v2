"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { AnswerForm, type PlayProps, names } from "@/components/game-shared";
type Stroke = { points: number[][]; tool: string };
export default function DrawingView({
  room,
  game,
  send,
  busy,
  display,
}: PlayProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<number[][] | null>(null);
  const [tool, setTool] = useState("pen");
  const artist = !display && room.me === game.public.artist;
  const strokes = useMemo(
    () => (game.public.strokes ?? []) as Stroke[],
    [game.public.strokes],
  );
  function paint(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    ctx.strokeStyle = stroke.tool === "eraser" ? "#fffdf7" : "#292535";
    ctx.lineWidth = stroke.tool === "eraser" ? 24 : 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    stroke.points.forEach(([x, y], i) =>
      i ? ctx.lineTo(x * 600, y * 400) : ctx.moveTo(x * 600, y * 400),
    );
    ctx.stroke();
  }
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || drawing.current) return;
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, 600, 400);
    strokes.forEach((stroke) => paint(ctx, stroke));
  }, [strokes]);
  return (
    <>
      {artist ? (
        <div className="secret-card">
          <small>🤫 你的詞語</small>
          <h3>{String(game.private.word)}</h3>
        </div>
      ) : (
        <p className="muted">
          {names(room, [String(game.public.artist)])} 正在作畫
        </p>
      )}
      <canvas
        aria-label="即時繪畫畫布"
        className={`drawing-canvas ${artist ? "editable" : ""}`}
        ref={canvas}
        width={600}
        height={400}
        onPointerDown={(e) => {
          if (!artist || busy) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const r = e.currentTarget.getBoundingClientRect();
          drawing.current = [
            [
              Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
              Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
            ],
          ];
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const r = e.currentTarget.getBoundingClientRect();
          drawing.current.push([
            Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
            Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
          ]);
          const ctx = canvas.current?.getContext("2d");
          if (ctx) paint(ctx, { points: drawing.current.slice(-2), tool });
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          const raw = drawing.current;
          const points = raw.filter(
            (_, i) => i % Math.max(1, Math.ceil(raw.length / 299)) === 0,
          );
          drawing.current = null;
          void send({
            type: "stroke",
            points: points.length === 1 ? [points[0], points[0]] : points,
            tool,
          });
        }}
        onPointerCancel={() => {
          drawing.current = null;
        }}
      />
      {artist ? (
        <div className="button-row">
          <button
            className={`button ${tool === "pen" ? "primary" : "secondary"}`}
            onClick={() => setTool("pen")}
          >
            ✏️ 畫筆
          </button>
          <button
            className={`button ${tool === "eraser" ? "primary" : "secondary"}`}
            onClick={() => setTool("eraser")}
          >
            橡皮擦
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void send({ type: "clear" })}
          >
            清除
          </button>
        </div>
      ) : (
        !display && (
          <AnswerForm
            send={send}
            busy={busy}
            label={`猜猜畫的是什麼（${game.mine?.values.length ?? 0}/10 次）`}
          />
        )
      )}
    </>
  );
}
