"use client";

import clsx from "clsx";
import type { CSSProperties } from "react";
import { getSelectableTeams } from "@/lib/bracket";
import type { BracketRound, DisplayMatch, PredictionPicks, Team } from "@/lib/types";

type BracketBoardProps = {
  matches: DisplayMatch[];
  picks: PredictionPicks;
  activeMatchId: string | null;
  onActivateMatch: (matchId: string) => void;
  onClearActiveMatch: () => void;
  onPick: (match: DisplayMatch, teamId: string) => void;
};

type NodeSide = "left" | "right" | "center";
type NodeKind = "outer" | "winner" | "final";

type NodeLayout = {
  x: number;
  y: number;
  width: number;
  kind: NodeKind;
  side: NodeSide;
};

const X = {
  leftOuter: 10,
  leftR16: 25,
  leftQf: 36.5,
  leftSf: 45,
  final: 50,
  rightSf: 55,
  rightQf: 63.5,
  rightR16: 75,
  rightOuter: 90,
};

const NODE_WIDTH = {
  outer: 10.8,
  winner: 4.8,
  final: 5.4,
};

const Y = {
  r32: (slot: number) => [6, 19, 32, 45, 55, 68, 81, 94][slot - 1] ?? 50,
  r16: (slot: number) => [12.5, 38.5, 61.5, 87.5][slot - 1] ?? 50,
  qf: (slot: number) => (slot === 1 ? 25 : 75),
  sf: 50,
  final: 50,
};

export function BracketBoard({
  matches,
  picks,
  activeMatchId,
  onActivateMatch,
  onClearActiveMatch,
  onPick,
}: BracketBoardProps) {
  const nodes = matches
    .map((match) => ({ match, layout: getNodeLayout(match) }))
    .filter((node): node is { match: DisplayMatch; layout: NodeLayout } => Boolean(node.layout));

  return (
    <div
      className="terminal-bracket"
      tabIndex={0}
      aria-label="World Cup knockout bracket"
      onMouseLeave={onClearActiveMatch}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onClearActiveMatch();
        }
      }}
    >
      <svg className="bracket-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {buildConnectorPaths().map((path, index) => (
          <path key={index} d={path} />
        ))}
      </svg>

      {nodes.map(({ match, layout }) => (
        <TerminalNode
          key={match.id}
          match={match}
          layout={layout}
          selectedTeamId={picks[match.id] ?? null}
          isActive={match.id === activeMatchId}
          onActivate={() => onActivateMatch(match.id)}
          onPick={(teamId) => onPick(match, teamId)}
        />
      ))}

      <div className="final-label" aria-hidden="true">
        Final
      </div>
    </div>
  );
}

function TerminalNode({
  match,
  layout,
  selectedTeamId,
  isActive,
  onActivate,
  onPick,
}: {
  match: DisplayMatch;
  layout: NodeLayout;
  selectedTeamId: string | null;
  isActive: boolean;
  onActivate: () => void;
  onPick: (teamId: string) => void;
}) {
  const selectableTeams = getSelectableTeams(match);
  const winner =
    selectableTeams.find((team) => team.id === selectedTeamId) ??
    selectableTeams.find((team) => team.id === match.winnerTeamId) ??
    null;
  const canPick = !match.isLocked && selectableTeams.length > 0;

  function cyclePick() {
    onActivate();
    if (!canPick) return;
    const currentIndex = selectableTeams.findIndex((team) => team.id === selectedTeamId);
    const nextTeam = selectableTeams[(currentIndex + 1) % selectableTeams.length];
    if (nextTeam) onPick(nextTeam.id);
  }

  return (
    <div
      className={clsx(
        "terminal-node",
        `terminal-node-${layout.kind}`,
        `terminal-node-${layout.side}`,
        isActive && "terminal-node-active",
      )}
      style={{ "--x": layout.x, "--y": layout.y, "--node-w": layout.width } as CSSProperties}
      onMouseEnter={onActivate}
      onPointerEnter={onActivate}
      onFocus={onActivate}
      onClick={onActivate}
    >
      {layout.kind === "outer" ? (
        <OuterMatchNode match={match} selectedTeamId={selectedTeamId} onPick={onPick} />
      ) : (
        <button
          type="button"
          className={clsx("winner-node", winner && "winner-node-picked")}
          disabled={!canPick}
          onClick={cyclePick}
          aria-label={`${match.roundName} match ${match.slot}`}
        >
          {winner ? <TeamToken team={winner} /> : <span className="tbd-token">TBD</span>}
        </button>
      )}
    </div>
  );
}

function OuterMatchNode({
  match,
  selectedTeamId,
  onPick,
}: {
  match: DisplayMatch;
  selectedTeamId: string | null;
  onPick: (teamId: string) => void;
}) {
  return (
    <div className="outer-match" aria-label={`${match.roundName} match ${match.slot}`}>
      <TeamPickButton
        team={match.displayHomeTeam}
        selectedTeamId={selectedTeamId}
        locked={match.isLocked}
        onPick={onPick}
      />
      <span className="vs-token">vs</span>
      <TeamPickButton
        team={match.displayAwayTeam}
        selectedTeamId={selectedTeamId}
        locked={match.isLocked}
        onPick={onPick}
      />
    </div>
  );
}

