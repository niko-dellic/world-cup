import { ROUND_ORDER, type BracketRound } from "@/lib/types";

export type BracketSide = "left" | "right";
export type BracketNodeSide = BracketSide | "center";
export type BracketNodeKind = "outer" | "winner" | "final";
export type BracketConnectorKind = "merge" | "single";
export type BracketMatchSide = "home" | "away";
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

export type BracketCircularPoint = {
  x: number;
  y: number;
  angle: number;
  radius: number;
};

export type BracketCircularNodeLayout = {
  key: string;
  matchId: string;
  round: BracketRound;
  slot: number;
  visualSlot: number;
  localSlot: number;
  side: BracketNodeSide;
  kind: BracketNodeKind;
  finalTeamSides?: [BracketMatchSide, BracketMatchSide];
} & BracketCircularPoint;

export type BracketCircularConnectorLayout = {
  key: string;
  kind: BracketConnectorKind;
  stage: BracketConnectorStage;
  sourceRound: BracketRound;
  sourceLocalSlots: number[];
  sourceMatchSlots: number[];
  sourceMatchIds: string[];
  sourcePoints: [BracketCircularPoint, BracketCircularPoint];
  jointPoint: BracketCircularPoint;
  targetRound: BracketRound;
  targetLocalSlot: number;
  targetMatchSlot: number;
  targetMatchId: string;
  targetPoint: BracketCircularPoint;
  targetPoints?: [BracketCircularPoint, BracketCircularPoint];
};

export type BracketCircularLayout = {
  nodes: BracketCircularNodeLayout[];
  connectors: BracketCircularConnectorLayout[];
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
const CIRCULAR_CENTER = 50;
const CIRCULAR_OUTER_MATCH_COUNT = 16;
const CIRCULAR_FINALIST_OFFSET = 5.25;

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
    semifinals: "15",
    quarterfinals: "17",
    "round-of-16": "19",
    "round-of-32": "21",
  },
};

const CONNECTOR_COLUMNS: Record<BracketSide, Record<BracketConnectorStage, string>> = {
  left: {
    "round-of-32-to-round-of-16": "2",
    "round-of-16-to-quarterfinals": "4",
    "quarterfinals-to-semifinals": "6",
    "semifinals-to-final": "8 / 10",
  },
  right: {
    "semifinals-to-final": "13 / 15",
    "quarterfinals-to-semifinals": "16",
    "round-of-16-to-quarterfinals": "18",
    "round-of-32-to-round-of-16": "20",
  },
};

const CIRCULAR_NODE_RADIUS: Record<BracketRound, number> = {
  "round-of-32": 45.5,
  "round-of-16": 34.5,
  quarterfinals: 24,
  semifinals: 14,
  final: 0,
};

const CIRCULAR_FALLBACK_SLOT_COUNT: Record<BracketRound, number> = {
  "round-of-32": 16,
  "round-of-16": 8,
  quarterfinals: 4,
  semifinals: 2,
  final: 1,
};

export function buildBracketGridLayout(matches: MatchLike[]): BracketGridLayout {
  return {
    nodes: matches
      .map(getNodeLayout)
      .filter((layout): layout is BracketNodeLayout => Boolean(layout)),
    connectors: buildConnectorLayouts(matches),
  };
}

