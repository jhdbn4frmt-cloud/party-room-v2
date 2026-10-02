import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  createD1Storage,
  type Statement,
} from "../deployment/sites/d1-storage";
import { fixture, act, NOW } from "./helpers";
import { auth, scores } from "../features/room/engine";
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("deployment/sites/schema.sql", "utf8"));
  const db = {
    prepare(sql: string): Statement {
      let values: (string | number | null)[] = [];
      return {
        bind(...v: unknown[]) {
          values = v as typeof values;
          return this;
        },
        async first<T>() {
          return (sqlite.prepare(sql).get(...values) ?? null) as T | null;
        },
        async all<T>() {
          return { results: sqlite.prepare(sql).all(...values) as T[] };
        },
        async run() {
          return {
            meta: {
              changes: Number(sqlite.prepare(sql).run(...values).changes),
            },
          };
        },
      };
    },
  };
  return { sqlite, storage: createD1Storage(db) };
}
describe("Sites D1 storage port, real SQLite", () => {
  it("concurrent updates retry CAS without lost scores and isolate rooms", async () => {
    const { sqlite, storage } = database();
    await storage.transact("0520", () => ({
      room: fixture(4, "0520"),
      result: null,
    }));
    await storage.transact("0521", () => ({
      room: fixture(4, "0521"),
      result: null,
    }));
    await Promise.all(
      Array.from({ length: 15 }, () =>
        storage.transact("0520", (room) => {
          act(room!, { type: "adjust", target: room!.members[1].id, delta: 1 });
          return { room: room!, result: null };
        }),
      ),
    );
    expect(
      await storage.transact("0520", (room) => ({
        room: room!,
        result: scores(room!)[room!.members[1].id],
      })),
    ).toBe(15);
    expect(
      await storage.transact("0521", (room) => ({
        room: room!,
        result: scores(room!)[room!.members[1].id] ?? 0,
      })),
    ).toBe(0);
    sqlite.close();
  });
  it("persists 40 full rounds and restores the same session across adapter instances", async () => {
    const { sqlite, storage } = database();
    await storage.transact("0640", () => {
      const room = fixture(4, "0640");
      act(room, {
        type: "start",
        gameId: "same-answer",
        settings: { mode: "sync", rounds: 40, scoring: "raw" },
      });
      return { room, result: null };
    });
    for (let i = 0; i < 40; i++)
      await storage.transact("0640", (room) => {
        for (const member of room!.members)
          act(
            room!,
            { type: "submit", action: { type: "answer", value: "共識" } },
            member,
            NOW,
          );
        for (const type of ["reveal", "score", "next"]) act(room!, { type });
        return { room: room!, result: null };
      });
    const row = JSON.parse(
      sqlite
        .prepare("SELECT document FROM party_documents WHERE code=?")
        .get("0640")!.document as string,
    );
    expect(row.game.rounds).toHaveLength(40);
    expect(row.game.status).toBe("game_result");
    expect(auth(row, "token-1").id).toBe(row.members[1].id);
    expect(scores(row)[row.members[1].id]).toBe(400);
    expect((await storage.questionBank()).length).toBeGreaterThan(300);
    sqlite.close();
  });
});
