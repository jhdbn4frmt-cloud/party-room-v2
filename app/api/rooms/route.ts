import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { body, errorResponse, setSession } from "@/lib/api";
import { newToken } from "@/lib/sessions";
import { transact } from "@/lib/storage";
import { createRoom } from "@/features/room/engine";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const data = z
      .object({
        name: z.string().min(1).max(20),
        code: z
          .string()
          .regex(/^\d{4}$/)
          .optional(),
      })
      .parse(await body(req));
    const token = newToken();
    for (let i = 0; i < 20; i++) {
      const code = data.code ?? String(randomInt(10000)).padStart(4, "0");
      const created = await transact(code, (existing) => {
        if (
          existing &&
          existing.status !== "ended" &&
          existing.expiresAt > Date.now()
        )
          return { room: existing, result: false };
        return { room: createRoom(code, data.name, token), result: true };
      });
      if (created) {
        const res = NextResponse.json({ code });
        setSession(res, code, token, req);
        return res;
      }
      if (data.code) throw new Error("這個房號正在使用中，請換一個");
    }
    throw new Error("目前房間已滿，請稍後再試");
  } catch (e) {
    return errorResponse(e);
  }
}
