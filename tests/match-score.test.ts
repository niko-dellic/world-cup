import { describe, expect, it } from "vitest";
import { formatTeamScore } from "@/lib/match-score";

describe("match score formatting", () => {
  it("formats regular scores for each side", () => {
    const match = {
      homeScore: 2,
      awayScore: 1,
      providerData: {},
    };

    expect(formatTeamScore(match, "home")).toBe("2");
    expect(formatTeamScore(match, "away")).toBe("1");
  });

  it("includes penalty shootout scores from provider details", () => {
    const match = {
      homeScore: 0,
      awayScore: 0,
      providerData: {
        providerOverlay: {
          matchDetail: {
            penaltyShootout: {
              homeScore: 5,
              awayScore: 4,
            },
          },
        },
      },
    };

    expect(formatTeamScore(match, "home")).toBe("0 [5]");
    expect(formatTeamScore(match, "away")).toBe("0 [4]");
  });

  it("omits scores for unplayed teams", () => {
    const match = {
      homeScore: null,
      awayScore: null,
      providerData: {},
    };

    expect(formatTeamScore(match, "home")).toBeNull();
    expect(formatTeamScore(match, "away")).toBeNull();
  });
});
