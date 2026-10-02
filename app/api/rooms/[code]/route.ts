import { NextRequest, NextResponse } from "next/server";
import {
  body,
  errorResponse,
  setSession,
  session,
  actionSchema,
} from "@/lib/api";
import { newToken } from "@/lib/sessions";
import { transact, questionBank } from "@/lib/storage";
import { auth, assert, joinRoom, command, tick } from "@/features/room/engine";
import { project } from "@/features/room/project";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ code: string }> };
export async function GET(req: NextRequest, ctx: Context) {
  try {
    const { code } = await ctx.params;
    const result = await transact(code, (room) => {
      assert(room && room.expiresAt > Date.now(), "找不到房間，請確認房號");
      let viewer = null;
      const token = session(req, code);
      if (token)
        try {
          viewer = auth(room, token);
        } catch {}
      const display = req.nextUrl.searchParams.get("display") === "1";
      if (viewer && !display) viewer.lastSeen = Date.now();
      tick(room);
      return { room, result: project(room, viewer, Date.now(), display) };
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: NextRequest, ctx: Context) {
  try {
    const { code } = await ctx.params;
    const data = await body(req);
    const token = session(req, code);
    const newSession = newToken();
    const bank = data.type === "start" ? await questionBank() : undefined;
    const result = await transact(code, (room) => {
      assert(room && room.expiresAt > Date.now(), "找不到房間，請確認房號");
      if (data.type === "join") {
        assert(typeof data.name === "string", "請輸入暱稱");
        let m;
        let joined = false;
        try {
          m = auth(room, token);
        } catch {
          m = joinRoom(room, data.name, newSession);
          joined = true;
        }
        return { room, result: { view: project(room, m), joined } };
      }
      const m = auth(room, token);
      command(room, m, actionSchema.parse(data), Date.now(), bank);
      return { room, result: { view: project(room, m), joined: false } };
    });
    const res = NextResponse.json(result.view);
    if (result.joined) setSession(res, code, newSession, req);
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
