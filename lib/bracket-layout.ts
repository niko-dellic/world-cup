import type { BracketRound } from "@/lib/types";

export type BracketSide = "left" | "right";
export type BracketNodeSide = BracketSide | "center";
export type BracketNodeKind = "outer" | "winner" | "final";
export type BracketConnectorKind = "merge" | "single";
export type BracketConnectorStage =
  | "round-of-32-to-round-of-16"
  | "round-of-16-to-quarterfinals"
  | "quarterfinals-to-semifinals"
  | "semifinals-to-final";

export type BracketNodeLayout = {
  key: string;
  matchId: string;
  round: BracketRound;
  slot: number;
  localSlot: number;
  side: BracketNodeSide;
  kind: BracketNodeKind;
  column: string;
  rowStart: number;
  rowSpan: number;
};

export type BracketConnectorLayout = {
  key: string;
  side: BracketSide;
  kind: BracketConnectorKind;
  stage: BracketConnectorStage;
  column: string;
  rowStart: number;
  rowSpan: number;
  sourceRound: BracketRound;
  sourceLocalSlots: number[];
  sourceMatchSlots: number[];
  sourceMatchIds: string[];
  targetRound: BracketRound;
  targetLocalSlot: number;
  targetMatchSlot: number;
  targetMatchId: string;
};

export type BracketGridLayout = {
  nodes: BracketNodeLayout[];
  connectors: BracketConnectorLayout[];
};

type MatchLike = {
  id: string;
  matchNumber?: number;
  round: BracketRound;
  slot: number;
  visualSlot?: number;
  homeSourceMatchId?: string | null;
  awaySourceMatchId?: string | null;
};

type SideRound = Exclude<BracketRound, "final">;

const ROW_COUNT = 16;

const LOCAL_SLOT_COUNT: Record<SideRound, number> = {
  "round-of-32": 8,
  "round-of-16": 4,
  quarterfinals: 2,
  semifinals: 1,
};

const NODE_COLUMNS: Record<BracketSide, Record<SideRound, string>> = {
  left: {
    "round-of-32": "1",
    "round-of-16": "3",
    quarterfinals: "5",
    semifinals: "7",
  },
  right: {
    semifinals: "11",
    quarterfinals: "13",
    "round-of-16": "15",
    "round-of-32": "17",
  },
};

const CONNECTOR_COLUMNS: Record<BracketSide, Record<BracketConnectorStage, string>> = {
  left: {
    "round-of-32-to-round-of-16": "2",
    "round-of-16-to-quarterfinals": "4",
    "quarterfinals-to-semifinals": "6",
    "semifinals-to-final": "8",
  },
  right: {
    "semifinals-to-final": "10",
    "quarterfinals-to-semifinals": "12",
    "round-of-16-to-quarterfinals": "14",
    "round-of-32-to-round-of-16": "16",
  },
};

export function buildBracketGridLayout(matches: MatchLike[]): BracketGridLayout {
  return {
    nodes: matches
      .map(getNodeLayout)
      .filter((layout): layout is BracketNodeLayout => Boolean(layout)),
    connectors: buildConnectorLayouts(matches),
  };
}

export function getNodeLayout(match: MatchLike): BracketNodeLayout | null {
  if (match.round === "final") {
    return {
      key: "final-1",
      matchId: match.id,
      round: match.round,
      slot: match.slot,
      localSlot: 1,
      side: "center",
      kind: "final",
      column: "9",
      rowStart: 1,
      rowSpan: ROW_COUNT,
    };
  }

  const sideSlot = getSideSlot(match.round, match.visualSlot ?? match.slot);
  if (!sideSlot) return null;

  const rows = getRows(match.round, sideSlot.localSlot);

  return {
    key: `${sideSlot.side}-${match.round}-${sideSlot.localSlot}`,
    matchId: match.id,
    round: match.round,
    slot: match.slot,
    localSlot: sideSlot.localSlot,
    side: sideSlot.side,
    kind: match.round === "round-of-32" ? "outer" : "winner",
    column: NODE_COLUMNS[sideSlot.side][match.round],
    ...rows,
  };
}

