import { describe, expect, it } from "vitest";
import { extractNextData, normalizeFotMobBracket } from "@/lib/providers/fotmob";

describe("FotMob provider normalization", () => {
  it("extracts Next.js page data", () => {
    const data = extractNextData(
      '<html><script id="__NEXT_DATA__" type="application/json">{"props":{"hello":"world"}}</script></html>',
    );

    expect(data).toEqual({ props: { hello: "world" } });
  });

  it("normalizes playoff rounds and matchups", () => {
    const bracket = normalizeFotMobBracket({
      props: {
        pageProps: {
          dehydratedState: {
            queries: [
              {
                state: {
                  data: {
                    overview: {
                      playoff: {
                        rounds: [
                          {
                            round: "1/16",
                            matchups: [
                              {
                                id: 101,
                                homeTeamName: "Spain",
                                awayTeamName: "Japan",
                                homeTeamId: 1,
                                awayTeamId: 2,
                                homeScore: 2,
                                awayScore: 1,
                                winnerTeamId: 1,
                                status: "Finished",
                                startTime: "2026-06-28T16:00:00.000Z",
                              },
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    });

    expect(bracket.source).toBe("fotmob");
    expect(bracket.matches).toHaveLength(1);
    expect(bracket.matches[0]).toMatchObject({
      id: "round-of-32-1",
      round: "round-of-32",
      status: "completed",
      homeScore: 2,
      awayScore: 1,
      winnerTeamId: "team-1",
    });
    expect(bracket.matches[0].homeTeam?.name).toBe("Spain");
    expect(bracket.matches[0].awayTeam?.name).toBe("Japan");
  });

  it("falls back to positional round names when labels are absent", () => {
    const bracket = normalizeFotMobBracket({
      rounds: [
        { matchups: [{ id: "a", homeTeamName: "A", awayTeamName: "B" }] },
        { matchups: [{ id: "b" }] },
        { matchups: [{ id: "c" }] },
        { matchups: [{ id: "d" }] },
        { matchups: [{ id: "e" }] },
      ],
    });

    expect(bracket.matches.map((match) => match.round)).toEqual([
      "round-of-32",
      "round-of-16",
      "quarterfinals",
      "semifinals",
      "final",
    ]);
  });
});
