import type { BracketData, BracketRound, Match, MatchStatus, Team } from "@/lib/types";
import { ROUND_ORDER } from "@/lib/types";
import { createSeedBracket } from "@/lib/seed-data";
import { makeTeam, slugifyTeamId } from "@/lib/teams";

const FOTMOB_WORLD_CUP_URL = "https://www.fotmob.com/leagues/77/overview/world-cup";

const ROUND_ALIASES: Record<string, BracketRound> = {
  "1/16": "round-of-32",
  "round of 32": "round-of-32",
  "round-of-32": "round-of-32",
  "last 32": "round-of-32",
  "1/8": "round-of-16",
  "round of 16": "round-of-16",
  "round-of-16": "round-of-16",
  "last 16": "round-of-16",
  "quarter-final": "quarterfinals",
  "quarter-finals": "quarterfinals",
  quarterfinal: "quarterfinals",
  quarterfinals: "quarterfinals",
  "semi-final": "semifinals",
  "semi-finals": "semifinals",
  semifinal: "semifinals",
  semifinals: "semifinals",
  final: "final",
};

const ROUND_NAMES: Record<BracketRound, string> = {
  "round-of-32": "Round of 32",
  "round-of-16": "Round of 16",
  quarterfinals: "Quarterfinals",
  semifinals: "Semifinals",
  final: "Final",
};

type AnyRecord = Record<string, unknown>;

export async function fetchWorldCupBracket(): Promise<BracketData> {
  if (process.env.FOOTBALL_DATA_MODE === "seeded") {
    return createSeedBracket();
  }

  try {
    const response = await fetch(FOTMOB_WORLD_CUP_URL, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "Mozilla/5.0 (compatible; WorldCupBracketVisualizer/0.1; +https://example.com)",
      },
      next: { revalidate: 60 * 20 },
    });

    if (!response.ok) {
      throw new Error(`FotMob returned ${response.status}`);
    }

    const html = await response.text();
    const data = extractNextData(html);
    const normalized = normalizeFotMobBracket(data);
    if (normalized.matches.length === 0) {
      throw new Error("No knockout matches found in FotMob payload");
    }

    return normalized;
  } catch (error) {
    console.warn("[football-provider] Falling back to seeded data", error);
    return createSeedBracket();
  }
}

export function extractNextData(html: string): unknown {
  const match = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>(?<json>[\s\S]*?)<\/script>/,
  );
  if (!match?.groups?.json) {
    throw new Error("FotMob page did not include __NEXT_DATA__");
  }

  return JSON.parse(unescapeHtml(match.groups.json));
}

export function normalizeFotMobBracket(payload: unknown): BracketData {
  const roundRecords = findRoundRecords(payload);
  const matches: Match[] = [];

  roundRecords.forEach((roundRecord, roundIndex) => {
    const round = normalizeRound(roundRecord, roundIndex, roundRecords.length);
    if (!round) return;

    const matchupRecords = getArray(roundRecord.matchups) ?? getArray(roundRecord.matches) ?? [];
    matchupRecords.forEach((matchup, index) => {
      const match = normalizeMatchup(matchup, round, index + 1);
      if (match) matches.push(match);
    });
  });

  return {
    source: "fotmob",
    refreshedAt: new Date().toISOString(),
    matches: matches.sort((a, b) => {
      const roundDiff = ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round);
      return roundDiff === 0 ? a.slot - b.slot : roundDiff;
    }),
  };
}

function normalizeMatchup(value: unknown, round: BracketRound, slot: number): Match | null {
  if (!isRecord(value)) return null;

  const providerId = firstString(value, ["id", "matchId", "eventId"]) ?? `${round}-${slot}`;
  const homeTeam = normalizeTeam(value, "home");
  const awayTeam = normalizeTeam(value, "away");
  const homeScore = firstNumber(value, ["homeScore", "scoreHome", "homeTeamScore"]);
  const awayScore = firstNumber(value, ["awayScore", "scoreAway", "awayTeamScore"]);
  const status = normalizeStatus(firstString(value, ["status", "statusText", "matchStatus"]));
  const winnerTeamId = normalizeWinnerId(value, homeTeam, awayTeam, homeScore, awayScore, status);

  return {
    id: `${round}-${slot}`,
    providerId,
    round,
    roundName: ROUND_NAMES[round],
    slot,
    kickoffTime:
      firstString(value, ["startTime", "kickoffTime", "utcTime", "matchTimeUTC", "time"]) ?? null,
    status,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    winnerTeamId,
    providerData: value,
  };
}

