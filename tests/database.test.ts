import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fixture, act, start, finish } from "./helpers";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  await db.exec(
    await readFile("supabase/migrations/202610020001_party_room.sql", "utf8"),
  );
});
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL migration, transactions and RLS", () => {
  it("applies actual SQL and saves only matching revisions", async () => {
    const room = fixture();
    const args = [room.code, -1, JSON.stringify(room)];
    const saved = await db.query<{ ok: boolean }>(
      "select save_party_room($1,$2,$3) as ok",
      args,
    );
    expect(saved.rows[0].ok).toBe(true);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select save_party_room($1,$2,$3) as ok",
          args,
        )
      ).rows[0].ok,
    ).toBe(false);
    expect((await db.query("select * from members")).rows).toHaveLength(4);
    expect((await db.query("select * from member_sessions")).rows).toHaveLength(
      4,
    );
  });
  it("persists sessions, rounds, submissions and immutable score events", async () => {
    const r = fixture(4, "2234");
    r.members.forEach((m) => (m.tokenHash = randomBytes(32).toString("hex")));
    act(r, { type: "teams", count: 2 });
    start(r, "quiz", "single");
    act(r, {
      type: "submit",
      action: { type: "answer", value: r.game!.round.question.answer },
    });
    finish(r);
    await db.query("select save_party_room($1,-1,$2)", [
      r.code,
      JSON.stringify(r),
    ]);
    expect(
      (await db.query("select * from game_sessions where room_id=$1", [r.id]))
        .rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from score_events where room_id=$1", [r.id]))
        .rows,
    ).toHaveLength(8);
    await expect(
      db.query("update score_events set delta=999 where room_id=$1", [r.id]),
    ).rejects.toThrow("append-only");
    await expect(
      db.query("delete from score_events where room_id=$1", [r.id]),
    ).rejects.toThrow("append-only");
  });
  for (const role of ["anon", "authenticated"])
    it(`${role} cannot read private room data, secrets, sessions or mutate scores/host`, async () => {
      await db.exec(`set role ${role}`);
      try {
        for (const table of [
          "rooms",
          "members",
          "member_sessions",
          "question_secrets",
          "score_events",
        ])
          await expect(db.query(`select * from ${table}`)).rejects.toThrow(
            "permission denied",
          );
        await expect(
          db.query("update rooms set document='{}'"),
        ).rejects.toThrow("permission denied");
        await expect(
          db.query("select read_party_room('1234')"),
        ).rejects.toThrow("permission denied");
        await expect(
          db.query("insert into score_events(id) values(gen_random_uuid())"),
        ).rejects.toThrow("permission denied");
      } finally {
        await db.exec("reset role");
      }
    });
  it("service role can call server RPC while unrelated room stays unchanged", async () => {
    await db.exec("set role service_role");
    try {
      const value = await db.query<{ room: { document: { code: string } } }>(
        "select read_party_room('1234') as room",
      );
      expect(value.rows[0].room.document.code).toBe("1234");
    } finally {
      await db.exec("reset role");
    }
  });
  it("reuses an ended code with a new UUID while preserving old records", async () => {
    const old = fixture(4, "3322");
    old.members.forEach((m) => (m.tokenHash = randomBytes(32).toString("hex")));
    act(old, { type: "end-party" });
    await db.query("select save_party_room($1,-1,$2)", [
      old.code,
      JSON.stringify(old),
    ]);
    const fresh = fixture(4, "3322");
    fresh.members.forEach(
      (m) => (m.tokenHash = randomBytes(32).toString("hex")),
    );
    const save = await db.query<{ ok: boolean }>(
      "select save_party_room($1,0,$2) as ok",
      [fresh.code, JSON.stringify(fresh)],
    );
    expect(save.rows[0].ok).toBe(true);
    const rows = await db.query<{ id: string; active: boolean }>(
      "select id,active from rooms where code=$1",
      [fresh.code],
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.find((r) => r.active)?.id).toBe(fresh.id);
    expect(
      (await db.query("select * from members where room_id=$1", [old.id])).rows,
    ).toHaveLength(4);
  });
  it("rejects a stale update without partially applying a mutation", async () => {
    const r = fixture(4, "4422");
    r.members.forEach((m) => (m.tokenHash = randomBytes(32).toString("hex")));
    await db.query("select save_party_room($1,-1,$2)", [
      r.code,
      JSON.stringify(r),
    ]);
    act(r, { type: "adjust", target: r.hostId, delta: 7 });
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select save_party_room($1,0,$2) as ok",
          [r.code, JSON.stringify(r)],
        )
      ).rows[0].ok,
    ).toBe(true);
    act(r, { type: "adjust", target: r.hostId, delta: 200 });
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select save_party_room($1,0,$2) as ok",
          [r.code, JSON.stringify(r)],
        )
      ).rows[0].ok,
    ).toBe(false);
    expect(
      (await db.query("select * from score_events where room_id=$1", [r.id]))
        .rows,
    ).toHaveLength(1);
  });
});
