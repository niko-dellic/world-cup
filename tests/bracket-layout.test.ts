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

  it("maps Brazil vs Senegal to the second left opening connector group", () => {
    const brazilVsSenegal = layout.nodes.find(
      (node) => node.round === "round-of-32" && node.slot === 3,
    );
    const connector = layout.connectors.find(
      (candidate) =>
        candidate.stage === "round-of-32-to-round-of-16" &&
        candidate.side === "left" &&
        candidate.sourceLocalSlots.includes(brazilVsSenegal!.localSlot),
    );

    expect(brazilVsSenegal?.localSlot).toBe(3);
    expect(connector?.targetLocalSlot).toBe(2);
    expect(connector?.sourceMatchSlots).toEqual([3, 4]);
  });

  it("assigns every round-of-32 node to exactly one opening connector group", () => {
    for (const side of ["left", "right"] as const) {
      const openingConnectors = layout.connectors.filter(
        (connector) =>
          connector.stage === "round-of-32-to-round-of-16" && connector.side === side,
      );
      const localSlots = openingConnectors.flatMap((connector) => connector.sourceLocalSlots);

      expect(localSlots.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(new Set(localSlots)).toHaveProperty("size", 8);
    }
  });
});
