import { describe, expect, it } from "vitest";
import { deriveDisplayMatches } from "@/lib/bracket";
import { createSeedBracket } from "@/lib/seed-data";
import { extractNextData, normalizeFotMobBracket, overlayBracketData } from "@/lib/providers/fotmob";

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
                                matchNumber: 73,
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
      id: "m73",
      matchNumber: 73,
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

  it("overlays provider facts without changing static graph topology", () => {
    const staticBracket = createSeedBracket("2026-06-29T00:00:00.000Z");
    const providerBracket = normalizeFotMobBracket({
      rounds: [
        {
          round: "1/16",
          matchups: [
            {
              id: 500,
              matchNumber: 74,
              homeTeamName: "Germany",
              awayTeamName: "Paraguay",
              homeScore: 2,
              awayScore: 0,
              winnerTeamId: "germany",
              status: "Finished",
            },
          ],
        },
      ],
    });

    const overlaid = overlayBracketData(staticBracket, providerBracket);
    const updated = overlaid.matches.find((match) => match.id === "m74")!;
    const target = overlaid.matches.find((match) => match.id === "m89")!;

    expect(overlaid.matches).toHaveLength(31);
    expect(updated.status).toBe("completed");
    expect(updated.homeScore).toBe(2);
    expect(updated.homeTeam?.id).toBe("germany");
    expect(updated.winnerTeamId).toBe("germany");
    expect(target.homeSourceMatchId).toBe("m74");
    expect(target.awaySourceMatchId).toBe("m77");
  });

  it("maps FotMob playoff draw order onto the static visual slot", () => {
    const staticBracket = createSeedBracket("2026-06-29T00:00:00.000Z");
    const providerBracket = normalizeFotMobBracket({
      rounds: [
        {
          round: "1/16",
          matchups: Array.from({ length: 9 }, (_, index) =>
            index === 8
              ? {
                  homeTeamId: 8256,
                  awayTeamId: 6715,
                  homeTeam: "Brazil",
                  awayTeam: "Japan",
                  homeTeamShortName: "BRA",
                  awayTeamShortName: "JPN",
                  homeScore: 2,
                  awayScore: 1,
                  winner: 8256,
                  status: { finished: true },
                }
              : { homeTeam: `Home ${index + 1}`, awayTeam: `Away ${index + 1}` },
          ),
        },
      ],
    });

    const overlaid = overlayBracketData(staticBracket, providerBracket);
    const display = deriveDisplayMatches(overlaid.matches, {});
    const updated = overlaid.matches.find((match) => match.id === "m76")!;
    const target = overlaid.matches.find((match) => match.id === "m91")!;
    const displayTarget = display.find((match) => match.id === "m91")!;

    expect(updated.status).toBe("completed");
    expect(updated.homeScore).toBe(2);
    expect(updated.awayScore).toBe(1);
    expect(updated.winnerTeamId).toBe("brazil");
    expect(target.homeSourceMatchId).toBe("m76");
    expect(displayTarget.displayHomeTeam?.id).toBe("brazil");
  });
});
