import { z } from "zod";
import { catalog } from "../../games/catalog";
export const questionSchema = z
  .object({
    question_id: z.string().min(1).max(100),
    version: z.number().int().positive(),
    game_id: z.enum([
      "same-answer",
      "commander",
      "intel-station",
      "quiz",
      "guess-music",
      "lyrics-melody",
      "streetview-hunt",
      "werewolf",
      "most-likely",
      "friend-sync",
      "anonymous-story",
      "draw-guess",
    ]),
    mode: z.string(),
    category: z.string(),
    question: z.string().min(1).max(1000),
    media: z
      .object({
        url: z
          .url()
          .refine((v) => v.startsWith("https://"), "Media must use HTTPS"),
        type: z.enum(["image", "audio", "video"]),
      })
      .optional(),
    possible_answers: z.array(z.string()),
    language: z.literal("zh-TW"),
    answer: z.string(),
    accepted_aliases: z.array(z.string()),
    explanation: z.string(),
    judging_rule: z.string(),
    difficulty: z.enum(["easy", "normal", "hard"]),
    base_score: z.number().min(0).max(1000),
    difficulty_weight: z.number().min(0).max(10),
    bonus_cap: z.number().min(0).max(100),
    age_rating: z.number().int().min(0).max(120),
    party_type: z.string(),
    spice_level: z.number().int().min(0).max(3),
    enabled: z.boolean(),
    usage_count: z.number().int().nonnegative(),
    review_status: z.enum(["reviewed", "draft"]),
    metadata: z.record(z.string(), z.unknown()),
  })
  .superRefine((q, ctx) => {
    const card = catalog.find((c) => c.id === q.game_id);
    if (!card?.modes.some((m) => m.id === q.mode))
      ctx.addIssue({ code: "custom", message: "Unknown game mode" });
    if (
      q.game_id === "quiz" &&
      ["single", "boolean"].includes(q.mode) &&
      !q.possible_answers.includes(q.answer)
    )
      ctx.addIssue({
        code: "custom",
        message: "Correct answer must exist in options",
      });
    if (
      q.game_id === "intel-station" &&
      (!Array.isArray(q.metadata.questions) ||
        q.metadata.questions.length !== 3 ||
        typeof q.metadata.passage !== "string")
    )
      ctx.addIssue({
        code: "custom",
        message: "Intel requires passage and three questions",
      });
  });
