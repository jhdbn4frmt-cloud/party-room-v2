import SameAnswer from "./same-answer/PlayerView";
import Quiz from "./quiz/PlayerView";
import Commander from "./commander/PlayerView";
import Intel from "./intel-station/PlayerView";
import Music from "./guess-music/PlayerView";
import Lyrics from "./lyrics-melody/PlayerView";
import Street from "./streetview-hunt/PlayerView";
import Werewolf from "./werewolf/PlayerView";
import Likely from "./most-likely/PlayerView";
import Friend from "./friend-sync/PlayerView";
import Story from "./anonymous-story/PlayerView";
import Drawing from "./draw-guess/PlayerView";
export const views = {
  "same-answer": SameAnswer,
  quiz: Quiz,
  commander: Commander,
  "intel-station": Intel,
  "guess-music": Music,
  "lyrics-melody": Lyrics,
  "streetview-hunt": Street,
  werewolf: Werewolf,
  "most-likely": Likely,
  "friend-sync": Friend,
  "anonymous-story": Story,
  "draw-guess": Drawing,
};
