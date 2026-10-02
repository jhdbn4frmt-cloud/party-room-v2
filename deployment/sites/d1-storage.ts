/** Sites port of the recovered v2 storage adapter. Bind DB in the Worker;
 * call createD1Storage(env.DB) from lib/storage/index.ts after Vinext setup.
 * No browser storage, database credentials, or Supabase resource is used.
 */
import type { Room, Question } from "../../games/types";
import { seedQuestions } from "../../features/question-bank/seed";
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Database {
  prepare(sql: string): Statement;
}
export function createD1Storage(db: Database) {
  async function transact<T>(
    code: string,
    fn: (
      room: Room | null,
    ) => { room: Room; result: T } | Promise<{ room: Room; result: T }>,
  ): Promise<T> {
    if (!/^\d{4}$/.test(code)) throw new Error("房號必須是 4 位數");
    for (let attempt = 0; attempt < 30; attempt++) {
      const row = await db
        .prepare("SELECT revision,document FROM party_documents WHERE code=?")
        .bind(code)
        .first<{ revision: number; document: string }>();
      const current = row ? (JSON.parse(row.document) as Room) : null;
      const before = JSON.stringify(current);
      const { room, result } = await fn(current);
      const serialized = JSON.stringify(room);
      if (before === serialized) return result;
      const saved = row
        ? await db
            .prepare(
              "UPDATE party_documents SET revision=revision+1,document=? WHERE code=? AND revision=?",
            )
            .bind(serialized, code, row.revision)
            .run()
        : await db
            .prepare(
              "INSERT OR IGNORE INTO party_documents(code,revision,document) VALUES (?,0,?)",
            )
            .bind(code, serialized)
            .run();
      if (saved.meta.changes === 1) return result;
      await new Promise((resolve) =>
        setTimeout(resolve, 5 + Math.random() * 25),
      );
    }
    throw new Error("房間同步忙碌中，請重試");
  }
  async function questionBank(): Promise<Question[]> {
    const rows = await db
      .prepare("SELECT document FROM party_questions")
      .all<{ document: string }>();
    const merged = new Map(seedQuestions.map((q) => [q.question_id, q]));
    for (const row of rows.results) {
      const q = JSON.parse(row.document) as Question;
      merged.set(q.question_id, q);
    }
    return [...merged.values()];
  }
  return { transact, questionBank };
}