function TeamPickButton({
  team,
  selectedTeamId,
  locked,
  onPick,
}: {
  team: Team | null;
  selectedTeamId: string | null;
  locked: boolean;
  onPick: (teamId: string) => void;
}) {
  return (
    <button
      type="button"
      className={clsx("team-token-button", team?.id === selectedTeamId && "team-token-selected")}
      disabled={!team || locked}
      onClick={() => {
        if (team) onPick(team.id);
      }}
    >
      {team ? <TeamToken team={team} /> : <span className="unknown-token">?</span>}
    </button>
  );
}

function TeamToken({ team }: { team: Team }) {
  return (
    <span className="team-token">
      <span className="team-token-flag" aria-hidden="true">
        {team.flagEmoji ?? "🏳"}
      </span>
      <span className="team-token-code">{team.shortName}</span>
    </span>
  );
}

function getNodeLayout(match: DisplayMatch): NodeLayout | null {
  if (match.round === "round-of-32") {
    if (match.slot <= 8) {
      return sideLayout("left", "round-of-32", match.slot);
    }
    return sideLayout("right", "round-of-32", match.slot - 8);
  }

  if (match.round === "round-of-16") {
    if (match.slot <= 4) {
      return sideLayout("left", "round-of-16", match.slot);
    }
    return sideLayout("right", "round-of-16", match.slot - 4);
  }

  if (match.round === "quarterfinals") {
    if (match.slot <= 2) {
      return sideLayout("left", "quarterfinals", match.slot);
    }
    return sideLayout("right", "quarterfinals", match.slot - 2);
  }

  if (match.round === "semifinals") {
    return sideLayout(match.slot === 1 ? "left" : "right", "semifinals", 1);
  }

  if (match.round === "final") {
    return finalLayout();
  }

  return null;
}

function sideLayout(side: "left" | "right", round: BracketRound, slot: number): NodeLayout {
  if (round === "round-of-32") {
    return {
      x: side === "left" ? X.leftOuter : X.rightOuter,
      y: Y.r32(slot),
      width: NODE_WIDTH.outer,
      kind: "outer",
      side,
    };
  }

  if (round === "round-of-16") {
    return {
      x: side === "left" ? X.leftR16 : X.rightR16,
      y: Y.r16(slot),
      width: NODE_WIDTH.winner,
      kind: "winner",
      side,
    };
  }

  if (round === "quarterfinals") {
    return {
      x: side === "left" ? X.leftQf : X.rightQf,
      y: Y.qf(slot),
      width: NODE_WIDTH.winner,
      kind: "winner",
      side,
    };
  }

  return {
    x: side === "left" ? X.leftSf : X.rightSf,
    y: Y.sf,
    width: NODE_WIDTH.winner,
    kind: "winner",
    side,
  };
}

function buildConnectorPaths() {
  const paths: string[] = [];

  addRoundPaths(paths, "left", "round-of-32", "round-of-16");
  addRoundPaths(paths, "left", "round-of-16", "quarterfinals");
  addRoundPaths(paths, "left", "quarterfinals", "semifinals");
  paths.push(connectionPath(sideLayout("left", "semifinals", 1), finalLayout(), "left"));

  addRoundPaths(paths, "right", "round-of-32", "round-of-16");
  addRoundPaths(paths, "right", "round-of-16", "quarterfinals");
  addRoundPaths(paths, "right", "quarterfinals", "semifinals");
  paths.push(connectionPath(sideLayout("right", "semifinals", 1), finalLayout(), "right"));

  return paths;
}

function finalLayout(): NodeLayout {
  return { x: X.final, y: Y.final, width: NODE_WIDTH.final, kind: "final", side: "center" };
}

function addRoundPaths(
  paths: string[],
  side: "left" | "right",
  fromRound: BracketRound,
  toRound: BracketRound,
) {
  const targets =
    toRound === "round-of-16"
      ? [1, 2, 3, 4]
      : toRound === "quarterfinals"
        ? [1, 2]
        : [1];

  for (const targetSlot of targets) {
    const target = sideLayout(side, toRound, targetSlot);
    const sourceOne = sideLayout(side, fromRound, (targetSlot - 1) * 2 + 1);
    const sourceTwo = sideLayout(side, fromRound, (targetSlot - 1) * 2 + 2);
    paths.push(connectionPath(sourceOne, target, side));
    paths.push(connectionPath(sourceTwo, target, side));
  }
}

function connectionPath(source: NodeLayout, target: NodeLayout, side: "left" | "right") {
  const startX = source.x + (side === "left" ? source.width / 2 : -source.width / 2);
  const endX = target.x + (side === "left" ? -target.width / 2 : target.width / 2);
  const elbowX = (startX + endX) / 2;
  return `M ${startX} ${source.y} H ${elbowX} V ${target.y} H ${endX}`;
}
