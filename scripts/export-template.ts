import { writeFile } from "node:fs/promises";
import { seedQuestions } from "../features/question-bank/seed";
const keys = Object.keys(seedQuestions[0]);
const cell = (v: unknown) =>
  `"${(typeof v === "object" ? JSON.stringify(v) : String(v ?? "")).replaceAll('"', '""')}"`;
const samples = ["same-answer", "quiz", "intel-station", "guess-music"].map(
  (id) => seedQuestions.find((q) => q.game_id === id)!,
);
await writeFile(
  "docs/questions-template.csv",
  "\uFEFF" +
    keys.map(cell).join(",") +
    "\n" +
    samples
      .map((q) => keys.map((k) => cell(q[k as keyof typeof q])).join(","))
      .join("\n") +
    "\n",
);
console.log("CSV template written");
