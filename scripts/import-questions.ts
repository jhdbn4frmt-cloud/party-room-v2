import "../lib/load-env";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { questionSchema } from "../features/question-bank/schema";
import { seedQuestions } from "../features/question-bank/seed";
import { dataDir, isSupabase, supabaseRequest } from "../lib/storage";
import type { Question } from "../games/types";
export function parseQuestions(csv: string): Question[] {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  }) as Record<string, string>[];
  const ids = new Set<string>();
  return rows.map((r, i) => {
    const json = (key: string, fallback: unknown) =>
      r[key] ? JSON.parse(r[key]) : fallback;
    const q = questionSchema.parse({
      ...r,
      version: +r.version,
      base_score: +r.base_score,
      difficulty_weight: +r.difficulty_weight,
      bonus_cap: +r.bonus_cap,
      age_rating: +r.age_rating,
      spice_level: +r.spice_level,
      usage_count: +(r.usage_count || "0"),
      enabled: r.enabled === "true",
      possible_answers: json("possible_answers", []),
      accepted_aliases: json("accepted_aliases", []),
      metadata: json("metadata", {}),
      media: r.media ? json("media", undefined) : undefined,
    });
    if (ids.has(q.question_id)) throw new Error(`第 ${i + 2} 列題目 ID 重複`);
    ids.add(q.question_id);
    return q;
  });
}
async function main() {
  const file = process.argv.find((a) => a.startsWith("--file="))?.slice(7);
  let questions: Question[];
  if (process.argv.includes("--seed")) questions = seedQuestions;
  else {
    const url = process.env.GOOGLE_SHEET_CSV_URL;
    if (!file && !url)
      throw new Error(
        "請設定 GOOGLE_SHEET_CSV_URL，或使用 --file=docs/questions-template.csv；內建種子不需匯入即可遊玩。",
      );
    let csv: string;
    if (file) csv = await readFile(file, "utf8");
    else {
      const parsed = new URL(url!);
      if (
        parsed.protocol !== "https:" ||
        !["docs.google.com", "docs.googleusercontent.com"].includes(
          parsed.hostname,
        )
      )
        throw new Error("僅接受 Google Sheets 官方 HTTPS CSV 網址");
      const res = await fetch(parsed, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`Google Sheet 回應 ${res.status}`);
      csv = await res.text();
    }
    questions = parseQuestions(csv);
  }
  if (isSupabase()) {
    await supabaseRequest(
      "question_bank?on_conflict=question_id",
      questions.map((q) => ({
        question_id: q.question_id,
        version: q.version,
        enabled: q.enabled,
        document: q,
      })),
      "POST",
    );
    await supabaseRequest(
      "question_secrets?on_conflict=question_id",
      questions.map((q) => ({
        question_id: q.question_id,
        answer: q.answer,
        accepted_aliases: q.accepted_aliases,
        metadata: q.metadata,
      })),
      "POST",
    );
  } else {
    await mkdir(dataDir, { recursive: true });
    let existing: Question[] = [];
    try {
      existing = JSON.parse(
        await readFile(path.join(dataDir, "questions.json"), "utf8"),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const merged = new Map(existing.map((q) => [q.question_id, q]));
    questions.forEach((q) => merged.set(q.question_id, q));
    const temp = path.join(dataDir, "questions.import.tmp");
    await writeFile(temp, JSON.stringify([...merged.values()], null, 2), {
      mode: 0o600,
    });
    await rename(temp, path.join(dataDir, "questions.json"));
  }
  console.log(
    `已驗證並匯入 ${questions.length} 題至 ${isSupabase() ? "Supabase" : "本機題庫"}。現有遊戲不受影響，新遊戲 30 秒內使用更新。`,
  );
}
if (process.argv[1]?.endsWith("import-questions.ts"))
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
