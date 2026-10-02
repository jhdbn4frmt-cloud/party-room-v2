import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parseQuestions } from "../scripts/import-questions";
import { canonical, groups } from "../lib/scoring";
it("imports the documented CSV template and rejects duplicate IDs", async () => {
  const csv = await readFile("docs/questions-template.csv", "utf8");
  expect(parseQuestions(csv)).toHaveLength(4);
  const lines = csv.trim().split("\n");
  expect(() => parseQuestions(csv + lines[1] + "\n")).toThrow("重複");
});
it("treats prototype names as ordinary text, not object properties", () => {
  expect(canonical("constructor")).toBe("constructor");
  expect(groups({ a: "__proto__", b: "__proto__" })).toEqual(
    JSON.parse('{"__proto__":["a","b"]}'),
  );
});
