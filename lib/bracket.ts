import type {
  BracketRound,
  DisplayMatch,
  LeaderboardEntry,
  Match,
  PredictionBracket,
  PredictionPicks,
  Team,
} from "@/lib/types";
import { ROUND_ORDER } from "@/lib/types";

export const ROUND_LABELS: Record<BracketRound, string> = {
  "round-of-32": "Round of 32",
  "round-of-16": "Round of 16",
  quarterfinals: "Quarterfinals",
  semifinals: "Semifinals",
  final: "Final",
};

export const ROUND_WEIGHTS: Record<BracketRound, number> = {
  "round-of-32": 1,
  "round-of-16": 2,
  quarterfinals: 4,
  semifinals: 8,
  final: 16,
};

const PRIOR_ROUND: Partial<Record<BracketRound, BracketRound>> = {
  "round-of-16": "round-of-32",
  quarterfinals: "round-of-16",
  semifinals: "quarterfinals",
  final: "semifinals",
};

export function roundIndex(round: BracketRound): number {
  return ROUND_ORDER.indexOf(round);
}

export function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const byRound = roundIndex(a.round) - roundIndex(b.round);
    return byRound === 0 ? a.slot - b.slot : byRound;
  });
}

export function groupMatchesByRound(matches: Match[]): Record<BracketRound, Match[]> {
  return ROUND_ORDER.reduce(
    (acc, round) => {
      acc[round] = sortMatches(matches).filter((match) => match.round === round);
      return acc;
    },
    {} as Record<BracketRound, Match[]>,
  );
}

export function isMatchLocked(match: Match, now = new Date()): boolean {
  if (match.status === "completed" || match.status === "live") return true;
  if (!match.kickoffTime) return false;
  return new Date(match.kickoffTime).getTime() <= now.getTime();
}

export function getSelectableTeams(match: DisplayMatch): Team[] {
  return [match.displayHomeTeam, match.displayAwayTeam].filter(Boolean) as Team[];
}

function findTeamInMatch(match: DisplayMatch, teamId: string | null | undefined) {
  if (!teamId) return null;
  return getSelectableTeams(match).find((team) => team.id === teamId) ?? null;
}

function getMatchByRoundSlot(matches: Match[], round: BracketRound, slot: number) {
  return matches.find((match) => match.round === round && match.slot === slot) ?? null;
}

function getMatchById(matches: Match[], id: string | null | undefined) {
  if (!id) return null;
  return matches.find((match) => match.id === id) ?? null;
}

function getMatchBySource(
  matches: Match[],
  match: Match,
  side: "home" | "away",
  now: Date,
  picks: PredictionPicks,
) {
  const sourceMatchId = side === "home" ? match.homeSourceMatchId : match.awaySourceMatchId;
  const sourceMatch = getMatchById(matches, sourceMatchId);
  if (!sourceMatch) return null;

  const displaySourceMatch = deriveDisplayMatch(sourceMatch, matches, picks, now);
  const actualWinner = findTeamInMatch(displaySourceMatch, sourceMatch.winnerTeamId);
  if (actualWinner) return actualWinner;

  return findTeamInMatch(displaySourceMatch, picks[sourceMatch.id]);
}

function deriveTeamFromPriorSlot(
  matches: Match[],
  picks: PredictionPicks,
  priorRound: BracketRound,
  priorSlot: number,
  now: Date,
): Team | null {
  const priorMatch = getMatchByRoundSlot(matches, priorRound, priorSlot);
  if (!priorMatch) return null;

  const displayPriorMatch = deriveDisplayMatch(priorMatch, matches, picks, now);
  const actualWinner = findTeamInMatch(displayPriorMatch, priorMatch.winnerTeamId);
  if (actualWinner) return actualWinner;

  return findTeamInMatch(displayPriorMatch, picks[priorMatch.id]);
}

