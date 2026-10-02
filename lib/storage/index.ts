import { mkdir, readFile, writeFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Room, Question } from "../../games/types";
import { seedQuestions } from "../../features/question-bank/seed";
export const dataDir =
  process.env.PARTY_DATA_DIR || path.join(process.cwd(), ".party-data");
export function isSupabase() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
export async function supabaseRequest(
  route: string,
  body?: unknown,
  method = "POST",
) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase 設定不完整");
  const response = await fetch(`${base}/rest/v1/${route}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(
      `資料庫連線失敗 (${response.status})，請檢查 migration 與環境設定`,
    );
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
async function lock(code: string) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const dir = path.join(dataDir, `${code}.lock`);
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await mkdir(dir);
      return () => rm(dir, { recursive: true, force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (Date.now() - (await stat(dir)).mtimeMs > 30000)
          await rm(dir, { recursive: true, force: true });
      } catch {}
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  throw new Error("房間忙碌中，請稍後再試");
}
export async function transact<T>(
  code: string,
  fn: (
    room: Room | null,
  ) => { room: Room; result: T } | Promise<{ room: Room; result: T }>,
): Promise<T> {
  if (!/^\d{4}$/.test(code)) throw new Error("房號必須是 4 位數");
  if (process.env.VERCEL && !isSupabase())
    throw new Error(
      "Vercel 需要設定 Supabase URL 與 service role key，才能保存多人房間",
    );
  if (isSupabase()) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const record = await supabaseRequest("rpc/read_party_room", {
        p_code: code,
      });
      const before = JSON.stringify(record?.document ?? null);
      const { room, result } = await fn(record?.document ?? null);
      if (JSON.stringify(room) === before) return result;
      const saved = await supabaseRequest("rpc/save_party_room", {
        p_code: code,
        p_expected: record?.revision ?? -1,
        p_document: room,
      });
      if (saved) return result;
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 25));
    }
    throw new Error("房間同步忙碌中，請重試");
  }
  const unlock = await lock(code);
  try {
    const filename = path.join(dataDir, `${code}.json`);
    let room: Room | null = null;
    try {
      room = JSON.parse(await readFile(filename, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const before = JSON.stringify(room);
    const output = await fn(room);
    const next = JSON.stringify(output.room);
    if (next !== before) {
      const temp = path.join(dataDir, `${code}.${randomUUID()}.tmp`);
      await writeFile(temp, next, { mode: 0o600 });
      await rename(temp, filename);
    }
    return output.result;
  } finally {
    await unlock();
  }
}
let cached: Question[] | null = null;
let loadedAt = 0;
export async function questionBank() {
  if (cached && Date.now() - loadedAt < 30000) return cached;
  let imported: Question[] = [];
  if (isSupabase()) {
    const rows = await supabaseRequest(
      "question_bank?select=document",
      undefined,
      "GET",
    );
    imported = (rows ?? []).map((r: { document: Question }) => r.document);
  } else
    try {
      imported = JSON.parse(
        await readFile(path.join(dataDir, "questions.json"), "utf8"),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  const map = new Map(seedQuestions.map((q) => [q.question_id, q]));
  for (const q of imported) map.set(q.question_id, q);
  cached = [...map.values()];
  loadedAt = Date.now();
  return cached;
}
