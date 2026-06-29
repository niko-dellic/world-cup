import type { PredictionPicks } from "@/lib/types";

export const OWN_PREDICTION_SOURCE_ID = "self";
export const CURRENT_STANDINGS_SOURCE_ID = "current-standings";

export type ComparisonMode = "slider" | "overlay";
export type ComparisonSide = "a" | "b";
export type ComparisonPickRole = "none" | "shared" | "a-only" | "b-only";

export type PublicPredictionSource = {
  id: string;
  displayName: string;
  picks: PredictionPicks;
};

export type PredictionSource = {
  id: string;
  label: string;
  kind: "current" | "mine" | "public";
  picks: PredictionPicks;
};

export function buildPredictionSources({
  ownPicks,
  publicPredictions,
}: {
  ownPicks: PredictionPicks;
  publicPredictions: PublicPredictionSource[];
}): PredictionSource[] {
  return [
    {
      id: CURRENT_STANDINGS_SOURCE_ID,
      label: "current standings",
      kind: "current",
      picks: {},
    },
    {
      id: OWN_PREDICTION_SOURCE_ID,
      label: "my bracket",
      kind: "mine",
      picks: ownPicks,
    },
    ...publicPredictions.map((prediction) => ({
      id: prediction.id,
      label: prediction.displayName.trim() || "Anonymous",
      kind: "public" as const,
      picks: prediction.picks,
    })),
  ];
}

export function resolvePredictionSource(
  sources: PredictionSource[],
  sourceId: string,
): PredictionSource {
  return (
    sources.find((source) => source.id === sourceId) ??
    sources.find((source) => source.id === CURRENT_STANDINGS_SOURCE_ID) ??
    sources[0] ?? {
      id: CURRENT_STANDINGS_SOURCE_ID,
      label: "current standings",
      kind: "current",
      picks: {},
    }
  );
}

export function getDifferentSourceId(sources: PredictionSource[], sourceId: string): string {
  return sources.find((source) => source.id !== sourceId)?.id ?? sourceId;
}

export function clampComparisonSplit(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

export function getComparisonPickRole({
  teamId,
  sourceATeamId,
  sourceBTeamId,
}: {
  teamId: string | null | undefined;
  sourceATeamId: string | null | undefined;
  sourceBTeamId: string | null | undefined;
}): ComparisonPickRole {
  if (!teamId) return "none";

  const isA = sourceATeamId === teamId;
  const isB = sourceBTeamId === teamId;
  if (isA && isB) return "shared";
  if (isA) return "a-only";
  if (isB) return "b-only";
  return "none";
}

export function getComparisonPickRoleForMatch({
  matchId,
  teamId,
  picksA,
  picksB,
}: {
  matchId: string;
  teamId: string | null | undefined;
  picksA: PredictionPicks;
  picksB: PredictionPicks;
}): ComparisonPickRole {
  return getComparisonPickRole({
    teamId,
    sourceATeamId: picksA[matchId],
    sourceBTeamId: picksB[matchId],
  });
}

export function getComparisonClassNames(role: ComparisonPickRole): string[] {
  if (role === "shared") return ["team-token-compare-shared"];
  if (role === "a-only") return ["team-token-compare-a-only"];
  if (role === "b-only") return ["team-token-compare-b-only"];
  return [];
}
