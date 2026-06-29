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
  it("locks live, completed, and already-started matches", () => {
    const [match] = createSeedBracket().matches;

    expect(isMatchLocked({ ...match, kickoffTime: "2026-06-28T16:00:00.000Z" }, new Date("2026-06-28T15:59:59.000Z"))).toBe(
      false,
    );
    expect(isMatchLocked({ ...match, kickoffTime: "2026-06-28T16:00:00.000Z" }, new Date("2026-06-28T16:00:00.000Z"))).toBe(
      true,
    );
    expect(isMatchLocked({ ...match, status: "live" })).toBe(true);
    expect(isMatchLocked({ ...match, status: "completed" })).toBe(true);
  });

  it("derives future-round teams from prior picks", () => {
    const matches = createSeedBracket().matches;
    const openingOne = matches.find((match) => match.id === "round-of-32-1")!;
    const openingTwo = matches.find((match) => match.id === "round-of-32-2")!;

    let picks = applyPick(matches, {}, openingOne.id, openingOne.homeTeam!.id, new Date("2026-06-27T12:00:00.000Z"));
    picks = applyPick(matches, picks, openingTwo.id, openingTwo.awayTeam!.id, new Date("2026-06-27T12:00:00.000Z"));

    const derived = deriveDisplayMatches(matches, picks, new Date("2026-06-27T12:00:00.000Z"));
    const roundOf16 = derived.find((match) => match.id === "round-of-16-1")!;

    expect(roundOf16.displayHomeTeam?.id).toBe(openingOne.homeTeam!.id);
    expect(roundOf16.displayAwayTeam?.id).toBe(openingTwo.awayTeam!.id);
  });

  it("removes downstream picks when an earlier result changes", () => {
    const matches = createSeedBracket().matches;
    const openingOne = matches.find((match) => match.id === "round-of-32-1")!;
    const openingTwo = matches.find((match) => match.id === "round-of-32-2")!;
    const now = new Date("2026-06-27T12:00:00.000Z");

    let picks = applyPick(matches, {}, openingOne.id, openingOne.homeTeam!.id, now);
    picks = applyPick(matches, picks, openingTwo.id, openingTwo.homeTeam!.id, now);
    picks = applyPick(matches, picks, "round-of-16-1", openingOne.homeTeam!.id, now);

    const changed = applyPick(matches, picks, openingOne.id, openingOne.awayTeam!.id, now);
    const cleaned = sanitizePicks(matches, changed, now);

    expect(cleaned["round-of-16-1"]).toBeNull();
  });

  it("scores completed matches with round weighting", () => {
    const matches = createSeedBracket().matches.map((match) =>
      match.id === "round-of-32-1"
        ? {
            ...match,
            status: "completed" as const,
            winnerTeamId: match.homeTeam!.id,
            homeScore: 2,
            awayScore: 1,
          }
        : match.id === "final-1"
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
      "round-of-32-1": matches[0].homeTeam!.id,
      "final-1": "wrong-finalist",
    });

    expect(score).toEqual({ points: 1, correctPicks: 1, possiblePoints: 17 });
  });

  it("orders leaderboard by points, then correct picks, then oldest update", () => {
    const matches = createSeedBracket().matches.map((match) =>
      match.id === "round-of-32-1"
        ? {
            ...match,
            status: "completed" as const,
            winnerTeamId: match.homeTeam!.id,
          }
        : match,
    );

    const leaderboard = computeLeaderboard(matches, [
      {
        userId: "u2",
        displayName: "Later",
        picks: { "round-of-32-1": matches[0].homeTeam!.id },
        updatedAt: "2026-06-27T12:10:00.000Z",
      },
      {
        userId: "u1",
        displayName: "Earlier",
        picks: { "round-of-32-1": matches[0].homeTeam!.id },
        updatedAt: "2026-06-27T12:00:00.000Z",
      },
    ]);

    expect(leaderboard.map((entry) => entry.userId)).toEqual(["u1", "u2"]);
  });
});
