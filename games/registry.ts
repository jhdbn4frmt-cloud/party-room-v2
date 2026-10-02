import { sameAnswer } from "./same-answer/engine";
import { commander } from "./commander/engine";
import { intelStation } from "./intel-station/engine";
import { quiz } from "./quiz/engine";
import { guessMusic } from "./guess-music/engine";
import { lyricsMelody } from "./lyrics-melody/engine";
import { streetviewHunt } from "./streetview-hunt/engine";
import { werewolf } from "./werewolf/engine";
import { mostLikely } from "./most-likely/engine";
import { friendSync } from "./friend-sync/engine";
import { anonymousStory } from "./anonymous-story/engine";
import { drawGuess } from "./draw-guess/engine";
import type { GameId, GameModule } from "./types";
export const modules: Record<GameId, GameModule> = {
  "same-answer": sameAnswer,
  commander,
  "intel-station": intelStation,
  quiz,
  "guess-music": guessMusic,
  "lyrics-melody": lyricsMelody,
  "streetview-hunt": streetviewHunt,
  werewolf,
  "most-likely": mostLikely,
  "friend-sync": friendSync,
  "anonymous-story": anonymousStory,
  "draw-guess": drawGuess,
};