export function deriveDisplayMatch(
  match: Match,
  matches: Match[],
  picks: PredictionPicks,
  now = new Date(),
): DisplayMatch {
  let displayHomeTeam = match.homeTeam;
  let displayAwayTeam = match.awayTeam;
  const priorRound = PRIOR_ROUND[match.round];
  const hasGraphSources = Boolean(match.homeSourceMatchId || match.awaySourceMatchId);

  displayHomeTeam ??= getMatchBySource(matches, match, "home", now, picks);
  displayAwayTeam ??= getMatchBySource(matches, match, "away", now, picks);

  if (!hasGraphSources && priorRound && (!displayHomeTeam || !displayAwayTeam)) {
    const firstPriorSlot = (match.slot - 1) * 2 + 1;
    displayHomeTeam ??= deriveTeamFromPriorSlot(matches, picks, priorRound, firstPriorSlot, now);
    displayAwayTeam ??= deriveTeamFromPriorSlot(matches, picks, priorRound, firstPriorSlot + 1, now);
  }

  return {
    ...match,
    displayHomeTeam,
    displayAwayTeam,
    isLocked: isMatchLocked(match, now),
  };
}

export function deriveDisplayMatches(
  matches: Match[],
  picks: PredictionPicks,
  now = new Date(),
): DisplayMatch[] {
  return sortMatches(matches).map((match) => deriveDisplayMatch(match, matches, picks, now));
}

export function sanitizePicks(
  matches: Match[],
  picks: PredictionPicks,
  now = new Date(),
): PredictionPicks {
  let nextPicks = { ...picks };
  let changed = true;

  while (changed) {
    changed = false;
    const displayMatches = deriveDisplayMatches(matches, nextPicks, now);

    for (const match of displayMatches) {
      const pick = nextPicks[match.id];
      if (!pick) continue;

      const selectable = getSelectableTeams(match);
      if (!selectable.some((team) => team.id === pick)) {
        nextPicks = { ...nextPicks, [match.id]: null };
        changed = true;
      }
    }
  }

  return nextPicks;
}

export function applyPick(
  matches: Match[],
  currentPicks: PredictionPicks,
  matchId: string,
  teamId: string,
  now = new Date(),
): PredictionPicks {
  const match = matches.find((candidate) => candidate.id === matchId);
  if (!match || isMatchLocked(match, now)) return currentPicks;

  const nextPicks = { ...currentPicks, [matchId]: teamId };
  return sanitizePicks(matches, nextPicks, now);
}

function parseTimestamp(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function wasMatchOpenWhenSubmitted(match: Match, submittedAt: string | Date | null | undefined) {
  const submittedTime = parseTimestamp(submittedAt);
  if (submittedTime === null || !match.kickoffTime) return true;

  const kickoffTime = parseTimestamp(match.kickoffTime);
  if (kickoffTime === null) return true;

  return submittedTime < kickoffTime;
}

export function scorePrediction(
  matches: Match[],
  picks: PredictionPicks,
  submittedAt?: string | Date | null,
) {
  let points = 0;
  let correctPicks = 0;
  let possiblePicks = 0;
  let possiblePoints = 0;

  for (const match of matches) {
    const weight = ROUND_WEIGHTS[match.round];
    if (
      match.status === "completed" &&
      match.winnerTeamId &&
      wasMatchOpenWhenSubmitted(match, submittedAt)
    ) {
      possiblePicks += 1;
      possiblePoints += weight;
      if (picks[match.id] === match.winnerTeamId) {
        points += weight;
        correctPicks += 1;
      }
    }
  }

  return { points, correctPicks, possiblePicks, possiblePoints };
}

export function computeLeaderboard(
  matches: Match[],
  predictions: PredictionBracket[],
): LeaderboardEntry[] {
  const finalMatch = matches.find((match) => match.round === "final") ?? null;
  const displayMatches = deriveDisplayMatches(matches, {});
  const finalDisplayMatch = finalMatch
    ? displayMatches.find((match) => match.id === finalMatch.id) ?? null
    : null;

  const entries = predictions.map((prediction) => {
    const submittedAt = prediction.submittedAt ?? prediction.updatedAt;
    const score = scorePrediction(matches, prediction.picks, submittedAt);
    const championPick = finalDisplayMatch
      ? findTeamInMatch(finalDisplayMatch, prediction.picks[finalDisplayMatch.id])
      : null;

    return {
      rank: 0,
      userId: prediction.userId,
      displayName: prediction.displayName,
      submittedAt,
      updatedAt: prediction.updatedAt,
      championPick,
      ...score,
    };
  });

  return entries
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.correctPicks !== a.correctPicks) return b.correctPicks - a.correctPicks;
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
