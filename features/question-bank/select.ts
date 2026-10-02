import type { GameSettings, Question, GameId } from "../../games/types";
export function selectQuestions(
  bank: Question[],
  gameId: GameId,
  settings: GameSettings,
  used: string[],
  count: number,
) {
  const candidates = bank.filter(
    (q) =>
      q.game_id === gameId &&
      q.enabled &&
      q.review_status === "reviewed" &&
      q.language === "zh-TW" &&
      q.age_rating <= settings.age &&
      q.spice_level <= settings.spice &&
      (q.party_type === "all" || q.party_type === settings.partyType) &&
      (settings.difficulty === "all" || q.difficulty === settings.difficulty) &&
      (settings.mode === "mixed" ||
        q.mode === settings.mode ||
        q.mode === "default"),
  );
  if (!candidates.length)
    throw new Error("這個條件尚無已審核題目，請調整難度或模式");
  const chosen: Question[] = [];
  let previous = "";
  for (let i = 0; i < count; i++) {
    const sorted = candidates
      .map((q) => ({
        q,
        rank:
          (used.includes(q.question_id) ? 10 : 0) +
          (chosen.some((c) => c.question_id === q.question_id) ? 20 : 0) +
          (q.category === previous ? 1 : 0) +
          Math.random(),
      }))
      .sort((a, b) => a.rank - b.rank);
    const q = structuredClone(sorted[0].q);
    for (let j = q.possible_answers.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [q.possible_answers[j], q.possible_answers[k]] = [
        q.possible_answers[k],
        q.possible_answers[j],
      ];
    }
    chosen.push(q);
    previous = q.category;
  }
  return chosen;
}
