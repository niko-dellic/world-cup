import { describe, expect, it } from "vitest";
import { buildBracketGridLayout } from "@/lib/bracket-layout";
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