export function buildBracketCircularLayout(matches: MatchLike[]): BracketCircularLayout {
  const sortedMatches = [...matches].sort((a, b) => {
    const roundDiff = ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round);
    return roundDiff === 0
      ? (a.visualSlot ?? a.slot) - (b.visualSlot ?? b.slot)
      : roundDiff;
  });
  const matchesById = new Map(matches.map((match) => [match.id, match]));
  const nodesById = new Map<string, BracketCircularNodeLayout>();

  const nodes = sortedMatches
    .map((match) => {
      const sourceNodes = [match.homeSourceMatchId, match.awaySourceMatchId]
        .filter((sourceId): sourceId is string => Boolean(sourceId))
        .map((sourceId) => nodesById.get(sourceId))
        .filter((layout): layout is BracketCircularNodeLayout => Boolean(layout));
      const node = getCircularNodeLayout(match, sourceNodes);
      nodesById.set(match.id, node);
      return node;
    })
    .sort((a, b) => {
      const roundDiff = ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round);
      return roundDiff === 0 ? a.localSlot - b.localSlot : roundDiff;
    });

  const connectors = sortedMatches
    .flatMap<BracketCircularConnectorLayout>((targetMatch) => {
      const targetNode = nodesById.get(targetMatch.id);
      if (!targetNode) return [];

      const sourceIds = [targetMatch.homeSourceMatchId, targetMatch.awaySourceMatchId].filter(
        (sourceId): sourceId is string => Boolean(sourceId),
      );
      if (sourceIds.length !== 2) return [];

      const sourceMatches = sourceIds.map((sourceId) => matchesById.get(sourceId));
      const sourceNodes = sourceIds.map((sourceId) => nodesById.get(sourceId));
      if (!sourceMatches.every(Boolean) || !sourceNodes.every(Boolean)) return [];

      const sourceMatchLayouts = sourceMatches as [MatchLike, MatchLike];
      const sourceNodeLayouts = sourceNodes as [
        BracketCircularNodeLayout,
        BracketCircularNodeLayout,
      ];
      const stage = getConnectorStage(sourceMatchLayouts[0].round, targetMatch.round);
      if (!stage) return [];

      const isFinalConnector = targetMatch.round === "final";
      const sourceRadius =
        sourceNodeLayouts.reduce((total, sourceNode) => total + sourceNode.radius, 0) /
        sourceNodeLayouts.length;
      const jointRadius = (sourceRadius + targetNode.radius) / 2;
      const jointPoint = pointOnCircle(targetNode.angle, jointRadius);
      const targetPoints = isFinalConnector
        ? getCircularFinalistPoints(sourceNodeLayouts)
        : undefined;

      return [
        {
          key: `circular-${stage}-${targetMatch.id}`,
          kind: isFinalConnector ? "single" : "merge",
          stage,
          sourceRound: sourceMatchLayouts[0].round,
          sourceLocalSlots: sourceNodeLayouts.map((layout) => layout.localSlot),
          sourceMatchSlots: sourceMatchLayouts.map((match) => match.matchNumber ?? match.slot),
          sourceMatchIds: sourceMatchLayouts.map((match) => match.id),
          sourcePoints: sourceNodeLayouts.map(toCircularPoint) as [
            BracketCircularPoint,
            BracketCircularPoint,
          ],
          jointPoint,
          targetRound: targetMatch.round,
          targetLocalSlot: targetNode.localSlot,
          targetMatchSlot: targetMatch.matchNumber ?? targetMatch.slot,
          targetMatchId: targetMatch.id,
          targetPoint: toCircularPoint(targetNode),
          ...(targetPoints ? { targetPoints } : {}),
        } satisfies BracketCircularConnectorLayout,
      ];
    })
    .sort((a, b) => {
      if (a.stage !== b.stage) return stageOrder(a.stage) - stageOrder(b.stage);
      return a.targetLocalSlot - b.targetLocalSlot;
    });

  return { nodes, connectors };
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
      column: "10 / 13",
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

