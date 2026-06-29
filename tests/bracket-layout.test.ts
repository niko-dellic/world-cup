import { describe, expect, it } from "vitest";
import {
  buildBracketCircularLayout,
  buildBracketGridLayout,
  buildBracketTeamCircularLayout,
} from "@/lib/bracket-layout";
import { createSeedBracket } from "@/lib/seed-data";

describe("bracket grid layout", () => {
  const layout = buildBracketGridLayout(createSeedBracket().matches);

  it("places eight round-of-32 nodes on each side", () => {
    expect(
      layout.nodes.filter((node) => node.round === "round-of-32" && node.side === "left"),
    ).toHaveLength(8);
    expect(
      layout.nodes.filter((node) => node.round === "round-of-32" && node.side === "right"),
    ).toHaveLength(8);
  });

  it("creates four opening-round connector groups on each side", () => {
    expect(
      layout.connectors.filter(
        (connector) =>
          connector.stage === "round-of-32-to-round-of-16" && connector.side === "left",
      ),
    ).toHaveLength(4);
    expect(
      layout.connectors.filter(
        (connector) =>
          connector.stage === "round-of-32-to-round-of-16" && connector.side === "right",
      ),
    ).toHaveLength(4);
  });

  it("maps Canada vs South Africa to the second left opening connector group", () => {
    const canadaVsSouthAfrica = layout.nodes.find(
      (node) => node.matchId === "m73",
    );
    const connector = layout.connectors.find(
      (candidate) =>
        candidate.stage === "round-of-32-to-round-of-16" &&
        candidate.side === "left" &&
        candidate.sourceMatchIds.includes("m73"),
    );

    expect(canadaVsSouthAfrica?.localSlot).toBe(3);
    expect(connector?.targetLocalSlot).toBe(2);
    expect(connector?.targetMatchId).toBe("m90");
    expect(connector?.sourceMatchIds).toEqual(["m73", "m75"]);
  });

  it("spans the grid final across the centered finalist band", () => {
    const final = layout.nodes.find((node) => node.round === "final");

    expect(final).toMatchObject({
      matchId: "m104",
      side: "center",
      column: "10 / 13",
    });
  });

  it("keeps the semifinal nodes outside the final hover corridor", () => {
    const semifinals = layout.nodes.filter((node) => node.round === "semifinals");
    const finalConnectors = layout.connectors.filter(
      (connector) => connector.stage === "semifinals-to-final",
    );

    expect(semifinals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ side: "left", column: "7" }),
        expect.objectContaining({ side: "right", column: "15" }),
      ]),
    );
    expect(finalConnectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ side: "left", column: "8 / 10" }),
        expect.objectContaining({ side: "right", column: "13 / 15" }),
      ]),
    );
  });

  it("assigns every round-of-32 node to exactly one opening connector group", () => {
    for (const side of ["left", "right"] as const) {
      const openingConnectors = layout.connectors.filter(
        (connector) =>
          connector.stage === "round-of-32-to-round-of-16" && connector.side === side,
      );
      const sourceIds = openingConnectors.flatMap((connector) => connector.sourceMatchIds);

      expect(sourceIds).toHaveLength(8);
      expect(new Set(sourceIds)).toHaveProperty("size", 8);
    }
  });
});