function normalizeTeam(value: AnyRecord, side: "home" | "away"): Team | null {
  const directTeam = value[`${side}Team`];
  if (isRecord(directTeam)) {
    const name = firstString(directTeam, ["name", "teamName", "shortName"]);
    if (!name) return null;

    const providerId = firstString(directTeam, ["id", "teamId"]);
    const countryCode = firstString(directTeam, ["ccode", "countryCode", "isoCode"]);
    return makeTeam({
      id: providerId ? `team-${providerId}` : undefined,
      name,
      shortName: firstString(directTeam, ["shortName", "name"]) ?? undefined,
      countryCode: countryCode ?? undefined,
      providerId: providerId ?? undefined,
    });
  }

  const name = firstString(value, [
    `${side}TeamName`,
    `${side}Name`,
    `${side}ShortName`,
    `${side}teamName`,
  ]);
  if (!name) return null;

  const providerId = firstString(value, [`${side}TeamId`, `${side}Id`, `${side}teamId`]);
  const countryCode = firstString(value, [
    `${side}TeamCountryCode`,
    `${side}CountryCode`,
    `${side}CCode`,
    `${side}Ccode`,
  ]);

  return makeTeam({
    id: providerId ? `team-${providerId}` : `team-${slugifyTeamId(name)}`,
    name,
    countryCode: countryCode ?? undefined,
    providerId: providerId ?? undefined,
  });
}

function normalizeWinnerId(
  value: AnyRecord,
  homeTeam: Team | null,
  awayTeam: Team | null,
  homeScore: number | null,
  awayScore: number | null,
  status: MatchStatus,
) {
  const rawWinner = firstString(value, ["winnerTeamId", "winnerId", "winningTeamId"]);
  if (rawWinner) return `team-${rawWinner}`;

  const winnerSide = firstString(value, ["winner", "winningSide"])?.toLowerCase();
  if (winnerSide?.includes("home")) return homeTeam?.id ?? null;
  if (winnerSide?.includes("away")) return awayTeam?.id ?? null;

  if (status === "completed" && homeScore !== null && awayScore !== null && homeScore !== awayScore) {
    return homeScore > awayScore ? homeTeam?.id ?? null : awayTeam?.id ?? null;
  }

  return null;
}

function normalizeStatus(status?: string | null): MatchStatus {
  const value = status?.toLowerCase() ?? "";
  if (["finished", "ft", "after pen.", "after extra time", "completed"].some((token) => value.includes(token))) {
    return "completed";
  }
  if (["live", "half", "1st", "2nd"].some((token) => value.includes(token))) {
    return "live";
  }
  if (["postponed", "cancelled", "canceled"].some((token) => value.includes(token))) {
    return "postponed";
  }
  if (["scheduled", "not started", "fixture"].some((token) => value.includes(token))) {
    return "scheduled";
  }
  return "unknown";
}

function normalizeRound(roundRecord: AnyRecord, index: number, count: number): BracketRound | null {
  const label =
    firstString(roundRecord, ["round", "roundName", "name", "title", "stage"])?.toLowerCase() ?? "";
  if (label && ROUND_ALIASES[label]) return ROUND_ALIASES[label];

  if (count === 5 && ROUND_ORDER[index]) return ROUND_ORDER[index];
  if (count === 4 && ROUND_ORDER[index + 1]) return ROUND_ORDER[index + 1];
  return null;
}

function findRoundRecords(payload: unknown): AnyRecord[] {
  const candidates: AnyRecord[][] = [];

  walk(payload, (value) => {
    if (!isRecord(value)) return;
    const rounds = getArray(value.rounds) ?? getArray(value.playoffRounds);
    if (!rounds) return;

    const roundRecords = rounds.filter(isRecord).filter((round) => {
      const matchups = getArray(round.matchups) ?? getArray(round.matches);
      return Boolean(matchups?.length);
    });

    if (roundRecords.length > 0) candidates.push(roundRecords);
  });

  return candidates.sort((a, b) => b.length - a.length)[0] ?? [];
}

function walk(value: unknown, visit: (value: unknown) => void, depth = 0) {
  if (depth > 12) return;
  visit(value);

  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visit, depth + 1));
    return;
  }

  if (isRecord(value)) {
    Object.values(value).forEach((item) => walk(item, visit, depth + 1));
  }
}

function firstString(record: AnyRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function firstNumber(record: AnyRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function getArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'");
}
