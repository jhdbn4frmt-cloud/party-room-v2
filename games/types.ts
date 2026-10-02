export type GameId =
  | "same-answer"
  | "commander"
  | "intel-station"
  | "quiz"
  | "guess-music"
  | "lyrics-melody"
  | "streetview-hunt"
  | "werewolf"
  | "most-likely"
  | "friend-sync"
  | "anonymous-story"
  | "draw-guess";
export type Ability =
  | "knowledge"
  | "music"
  | "reaction"
  | "team"
  | "creativity"
  | "memory"
  | "deduction";
export type GameSettings = {
  mode: string;
  team: boolean;
  rounds: number;
  seconds: number;
  scoring: "balanced" | "raw" | "independent";
  competitive: boolean;
  difficulty: string;
  partyType: string;
  age: number;
  spice: number;
  roles?: string[];
};
export type Question = {
  question_id: string;
  version: number;
  game_id: GameId;
  mode: string;
  category: string;
  question: string;
  media?: { url: string; type: "image" | "audio" | "video" };
  possible_answers: string[];
  language: string;
  answer: string;
  accepted_aliases: string[];
  explanation: string;
  judging_rule: string;
  difficulty: "easy" | "normal" | "hard";
  base_score: number;
  difficulty_weight: number;
  bonus_cap: number;
  age_rating: number;
  party_type: string;
  spice_level: number;
  enabled: boolean;
  usage_count: number;
  review_status: "reviewed" | "draft";
  metadata: Record<string, unknown>;
};
export type Submission = {
  values: string[];
  at: number;
  valid: boolean;
  correct?: boolean;
};
export type Round = {
  id: string;
  number: number;
  question: Question;
  phase: string;
  startedAt: number;
  endsAt: number;
  remainingMs?: number;
  submissions: Record<string, Submission>;
  data: Record<string, unknown>;
  judgments: Record<string, boolean>;
  merges: [string, string][];
  resolved: boolean;
};
export type Member = {
  id: string;
  name: string;
  normalized: string;
  emoji: string;
  joinedAt: number;
  lastSeen: number;
  ready: boolean;
  teamId: string | null;
  locked: boolean;
  waiting: boolean;
  removed: boolean;
  tokenHash: string;
  abilities: Partial<Record<Ability, number>>;
};
export type Team = { id: string; name: string; emoji: string; color: string };
export type Game = {
  id: string;
  gameId: GameId;
  settings: GameSettings;
  status:
    "collecting" | "revealing" | "round_result" | "game_result" | "paused";
  previousStatus?: "collecting" | "revealing" | "round_result";
  roster: string[];
  teamSnapshot: Record<string, string | null>;
  round: Round;
  rounds: Round[];
  raw: Record<string, number>;
  max: Record<string, number>;
  startedAt: number;
  finishedAt?: number;
  data: Record<string, unknown>;
};
export type ScoreEvent = {
  id: string;
  roomId: string;
  gameSessionId: string | null;
  roundId: string | null;
  target: string;
  layer: "raw" | "party";
  delta: number;
  reason: string;
  operator: string;
  ruleVersion: string;
  timestamp: number;
  inverseOf?: string;
};
export type Room = {
  id: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  revision: number;
  hostId: string;
  status: "lobby" | "playing" | "ended";
  allowJoin: boolean;
  members: Member[];
  teams: Team[];
  playlist: { gameId: GameId; mode: string }[];
  game: Game | null;
  history: Game[];
  ledger: ScoreEvent[];
  usedQuestions: string[];
  pairings: Record<string, number>;
  skillEvents?: {
    id: string;
    memberId: string;
    gameId: string;
    roundId: string;
    ability: Ability;
    value: number;
  }[];
  requests: string[];
  election: {
    round: number;
    votes: Record<string, string>;
    candidates: string[];
    endsAt: number;
  } | null;
  events: { id: string; text: string; at: number }[];
};
export type GameContext = { room: Room; game: Game; round: Round; now: number };
export type GameAction = {
  type: string;
  value?: string;
  values?: string[];
  target?: string;
  points?: number[][];
  tool?: string;
};
export type Result = {
  scores: Record<string, number>;
  max: number;
  summary: unknown;
  unscored?: boolean;
};
export interface GameModule {
  id: GameId;
  ability: Ability;
  createRound(ctx: Omit<GameContext, "round">, question: Question): Round;
  submit(ctx: GameContext, member: Member, action: GameAction): void;
  advance?(ctx: GameContext): boolean;
  resolve(ctx: GameContext): Result;
  publicData(ctx: GameContext): Record<string, unknown>;
  privateData(ctx: GameContext, member: Member): Record<string, unknown>;
}
export type GameCard = {
  id: GameId;
  name: string;
  description: string;
  category: string;
  emoji: string;
  color: string;
  minPlayers: number;
  maxPlayers: number;
  supportsIndividual: boolean;
  supportsTeam: boolean;
  minutes: string;
  difficulty: string;
  modes: { id: string; name: string }[];
  assisted?: boolean;
};
