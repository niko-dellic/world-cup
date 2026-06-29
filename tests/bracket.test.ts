import { describe, expect, it } from "vitest";
import {
  applyPick,
  computeLeaderboard,
  deriveDisplayMatches,
  isMatchLocked,
  sanitizePicks,
  scorePrediction,
} from "@/lib/bracket";
import { createSeedBracket } from "@/lib/seed-data";

describe("bracket prediction logic", () => {
  it("contains the visible real knockout graph", () => {
    const matches = createSeedBracket().matches;
    const ids = matches.map((match) => match.id);

    expect(matches).toHaveLength(31);
    expect(ids).not.toContain("m103");
    for (let matchNumber = 73; matchNumber <= 104; matchNumber += 1) {
      if (matchNumber === 103) continue;
      expect(ids).toContain(`m${matchNumber}`);
    }
    expect(
      matches
        .filter((match) => match.round !== "round-of-32")
        .every((match) => match.homeSourceMatchId && match.awaySourceMatchId),
    ).toBe(true);
  });

  it("locks live, completed, and already-started matches", () => {
    const [match] = createSeedBracket().matches;

    expect(isMatchLocked({ ...match, status: "scheduled", kickoffTime: "2026-06-28T16:00:00.000Z" }, new Date("2026-06-28T15:59:59.000Z"))).toBe(
      false,
    );
    expect(isMatchLocked({ ...match, status: "scheduled", kickoffTime: "2026-06-28T16:00:00.000Z" }, new Date("2026-06-28T16:00:00.000Z"))).toBe(
      true,
    );
    expect(isMatchLocked({ ...match, status: "live" })).toBe(true);
    expect(isMatchLocked({ ...match, status: "completed" })).toBe(true);
  });

  it("does not allow retroactive picks for completed real matches", () => {
    const matches = createSeedBracket().matches;
    const completedMatch = matches.find((match) => match.id === "m73")!;

    const picks = applyPick(
      matches,
      {},
      completedMatch.id,
      completedMatch.awayTeam!.id,
      new Date("2026-06-29T12:00:00.000Z"),
    );

    expect(picks).toEqual({});
  });

  it("derives future-round teams from prior picks", () => {
    const matches = createSeedBracket().matches;
    const germanyVsParaguay = matches.find((match) => match.id === "m74")!;
    const franceVsSweden = matches.find((match) => match.id === "m77")!;

    let picks = applyPick(
      matches,
      {},
      germanyVsParaguay.id,
      germanyVsParaguay.homeTeam!.id,
      new Date("2026-06-29T12:00:00.000Z"),
    );
    picks = applyPick(
      matches,
      picks,
      franceVsSweden.id,
      franceVsSweden.awayTeam!.id,
      new Date("2026-06-29T12:00:00.000Z"),
    );

    const derived = deriveDisplayMatches(matches, picks, new Date("2026-06-29T12:00:00.000Z"));
    const roundOf16 = derived.find((match) => match.id === "m89")!;

    expect(roundOf16.displayHomeTeam?.id).toBe(germanyVsParaguay.homeTeam!.id);
    expect(roundOf16.displayAwayTeam?.id).toBe(franceVsSweden.awayTeam!.id);
  });

  it("uses completed real results to advance teams", () => {
    const matches = createSeedBracket().matches;
    const derived = deriveDisplayMatches(matches, {}, new Date("2026-06-29T12:00:00.000Z"));
    const roundOf16 = derived.find((match) => match.id === "m90")!;

    expect(roundOf16.displayHomeTeam?.id).toBe("canada");
  });

  it("does not fall back to adjacent slots for graph-owned matches", () => {
    const matches = createSeedBracket().matches;
    const derived = deriveDisplayMatches(matches, {}, new Date("2026-06-29T12:00:00.000Z"));
    const roundOf16 = derived.find((match) => match.id === "m89")!;

    expect(roundOf16.displayHomeTeam).toBeNull();
    expect(roundOf16.displayAwayTeam).toBeNull();
  });

  it("removes downstream picks when an earlier result changes", () => {
    const matches = createSeedBracket().matches;
    const germanyVsParaguay = matches.find((match) => match.id === "m74")!;
    const franceVsSweden = matches.find((match) => match.id === "m77")!;
    const now = new Date("2026-06-29T12:00:00.000Z");

    let picks = applyPick(matches, {}, germanyVsParaguay.id, germanyVsParaguay.homeTeam!.id, now);
    picks = applyPick(matches, picks, franceVsSweden.id, franceVsSweden.homeTeam!.id, now);
    picks = applyPick(matches, picks, "m89", germanyVsParaguay.homeTeam!.id, now);

    const changed = applyPick(matches, picks, germanyVsParaguay.id, germanyVsParaguay.awayTeam!.id, now);
    const cleaned = sanitizePicks(matches, changed, now);

    expect(cleaned.m89).toBeNull();
  });

  it("scores completed matches with round weighting", () => {
    const matches = createSeedBracket().matches.map((match) =>
      match.id === "m104"
          ? {
              ...match,
              status: "completed" as const,
              winnerTeamId: "some-finalist",
              homeScore: 1,
              awayScore: 0,
            }
          : match,
    );

    const score = scorePrediction(matches, {
      m73: "canada",
      m104: "wrong-finalist",
    });

    expect(score).toEqual({ points: 1, correctPicks: 1, possiblePoints: 17 });
  });

  it("orders leaderboard by points, then correct picks, then oldest update", () => {
    const matches = createSeedBracket().matches;

    const leaderboard = computeLeaderboard(matches, [
      {
        userId: "u2",
        displayName: "Later",
        picks: { m73: "canada" },
        updatedAt: "2026-06-27T12:10:00.000Z",
      },
      {
        userId: "u1",
        displayName: "Earlier",
        picks: { m73: "canada" },
        updatedAt: "2026-06-27T12:00:00.000Z",
      },
    ]);

    expect(leaderboard.map((entry) => entry.userId)).toEqual(["u1", "u2"]);
  });
});
