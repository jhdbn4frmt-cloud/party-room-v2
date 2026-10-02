import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookieName } from "./sessions";
const globalLimits = globalThis as typeof globalThis & {
  partyLimits?: Map<string, { count: number; reset: number }>;
};
const limits = (globalLimits.partyLimits ??= new Map());
export function rateLimit(req: NextRequest) {
  const key =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  if (limits.size > 2000)
    for (const [k, v] of limits) if (v.reset < now) limits.delete(k);
  const current = limits.get(key);
  if (!current || current.reset < now) {
    limits.set(key, { count: 1, reset: now + 60000 });
    return;
  }
  if (++current.count > 1800) throw new Error("操作太頻繁，請稍後再試");
}
export async function body(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin) {
    const parsed = new URL(origin);
    const sameHost =
      parsed.host === req.headers.get("host") &&
      ["http:", "https:"].includes(parsed.protocol);
    if (!sameHost && origin !== process.env.APP_ORIGIN)
      throw new Error("不允許跨站操作");
  }
  rateLimit(req);
  const text = await req.text();
  if (text.length > 40000) throw new Error("請求內容過大");
  return JSON.parse(text);
}
export const actionSchema = z.object({
  roundId: z.string().uuid().optional(),
  type: z.string().max(40),
  requestId: z.string().min(1).max(100),
  target: z.string().max(100).optional(),
  teamId: z.string().nullable().optional(),
  value: z.string().max(300).optional(),
  values: z.array(z.string().max(300)).max(30).optional(),
  gameId: z
    .enum([
      "same-answer",
      "commander",
      "intel-station",
      "quiz",
      "guess-music",
      "lyrics-melody",
      "streetview-hunt",
      "werewolf",
      "most-likely",
      "friend-sync",
      "anonymous-story",
      "draw-guess",
    ])
    .optional(),
  settings: z
    .object({
      mode: z.string().max(30),
      team: z.boolean(),
      rounds: z.number().int(),
      seconds: z.number().int(),
      scoring: z.enum(["balanced", "raw", "independent"]),
      competitive: z.boolean(),
      difficulty: z.enum(["all", "easy", "normal", "hard"]),
      partyType: z.string().max(30),
      age: z.number().min(0).max(120),
      spice: z.number().int().min(0).max(3),
      roles: z
        .array(z.enum(["wolf", "villager", "seer", "witch", "hunter"]))
        .max(16)
        .optional(),
    })
    .partial()
    .optional(),
  count: z.number().int().optional(),
  method: z.enum(["random", "smart"]).optional(),
  delta: z.number().optional(),
  valid: z.boolean().optional(),
  action: z
    .object({
      type: z.string().max(40),
      value: z.string().max(300).optional(),
      values: z.array(z.string().max(300)).max(30).optional(),
      target: z.string().optional(),
      points: z.array(z.array(z.number()).length(2)).max(300).optional(),
      tool: z.enum(["pen", "eraser"]).optional(),
    })
    .optional(),
  playlist: z
    .array(
      z.object({
        gameId: z.enum([
          "same-answer",
          "commander",
          "intel-station",
          "quiz",
          "guess-music",
          "lyrics-melody",
          "streetview-hunt",
          "werewolf",
          "most-likely",
          "friend-sync",
          "anonymous-story",
          "draw-guess",
        ]),
        mode: z.string(),
      }),
    )
    .max(20)
    .optional(),
  eventId: z.string().optional(),
});
export function errorResponse(error: unknown) {
  const raw = error instanceof Error ? error.message : "操作失敗，請稍後再試";
  const message = error instanceof z.ZodError ? "輸入資料格式不正確" : raw;
  const status = /重新加入/.test(message)
    ? 401
    : /只有主持人/.test(message)
      ? 403
      : /找不到房間/.test(message)
        ? 404
        : 400;
  return NextResponse.json({ error: message }, { status });
}
export function setSession(
  res: NextResponse,
  code: string,
  token: string,
  request: NextRequest,
) {
  res.cookies.set(cookieName(code), token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      !!process.env.VERCEL ||
      new URL(request.url).protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https",
    maxAge: 86400,
    path: "/",
  });
}
export function session(req: NextRequest, code: string) {
  return req.cookies.get(cookieName(code))?.value;
}