function getCircularNodeLayout(
  match: MatchLike,
  sourceNodes: BracketCircularNodeLayout[],
): BracketCircularNodeLayout {
  const radius = CIRCULAR_NODE_RADIUS[match.round];
  const localSlot = match.visualSlot ?? match.slot;
  const angle =
    match.round === "final"
      ? 0
      : match.round === "round-of-32"
      ? slotToAngle(normalizeOuterSlot(localSlot), CIRCULAR_OUTER_MATCH_COUNT)
      : sourceNodes.length === 2
        ? circularMean(sourceNodes.map((sourceNode) => sourceNode.angle))
        : slotToAngle(localSlot, CIRCULAR_FALLBACK_SLOT_COUNT[match.round]);
  const point = pointOnCircle(angle, radius);
  const finalTeamSides =
    match.round === "final" && sourceNodes.length === 2
      ? getCircularFinalTeamSides(sourceNodes)
      : undefined;

  return {
    key: `circular-${match.round}-${localSlot}`,
    matchId: match.id,
    round: match.round,
    slot: match.slot,
    visualSlot: localSlot,
    localSlot,
    side: getCircularNodeSide(point.x, radius),
    kind:
      match.round === "final"
        ? "final"
        : match.round === "round-of-32"
          ? "outer"
          : "winner",
    ...(finalTeamSides ? { finalTeamSides } : {}),
    ...point,
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

function normalizeOuterSlot(slot: number) {
  return ((slot - 1) % CIRCULAR_OUTER_MATCH_COUNT) + 1;
}

function slotToAngle(slot: number, slotCount: number) {
  return -90 + ((slot - 1) * 360) / slotCount;
}

function pointOnCircle(angle: number, radius: number): BracketCircularPoint {
  const radians = (angle * Math.PI) / 180;
  return {
    x: roundCoordinate(CIRCULAR_CENTER + Math.cos(radians) * radius),
    y: roundCoordinate(CIRCULAR_CENTER + Math.sin(radians) * radius),
    angle: roundCoordinate(angle),
    radius,
  };
}

function circularMean(angles: number[]) {
  const radians = angles.map((angle) => (angle * Math.PI) / 180);
  const sin = radians.reduce((total, angle) => total + Math.sin(angle), 0);
  const cos = radians.reduce((total, angle) => total + Math.cos(angle), 0);

  if (Math.abs(sin) < 0.000001 && Math.abs(cos) < 0.000001) {
    return angles.reduce((total, angle) => total + angle, 0) / angles.length;
  }

  return (Math.atan2(sin, cos) * 180) / Math.PI;
}

function getCircularNodeSide(x: number, radius: number): BracketNodeSide {
  if (radius === 0) return "center";
  if (x < CIRCULAR_CENTER - 1) return "left";
  if (x > CIRCULAR_CENTER + 1) return "right";
  return "center";
}

function getCircularFinalistPoints(
  sourceNodes: [BracketCircularNodeLayout, BracketCircularNodeLayout],
): [BracketCircularPoint, BracketCircularPoint] {
  const leftPoint = getCircularFinalistPoint("left");
  const rightPoint = getCircularFinalistPoint("right");

  return sourceNodes.map((sourceNode) =>
    sourceNode.x < CIRCULAR_CENTER ? leftPoint : rightPoint,
  ) as [BracketCircularPoint, BracketCircularPoint];
}

function getCircularFinalistPoint(side: BracketSide): BracketCircularPoint {
  const isLeft = side === "left";

  return {
    x: roundCoordinate(CIRCULAR_CENTER + (isLeft ? -1 : 1) * CIRCULAR_FINALIST_OFFSET),
    y: CIRCULAR_CENTER,
    angle: isLeft ? 180 : 0,
    radius: CIRCULAR_FINALIST_OFFSET,
  };
}

function getCircularFinalTeamSides(
  sourceNodes: BracketCircularNodeLayout[],
): [BracketMatchSide, BracketMatchSide] {
  const [leftSource, rightSource] = sourceNodes
    .map((sourceNode, index) => ({
      side: (index === 0 ? "home" : "away") as BracketMatchSide,
      x: sourceNode.x,
      y: sourceNode.y,
    }))
    .sort((a, b) => {
      const xDifference = a.x - b.x;
      return xDifference === 0 ? a.y - b.y : xDifference;
    });

  return [leftSource.side, rightSource.side] as [BracketMatchSide, BracketMatchSide];
}

function toCircularPoint(layout: BracketCircularNodeLayout): BracketCircularPoint {
  return {
    x: layout.x,
    y: layout.y,
    angle: layout.angle,
    radius: layout.radius,
  };
}

function roundCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
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
