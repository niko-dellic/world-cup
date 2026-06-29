import { describe, expect, it } from "vitest";
import {
  CURRENT_STANDINGS_SOURCE_ID,
  OWN_PREDICTION_SOURCE_ID,
  buildPredictionSources,
  clampComparisonSplit,
  getComparisonClassNames,
  getComparisonPickRoleForMatch,
  getDifferentSourceId,
  resolvePredictionSource,
} from "@/lib/comparison";

describe("comparison helpers", () => {
  it("resolves current standings, my bracket, and public submissions", () => {
    const sources = buildPredictionSources({
      ownPicks: { m74: "germany" },
      publicPredictions: [
        {
          id: "prediction-1",
          displayName: "N.I.K.O",
          picks: { m74: "paraguay" },
        },
      ],
    });

    expect(resolvePredictionSource(sources, CURRENT_STANDINGS_SOURCE_ID)).toMatchObject({
      kind: "current",
      picks: {},
    });
    expect(resolvePredictionSource(sources, OWN_PREDICTION_SOURCE_ID)).toMatchObject({
      kind: "mine",
      picks: { m74: "germany" },
    });
    expect(resolvePredictionSource(sources, "prediction-1")).toMatchObject({
      kind: "public",
      label: "N.I.K.O",
      picks: { m74: "paraguay" },
    });
  });

  it("chooses a secondary source that is not the primary when possible", () => {
    const sources = buildPredictionSources({ ownPicks: {}, publicPredictions: [] });
    expect(getDifferentSourceId(sources, CURRENT_STANDINGS_SOURCE_ID)).toBe(
      OWN_PREDICTION_SOURCE_ID,
    );
    expect(getDifferentSourceId([sources[0]], CURRENT_STANDINGS_SOURCE_ID)).toBe(
      CURRENT_STANDINGS_SOURCE_ID,
    );
  });

  it("clamps slider split values", () => {
    expect(clampComparisonSplit(-12)).toBe(0);
    expect(clampComparisonSplit(42)).toBe(42);
    expect(clampComparisonSplit(128)).toBe(100);
    expect(clampComparisonSplit(Number.NaN)).toBe(50);
  });

  it("assigns overlay classes for A-only, B-only, and shared picks", () => {
    const picksA = { m74: "germany", m75: "netherlands", m76: "brazil" };
    const picksB = { m74: "germany", m75: "morocco", m76: "japan" };

    expect(
      getComparisonClassNames(
        getComparisonPickRoleForMatch({
          matchId: "m74",
          teamId: "germany",
          picksA,
          picksB,
        }),
      ),
    ).toEqual(["team-token-compare-shared"]);
    expect(
      getComparisonClassNames(
        getComparisonPickRoleForMatch({
          matchId: "m75",
          teamId: "netherlands",
          picksA,
          picksB,
        }),
      ),
    ).toEqual(["team-token-compare-a-only"]);
    expect(
      getComparisonClassNames(
        getComparisonPickRoleForMatch({
          matchId: "m75",
          teamId: "morocco",
          picksA,
          picksB,
        }),
      ),
    ).toEqual(["team-token-compare-b-only"]);
  });
});
