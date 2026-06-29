import type { BracketData, BracketRound, Match, MatchStatus, Team } from "@/lib/types";
import { ROUND_ORDER } from "@/lib/types";
import { createWorldCup2026Bracket } from "@/lib/seed-data";
import { makeTeam, slugifyTeamId } from "@/lib/teams";

const FOTMOB_WORLD_CUP_URL = "https://www.fotmob.com/leagues/77/overview/world-cup";
const FOTMOB_ORIGIN = "https://www.fotmob.com";

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
  const staticBracket = createWorldCup2026Bracket();

  if (process.env.FOOTBALL_DATA_MODE === "seeded") {
    return staticBracket;
  }

  try {
    const response = await fetch(FOTMOB_WORLD_CUP_URL, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "Mozilla/5.0 (compatible; WorldCupBracketVisualizer/0.1; +https://example.com)",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`FotMob returned ${response.status}`);
    }

    const html = await response.text();
    const data = extractNextData(html);
    const normalized = await enrichBracketWithMatchDetails(normalizeFotMobBracket(data));
    if (normalized.matches.length === 0) {
      throw new Error("No knockout matches found in FotMob payload");
    }

    return overlayBracketData(staticBracket, normalized, "fotmob");
  } catch (error) {
    console.warn("[football-provider] Falling back to static World Cup graph", error);
    return staticBracket;
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

  const matchNumber = firstNumber(value, ["matchNumber", "matchNo", "fifaMatchNumber"]);
  const providerId = firstString(value, ["id", "matchId", "eventId"]) ?? `${round}-${slot}`;
  const homeTeam = normalizeTeam(value, "home");
  const awayTeam = normalizeTeam(value, "away");
  const homeScore = firstNumber(value, ["homeScore", "scoreHome", "homeTeamScore"]);
  const awayScore = firstNumber(value, ["awayScore", "scoreAway", "awayTeamScore"]);
  const status = normalizeStatusFromValue(value.status) ?? normalizeStatus(firstString(value, ["statusText", "matchStatus"]));
  const winnerTeamId = normalizeWinnerId(value, homeTeam, awayTeam, homeScore, awayScore, status);

  return {
    id: matchNumber ? `m${matchNumber}` : `${round}-${slot}`,
    providerId,
    matchNumber: matchNumber ?? undefined,
    round,
    roundName: ROUND_NAMES[round],
    slot,
    visualSlot: slot,
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

export function overlayBracketData(
  staticBracket: BracketData,
  providerBracket: BracketData,
  source: BracketData["source"] = providerBracket.source,
): BracketData {
  const providerById = new Map(providerBracket.matches.map((match) => [match.id, match]));
  const providerByMatchNumber = new Map(
    providerBracket.matches
      .filter((match) => typeof match.matchNumber === "number")
      .map((match) => [match.matchNumber, match]),
  );
  const providerByRoundVisualSlot = new Map(
    providerBracket.matches.map((match) => [roundVisualSlotKey(match.round, match.visualSlot ?? match.slot), match]),
  );

  return {
    source,
    refreshedAt: providerBracket.refreshedAt,
    matches: staticBracket.matches.map((staticMatch) => {
      const providerMatch =
        providerById.get(staticMatch.id) ??
        (staticMatch.matchNumber ? providerByMatchNumber.get(staticMatch.matchNumber) : undefined) ??
        providerByRoundVisualSlot.get(roundVisualSlotKey(staticMatch.round, staticMatch.visualSlot ?? staticMatch.slot));

      if (!providerMatch) return staticMatch;

      return {
        ...staticMatch,
        providerId: providerMatch.providerId ?? staticMatch.providerId,
        kickoffTime: providerMatch.kickoffTime ?? staticMatch.kickoffTime,
        status: providerMatch.status === "unknown" ? staticMatch.status : providerMatch.status,
        homeTeam: staticMatch.homeTeam ?? getConcreteProviderTeam(providerMatch, "home"),
        awayTeam: staticMatch.awayTeam ?? getConcreteProviderTeam(providerMatch, "away"),
        homeScore: providerMatch.homeScore ?? staticMatch.homeScore,
        awayScore: providerMatch.awayScore ?? staticMatch.awayScore,
        winnerTeamId: mapProviderWinnerToStaticTeam(staticMatch, providerMatch),
        providerData: {
          ...staticMatch.providerData,
          providerOverlay: providerMatch.providerData ?? providerMatch,
        },
      };
    }),
  };
}

async function enrichBracketWithMatchDetails(bracket: BracketData): Promise<BracketData> {
  const matches = await Promise.all(bracket.matches.map(enrichMatchWithMatchDetails));
  return { ...bracket, matches };
}

async function enrichMatchWithMatchDetails(match: Match): Promise<Match> {
  const sourceMatch = getPrimaryFotMobMatch(match.providerData);
  if (!sourceMatch || !shouldFetchMatchDetails(sourceMatch)) return match;

  const pageUrl = firstString(sourceMatch, ["pageUrl"]);
  if (!pageUrl) return match;

  try {
    const detail = await fetchFotMobMatchDetail(pageUrl);
    if (!detail) return match;

    return {
      ...match,
      kickoffTime: detail.kickoffTime ?? match.kickoffTime,
      status: detail.status === "unknown" ? match.status : detail.status,
      homeScore: detail.homeScore ?? match.homeScore,
      awayScore: detail.awayScore ?? match.awayScore,
      winnerTeamId: detail.winnerTeamId ?? match.winnerTeamId,
      providerData: {
        ...match.providerData,
        matchDetail: detail.providerData,
      },
    };
  } catch (error) {
    console.warn("[football-provider] Could not enrich FotMob match detail", pageUrl, error);
    return match;
  }
}

async function fetchFotMobMatchDetail(pageUrl: string) {
  const url = new URL(pageUrl.split("#")[0], FOTMOB_ORIGIN);
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent":
        "Mozilla/5.0 (compatible; WorldCupBracketVisualizer/0.1; +https://example.com)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`FotMob match detail returned ${response.status}`);
  }

  const payload = extractNextData(await response.text());
  const pageProps = getRecord(getRecord(getRecord(payload)?.props)?.pageProps);
  const general = getRecord(pageProps?.general);
  const header = getRecord(pageProps?.header);
  const teams = getArray(header?.teams);
  const homeTeam = getRecord(teams?.[0]);
  const awayTeam = getRecord(teams?.[1]);
  const statusRecord = getRecord(header?.status);
  const status = normalizeStatusRecord(statusRecord);
  const homeScore = firstNumber(homeTeam ?? {}, ["score"]);
  const awayScore = firstNumber(awayTeam ?? {}, ["score"]);
  const penaltyShootout = extractPenaltyShootoutScore(pageProps);

  return {
    kickoffTime: firstString(statusRecord ?? {}, ["utcTime"]) ?? firstString(general ?? {}, ["matchTimeUTCDate"]),
    status,
    homeScore,
    awayScore,
    winnerTeamId: normalizeWinnerId(
      {},
      normalizeDetailTeam(homeTeam ?? getRecord(general?.homeTeam)),
      normalizeDetailTeam(awayTeam ?? getRecord(general?.awayTeam)),
      homeScore,
      awayScore,
      status,
    ),
    providerData: {
      penaltyShootout,
      general,
      header: {
        teams,
        status: statusRecord,
      },
    },
  };
}

function shouldFetchMatchDetails(sourceMatch: AnyRecord) {
  const status = getRecord(sourceMatch.status);
  return Boolean(status?.started || status?.finished || status?.ongoing);
}

function getPrimaryFotMobMatch(providerData: Record<string, unknown> | undefined) {
  const matches = getArray(providerData?.matches);
  return matches?.map(getRecord).find(Boolean) ?? null;
}

function normalizeDetailTeam(value: AnyRecord | null | undefined): Team | null {
  if (!value) return null;

  const name = firstString(value, ["name"]);
  if (!name) return null;

  const providerId = firstString(value, ["id"]);
  return makeTeam({
    id: providerId ? `team-${providerId}` : undefined,
    name,
    shortName: firstString(value, ["shortName", "name"]) ?? undefined,
    providerId: providerId ?? undefined,
  });
}

function normalizeStatusRecord(status: AnyRecord | null | undefined): MatchStatus {
  if (!status) return "unknown";
  if (status.cancelled) return "postponed";
  if (status.finished) return "completed";
  if (status.started || status.ongoing) return "live";
  return "scheduled";
}

function roundVisualSlotKey(round: BracketRound, visualSlot: number) {
  return `${round}:${visualSlot}`;
}

function extractPenaltyShootoutScore(pageProps: AnyRecord | null) {
  const directScore = findDirectPenaltyShootoutScore(pageProps);
  if (directScore) return directScore;

  let shootoutScore: { homeScore: number; awayScore: number } | null = null;

  walk(pageProps, (value) => {
    if (!isRecord(value)) return;

    const penShootoutScore = getArray(value.penShootoutScore);
    if (!penShootoutScore || penShootoutScore.length < 2) return;

    const homeScore = valueToNumber(penShootoutScore[0]);
    const awayScore = valueToNumber(penShootoutScore[1]);
    if (homeScore === null || awayScore === null) return;

    shootoutScore = { homeScore, awayScore };
  });

  return shootoutScore;
}

function findDirectPenaltyShootoutScore(value: unknown): { homeScore: number; awayScore: number } | null {
  if (!isRecord(value)) return null;

  const homeScore = firstNumber(value, ["homePenaltyScore", "homePenalties", "penaltyHomeScore"]);
  const awayScore = firstNumber(value, ["awayPenaltyScore", "awayPenalties", "penaltyAwayScore"]);
  if (homeScore !== null && awayScore !== null) return { homeScore, awayScore };

  for (const child of Object.values(value)) {
    const score = findDirectPenaltyShootoutScore(child);
    if (score) return score;
  }

  return null;
}

function mapProviderWinnerToStaticTeam(staticMatch: Match, providerMatch: Match) {
  if (!providerMatch.winnerTeamId) return staticMatch.winnerTeamId;
  if (providerMatch.winnerTeamId === providerMatch.homeTeam?.id) {
    return staticMatch.homeTeam?.id ?? providerMatch.winnerTeamId;
  }
  if (providerMatch.winnerTeamId === providerMatch.awayTeam?.id) {
    return staticMatch.awayTeam?.id ?? providerMatch.winnerTeamId;
  }
  return providerMatch.winnerTeamId;
}

function getConcreteProviderTeam(providerMatch: Match, side: "home" | "away") {
  const team = side === "home" ? providerMatch.homeTeam : providerMatch.awayTeam;
  if (!team) return null;

  const providerData = providerMatch.providerData;
  const tbdKey = side === "home" ? "tbdTeam1" : "tbdTeam2";
  if (providerData?.[tbdKey]) return null;
  if (team.shortName === "TBD" || team.name.includes("/")) return null;

  return team;
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
    `${side}Team`,
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
    shortName: firstString(value, [`${side}TeamShortName`, `${side}ShortName`, `${side}Name`]) ?? undefined,
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
  const rawWinner = firstString(value, ["winnerTeamId", "winnerId", "winningTeamId", "aggregatedWinner", "winner"]);
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

function normalizeStatusFromValue(value: unknown): MatchStatus | null {
  if (typeof value === "string" || typeof value === "number") {
    return normalizeStatus(String(value));
  }
  if (isRecord(value)) {
    return normalizeStatusRecord(value);
  }
  return null;
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

function valueToNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
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

function getRecord(value: unknown): AnyRecord | null {
  return isRecord(value) ? value : null;
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