describe("bracket circular layout", () => {
  const layout = buildBracketCircularLayout(createSeedBracket().matches);

  it("places sixteen round-of-32 nodes on the outer ring", () => {
    const openingNodes = layout.nodes.filter((node) => node.round === "round-of-32");

    expect(openingNodes).toHaveLength(16);
    expect(openingNodes.every((node) => node.radius === 45.5)).toBe(true);
  });

  it("respects visual-slot ordering around the outer ring", () => {
    const germanyVsParaguay = layout.nodes.find((node) => node.matchId === "m74");
    const franceVsSweden = layout.nodes.find((node) => node.matchId === "m77");
    const canadaVsSouthAfrica = layout.nodes.find((node) => node.matchId === "m73");

    expect(germanyVsParaguay).toMatchObject({
      visualSlot: 1,
      angle: -90,
    });
    expect(franceVsSweden).toMatchObject({
      visualSlot: 2,
      angle: -67.5,
    });
    expect(canadaVsSouthAfrica).toMatchObject({
      visualSlot: 3,
      angle: -45,
    });
  });

  it("derives later-round positions from source match geometry", () => {
    const germanyVsParaguay = layout.nodes.find((node) => node.matchId === "m74")!;
    const franceVsSweden = layout.nodes.find((node) => node.matchId === "m77")!;
    const roundOf16 = layout.nodes.find((node) => node.matchId === "m89")!;

    expect(roundOf16.angle).toBeCloseTo(
      (germanyVsParaguay.angle + franceVsSweden.angle) / 2,
    );
    expect(roundOf16.radius).toBe(34.5);
  });

  it("centers the final node", () => {
    const final = layout.nodes.find((node) => node.round === "final");

    expect(final).toMatchObject({
      matchId: "m104",
      x: 50,
      y: 50,
      radius: 0,
      side: "center",
      finalTeamSides: ["away", "home"],
    });
  });

  it("routes circular semifinal connectors to finalist points beside the trophy", () => {
    const finalConnector = layout.connectors.find(
      (connector) => connector.stage === "semifinals-to-final",
    );

    expect(finalConnector).toMatchObject({
      kind: "single",
      targetMatchId: "m104",
      targetPoint: {
        x: 50,
        y: 50,
      },
      targetPoints: [
        {
          x: 55.25,
          y: 50,
        },
        {
          x: 44.75,
          y: 50,
        },
      ],
    });
    expect(finalConnector?.sourcePoints[0].x).toBeGreaterThan(50);
    expect(finalConnector?.sourcePoints[1].x).toBeLessThan(50);
  });

  it("creates connector geometry for every sourced match", () => {
    const sourcedMatchCount = createSeedBracket().matches.filter(
      (match) => match.homeSourceMatchId && match.awaySourceMatchId,
    ).length;

    expect(layout.connectors).toHaveLength(sourcedMatchCount);
    expect(
      layout.connectors.every(
        (connector) =>
          connector.sourcePoints.length === 2 &&
          connector.targetPoint.x >= 0 &&
          connector.targetPoint.y >= 0,
      ),
    ).toBe(true);
  });
});

describe("bracket team circular layout", () => {
  const layout = buildBracketTeamCircularLayout(createSeedBracket().matches);

  it("places thirty-two opening participant nodes on the outer ring", () => {
    const openingParticipants = layout.nodes.filter(
      (node) => node.kind === "participant" && node.round === "round-of-32",
    );

    expect(openingParticipants).toHaveLength(32);
    expect(openingParticipants.every((node) => node.radius === 46)).toBe(true);
  });

  it("splits an opening match into individual home and away team nodes", () => {
    const germany = layout.nodes.find((node) => node.key === "team-circular-m74-home");
    const paraguay = layout.nodes.find((node) => node.key === "team-circular-m74-away");
    const connector = layout.connectors.find(
      (candidate) => candidate.targetMatchId === "m74",
    );

    expect(germany).toMatchObject({
      matchId: "m74",
      teamSide: "home",
      angle: -90,
      radius: 46,
    });
    expect(paraguay).toMatchObject({
      matchId: "m74",
      teamSide: "away",
      angle: -78.75,
      radius: 46,
    });
    expect(connector).toMatchObject({
      stage: "teams-to-round-of-32",
      kind: "merge",
      sourceMatchIds: [],
      targetMatchId: "m74",
    });
    expect(connector?.path).toContain("M 50 4");
  });

  it("centers the team circular final and orders finalists by source geometry", () => {
    const final = layout.nodes.find((node) => node.kind === "final");
    const finalConnector = layout.connectors.find(
      (connector) => connector.stage === "semifinals-to-final",
    );

    expect(final).toMatchObject({
      matchId: "m104",
      x: 50,
      y: 50,
      finalTeamSides: ["away", "home"],
    });
    expect(finalConnector).toMatchObject({
      kind: "single",
      targetMatchId: "m104",
      sourceMatchIds: ["m101", "m102"],
    });
    expect(finalConnector?.path).toContain("L 55.25 50");
    expect(finalConnector?.path).toContain("L 44.75 50");
  });
});
