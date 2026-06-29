import type { Match } from "@/lib/types";

type ScoreSide = "home" | "away";
type AnyRecord = Record<string, unknown>;

export type PenaltyShootoutScore = {
  homeScore: number;
  awayScore: number;
};

export function formatTeamScore(match: Pick<Match, "homeScore" | "awayScore" | "providerData">, side: ScoreSide) {
  const score = side === "home" ? match.homeScore : match.awayScore;
  if (score === null) return null;

  const penalties = getPenaltyShootoutScore(match.providerData);
  const penaltyScore = penalties ? (side === "home" ? penalties.homeScore : penalties.awayScore) : null;

  return penaltyScore === null ? String(score) : `${score} [${penaltyScore}]`;
}

export function getPenaltyShootoutScore(providerData: Match["providerData"]): PenaltyShootoutScore | null {
  const matchDetail = getRecord(getRecord(providerData?.providerOverlay)?.matchDetail) ?? getRecord(providerData?.matchDetail);
  const penaltyShootout = getRecord(matchDetail?.penaltyShootout) ?? getRecord(providerData?.penaltyShootout);
  const homeScore = firstNumber(penaltyShootout, ["homeScore", "homePenaltyScore", "homePenalties"]);
  const awayScore = firstNumber(penaltyShootout, ["awayScore", "awayPenaltyScore", "awayPenalties"]);

  if (homeScore === null || awayScore === null) return null;
  return { homeScore, awayScore };
}

function firstNumber(record: AnyRecord | null | undefined, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

function getRecord(value: unknown): AnyRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as AnyRecord : null;
}
