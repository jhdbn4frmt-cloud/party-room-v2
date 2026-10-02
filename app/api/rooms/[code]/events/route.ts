import { NextRequest } from "next/server";
import { transact } from "@/lib/storage";
import { auth, assert, tick } from "@/features/room/engine";
import { project } from "@/features/room/project";
import { session } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const token = session(req, code);
  const display = req.nextUrl.searchParams.get("display") === "1";
  const encoder = new TextEncoder();
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const started = Date.now();
  const stream = new ReadableStream({
    start(controller) {
      let previous = "";
      const send = async () => {
        if (cancelled) return;
        try {
          const view = await transact(code, (room) => {
            assert(
              room && room.expiresAt > Date.now(),
              "找不到房間，請確認房號",
            );
            let viewer = null;
            if (token)
              try {
                viewer = auth(room, token);
              } catch {}
            if (viewer && !display && Date.now() - viewer.lastSeen > 6000)
              viewer.lastSeen = Date.now();
            tick(room);
            return { room, result: project(room, viewer, Date.now(), display) };
          });
          const compare = JSON.stringify({ ...view, serverNow: 0 });
          if (!cancelled) {
            if (compare !== previous) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(view)}\n\n`),
              );
              previous = compare;
            } else controller.enqueue(encoder.encode(": heartbeat\n\n"));
          }
        } catch (e) {
          if (!cancelled) {
            controller.enqueue(
              encoder.encode(
                `event: problem\ndata: ${JSON.stringify({ error: e instanceof Error ? e.message : "連線中斷" })}\n\n`,
              ),
            );
            controller.close();
            cancelled = true;
          }
          return;
        }
        if (!cancelled) {
          if (Date.now() - started > 45000) {
            controller.close();
            cancelled = true;
          } else timer = setTimeout(send, 900);
        }
      };
      void send();
      req.signal.addEventListener(
        "abort",
        () => {
          cancelled = true;
          if (timer) clearTimeout(timer);
          try {
            controller.close();
          } catch {}
        },
        { once: true },
      );
    },
    cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