export function buildConnectorLayouts(matches: MatchLike[]): BracketConnectorLayout[] {
  const matchesById = new Map(matches.map((match) => [match.id, match]));
  const layoutsById = new Map(
    matches
      .map((match) => [match.id, getNodeLayout(match)] as const)
      .filter((entry): entry is readonly [string, BracketNodeLayout] => Boolean(entry[1])),
  );
  const connectors: BracketConnectorLayout[] = [];

  matches.forEach((targetMatch) => {
    const targetLayout = layoutsById.get(targetMatch.id);
    if (!targetLayout) return;

    const sourceIds = [targetMatch.homeSourceMatchId, targetMatch.awaySourceMatchId].filter(
      (sourceId): sourceId is string => Boolean(sourceId),
    );
    if (sourceIds.length !== 2) return;

    const sourceMatches = sourceIds.map((sourceId) => matchesById.get(sourceId)).filter(Boolean) as MatchLike[];
    const sourceLayouts = sourceIds.map((sourceId) => layoutsById.get(sourceId)).filter(Boolean) as BracketNodeLayout[];
    if (sourceMatches.length !== 2 || sourceLayouts.length !== 2) return;

    if (targetMatch.round === "final") {
      sourceMatches.forEach((sourceMatch, index) => {
        const sourceLayout = sourceLayouts[index];
        if (sourceLayout.side === "center") return;

        connectors.push({
          key: `${sourceLayout.side}-semifinals-to-final-${sourceMatch.id}`,
          side: sourceLayout.side,
          kind: "single",
          stage: "semifinals-to-final",
          column: CONNECTOR_COLUMNS[sourceLayout.side]["semifinals-to-final"],
          rowStart: 1,
          rowSpan: ROW_COUNT,
          sourceRound: sourceMatch.round,
          sourceLocalSlots: [sourceLayout.localSlot],
          sourceMatchSlots: [sourceMatch.matchNumber ?? sourceMatch.slot],
          sourceMatchIds: [sourceMatch.id],
          targetRound: targetMatch.round,
          targetLocalSlot: targetLayout.localSlot,
          targetMatchSlot: targetMatch.matchNumber ?? targetMatch.slot,
          targetMatchId: targetMatch.id,
        });
      });
      return;
    }

    if (targetLayout.side === "center") return;
    if (!sourceLayouts.every((layout) => layout.side === targetLayout.side)) return;

    const stage = getConnectorStage(sourceMatches[0].round, targetMatch.round);
    if (!stage) return;

    connectors.push({
      key: `${targetLayout.side}-${stage}-${targetMatch.id}`,
      side: targetLayout.side,
      kind: "merge",
      stage,
      column: CONNECTOR_COLUMNS[targetLayout.side][stage],
      rowStart: targetLayout.rowStart,
      rowSpan: targetLayout.rowSpan,
      sourceRound: sourceMatches[0].round,
      sourceLocalSlots: sourceLayouts.map((layout) => layout.localSlot),
      sourceMatchSlots: sourceMatches.map((match) => match.matchNumber ?? match.slot),
      sourceMatchIds: sourceMatches.map((match) => match.id),
      targetRound: targetMatch.round,
      targetLocalSlot: targetLayout.localSlot,
      targetMatchSlot: targetMatch.matchNumber ?? targetMatch.slot,
      targetMatchId: targetMatch.id,
    });
  });

  return connectors.sort((a, b) => {
    if (a.side !== b.side) return a.side === "left" ? -1 : 1;
    if (a.stage !== b.stage) return stageOrder(a.stage) - stageOrder(b.stage);
    return a.targetLocalSlot - b.targetLocalSlot;
  });
}

function getRows(round: SideRound, localSlot: number) {
  const rowSpan = ROW_COUNT / LOCAL_SLOT_COUNT[round];
  return {
    rowStart: (localSlot - 1) * rowSpan + 1,
    rowSpan,
  };
}

function getSideSlot(round: SideRound, slot: number): { side: BracketSide; localSlot: number } | null {
  if (round === "round-of-32") {
    if (slot >= 1 && slot <= 8) return { side: "left", localSlot: slot };
    if (slot >= 9 && slot <= 16) return { side: "right", localSlot: slot - 8 };
  }

  if (round === "round-of-16") {
    if (slot >= 1 && slot <= 4) return { side: "left", localSlot: slot };
    if (slot >= 5 && slot <= 8) return { side: "right", localSlot: slot - 4 };
  }

  if (round === "quarterfinals") {
    if (slot >= 1 && slot <= 2) return { side: "left", localSlot: slot };
    if (slot >= 3 && slot <= 4) return { side: "right", localSlot: slot - 2 };
  }

  if (round === "semifinals") {
    if (slot === 1) return { side: "left", localSlot: 1 };
    if (slot === 2) return { side: "right", localSlot: 1 };
  }

  return null;
}

function toGlobalSlot(side: BracketSide, round: SideRound, localSlot: number) {
  if (side === "left") return localSlot;

  if (round === "round-of-32") return localSlot + 8;
  if (round === "round-of-16") return localSlot + 4;
  if (round === "quarterfinals") return localSlot + 2;
  return 2;
}

function getConnectorStage(sourceRound: BracketRound, targetRound: BracketRound): BracketConnectorStage | null {
  if (sourceRound === "round-of-32" && targetRound === "round-of-16") {
    return "round-of-32-to-round-of-16";
  }
  if (sourceRound === "round-of-16" && targetRound === "quarterfinals") {
    return "round-of-16-to-quarterfinals";
  }
  if (sourceRound === "quarterfinals" && targetRound === "semifinals") {
    return "quarterfinals-to-semifinals";
  }
  if (sourceRound === "semifinals" && targetRound === "final") {
    return "semifinals-to-final";
  }
  return null;
}

function stageOrder(stage: BracketConnectorStage) {
  return {
    "round-of-32-to-round-of-16": 0,
    "round-of-16-to-quarterfinals": 1,
    "quarterfinals-to-semifinals": 2,
    "semifinals-to-final": 3,
  }[stage];
}
