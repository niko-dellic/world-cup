export const ROUND_ORDER = [
  "round-of-32",
  "round-of-16",
  "quarterfinals",
  "semifinals",
  "final",
] as const;

export type BracketRound = (typeof ROUND_ORDER)[number];

export type MatchStatus =
  | "scheduled"
  | "live"
  | "completed"
  | "postponed"
  | "unknown";

export type Team = {
  id: string;
  name: string;
  shortName: string;
  countryCode?: string;
  flagEmoji?: string;
  colors: [string, string];
  providerId?: string;
};

export type Match = {
  id: string;
  providerId?: string;
  matchNumber?: number;
  round: BracketRound;
  roundName: string;
  slot: number;
  visualSlot?: number;
  kickoffTime: string | null;
  status: MatchStatus;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeSourceMatchId?: string | null;
  awaySourceMatchId?: string | null;
  homeSourceLabel?: string | null;
  awaySourceLabel?: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  providerData?: Record<string, unknown>;
};

export type BracketData = {
  source: "fotmob" | "seeded" | "static" | "supabase";
  refreshedAt: string;
  matches: Match[];
};

export type PredictionPicks = Record<string, string | null | undefined>;

export type PredictionBracket = {
  id?: string;
  userId: string;
  displayName: string;
  picks: PredictionPicks;
  submittedAt?: string;
  updatedAt: string;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  points: number;
  correctPicks: number;
  possiblePicks: number;
  possiblePoints: number;
  championPick: Team | null;
  submittedAt: string;
  updatedAt: string;
};

export type DisplayMatch = Match & {
  displayHomeTeam: Team | null;
  displayAwayTeam: Team | null;
  isLocked: boolean;
};
