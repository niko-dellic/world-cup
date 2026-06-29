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
  targetRound: BracketRound;
  targetLocalSlot: number;
  targetMatchSlot: number;
};

export type BracketGridLayout = {
  nodes: BracketNodeLayout[];
  connectors: BracketConnectorLayout[];
};

type MatchLike = {
  id: string;
  round: BracketRound;
  slot: number;
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

const MERGE_STAGES: Array<{
  stage: Exclude<BracketConnectorStage, "semifinals-to-final">;
  sourceRound: SideRound;
  targetRound: SideRound;
}> = [
  {
    stage: "round-of-32-to-round-of-16",
    sourceRound: "round-of-32",
    targetRound: "round-of-16",
  },
  {
    stage: "round-of-16-to-quarterfinals",
    sourceRound: "round-of-16",
    targetRound: "quarterfinals",
  },
  {
    stage: "quarterfinals-to-semifinals",
    sourceRound: "quarterfinals",
    targetRound: "semifinals",
  },
];

export function buildBracketGridLayout(matches: MatchLike[]): BracketGridLayout {
  return {
    nodes: matches
      .map(getNodeLayout)
      .filter((layout): layout is BracketNodeLayout => Boolean(layout)),
    connectors: buildConnectorLayouts(),
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

  const sideSlot = getSideSlot(match.round, match.slot);
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

export function buildConnectorLayouts(): BracketConnectorLayout[] {
  return (["left", "right"] as const).flatMap((side) => [
    ...buildSideMergeConnectors(side),
    buildSemifinalToFinalConnector(side),
  ]);
}

function buildSideMergeConnectors(side: BracketSide): BracketConnectorLayout[] {
  return MERGE_STAGES.flatMap(({ stage, sourceRound, targetRound }) => {
    const targetCount = LOCAL_SLOT_COUNT[targetRound];

    return Array.from({ length: targetCount }, (_, index) => {
      const targetLocalSlot = index + 1;
      const sourceLocalSlots = [targetLocalSlot * 2 - 1, targetLocalSlot * 2];
      const rows = getRows(targetRound, targetLocalSlot);

      return {
        key: `${side}-${stage}-${targetLocalSlot}`,
        side,
        kind: "merge" as const,
        stage,
        column: CONNECTOR_COLUMNS[side][stage],
        ...rows,
        sourceRound,
        sourceLocalSlots,
        sourceMatchSlots: sourceLocalSlots.map((slot) => toGlobalSlot(side, sourceRound, slot)),
        targetRound,
        targetLocalSlot,
        targetMatchSlot: toGlobalSlot(side, targetRound, targetLocalSlot),
      };
    });
  });
}

function buildSemifinalToFinalConnector(side: BracketSide): BracketConnectorLayout {
  return {
    key: `${side}-semifinals-to-final-1`,
    side,
    kind: "single",
    stage: "semifinals-to-final",
    column: CONNECTOR_COLUMNS[side]["semifinals-to-final"],
    rowStart: 1,
    rowSpan: ROW_COUNT,
    sourceRound: "semifinals",
    sourceLocalSlots: [1],
    sourceMatchSlots: [toGlobalSlot(side, "semifinals", 1)],
    targetRound: "final",
    targetLocalSlot: 1,
    targetMatchSlot: 1,
  };
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
