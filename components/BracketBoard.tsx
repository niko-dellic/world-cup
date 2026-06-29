"use client";

import clsx from "clsx";
import { Trophy } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import {
  buildBracketCircularLayout,
  buildBracketGridLayout,
  type BracketCircularConnectorLayout,
  type BracketCircularNodeLayout,
  type BracketConnectorLayout,
  type BracketMatchSide,
  type BracketNodeLayout,
} from "@/lib/bracket-layout";
import type { BracketLayoutMode } from "@/lib/bracket-layout-mode";
import {
  getComparisonClassNames,
  getComparisonPickRole,
  type ComparisonSide,
} from "@/lib/comparison";
import { formatTeamScore } from "@/lib/match-score";
import { getTeamPredictionOutcome } from "@/lib/prediction-outcome";
import type { DisplayMatch, PredictionPicks, Team } from "@/lib/types";

type BracketInteractionMode = "interactive" | "visual";

type BracketBoardProps = {
  matches: DisplayMatch[];
  picks: PredictionPicks;
  className?: string;
  layoutMode?: BracketLayoutMode;
  interactionMode?: BracketInteractionMode;
  comparison?: {
    side: ComparisonSide;
    otherPicks: PredictionPicks;
  };
  activeMatchId: string | null;
  onActivateMatch: (matchId: string) => void;
  onClearActiveMatch: () => void;
  onPick: (match: DisplayMatch, teamId: string) => void;
};

export function BracketBoard({
  matches,
  picks,
  className,
  layoutMode = "symmetric",
  interactionMode = "interactive",
  comparison,
  activeMatchId,
  onActivateMatch,
  onClearActiveMatch,
  onPick,
}: BracketBoardProps) {
  if (layoutMode === "circular") {
    return (
      <CircularBracketBoard
        matches={matches}
        picks={picks}
        className={className}
        interactionMode={interactionMode}
        comparison={comparison}
        activeMatchId={activeMatchId}
        onActivateMatch={onActivateMatch}
        onClearActiveMatch={onClearActiveMatch}
        onPick={onPick}
      />
    );
  }

  const layout = buildBracketGridLayout(matches);
  const matchesById = new Map(matches.map((match) => [match.id, match]));

  return (
    <div
      className={clsx(
        "terminal-bracket",
        "terminal-bracket-symmetric",
        className,
        interactionMode === "visual" && "terminal-bracket-visual",
      )}
      data-layout-mode="symmetric"
      data-interaction-mode={interactionMode}
      tabIndex={interactionMode === "interactive" ? 0 : -1}
      aria-label="World Cup knockout bracket"
      onMouseMove={(event) => {
        if (!(event.target as HTMLElement).closest(".terminal-node")) {
          onClearActiveMatch();
        }
      }}
      onPointerMove={(event) => {
        if (!(event.target as HTMLElement).closest(".terminal-node")) {
          onClearActiveMatch();
        }
      }}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest(".terminal-node")) {
          onClearActiveMatch();
        }
      }}
      onMouseLeave={onClearActiveMatch}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onClearActiveMatch();
        }
      }}
    >
      {layout.connectors.map((connector) => (
        <ConnectorCell key={connector.key} connector={connector} />
      ))}

      {layout.nodes.map((node) => {
        const match = matchesById.get(node.matchId);
        if (!match) return null;

        return (
          <TerminalNode
            key={node.key}
            match={match}
            layout={node}
            selectedTeamId={picks[match.id] ?? null}
            comparisonSide={comparison?.side}
            comparisonOtherPick={comparison?.otherPicks[match.id] ?? null}
            interactionMode={interactionMode}
            isActive={match.id === activeMatchId}
            onActivate={() => onActivateMatch(match.id)}
            onDeactivate={onClearActiveMatch}
            onPick={(teamId) => onPick(match, teamId)}
          />
        );
      })}
    </div>
  );
}

function CircularBracketBoard({
  matches,
  picks,
  className,
  interactionMode,
  comparison,
  activeMatchId,
  onActivateMatch,
  onClearActiveMatch,
  onPick,
}: Omit<BracketBoardProps, "layoutMode"> & {
  interactionMode: BracketInteractionMode;
}) {
  const layout = buildBracketCircularLayout(matches);
  const matchesById = new Map(matches.map((match) => [match.id, match]));

  return (
    <div
      className={clsx(
        "terminal-bracket",
        "terminal-bracket-circular",
        className,
        interactionMode === "visual" && "terminal-bracket-visual",
      )}
      data-layout-mode="circular"
      data-interaction-mode={interactionMode}
      tabIndex={interactionMode === "interactive" ? 0 : -1}
      aria-label="World Cup knockout bracket"
      onMouseMove={(event) => {
        if (!(event.target as HTMLElement).closest(".terminal-node")) {
          onClearActiveMatch();
        }
      }}
      onPointerMove={(event) => {
        if (!(event.target as HTMLElement).closest(".terminal-node")) {
          onClearActiveMatch();
        }
      }}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest(".terminal-node")) {
          onClearActiveMatch();
        }
      }}
      onMouseLeave={onClearActiveMatch}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onClearActiveMatch();
        }
      }}
    >
      <svg
        className="circular-bracket-connectors"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {layout.connectors.map((connector) => (
          <CircularConnectorPath key={connector.key} connector={connector} />
        ))}
      </svg>

      {layout.nodes.map((node) => {
        const match = matchesById.get(node.matchId);
        if (!match) return null;

        return (
          <CircularTerminalNode
            key={node.key}
            match={match}
            layout={node}
            selectedTeamId={picks[match.id] ?? null}
            comparisonSide={comparison?.side}
            comparisonOtherPick={comparison?.otherPicks[match.id] ?? null}
            interactionMode={interactionMode}
            isActive={match.id === activeMatchId}
            onActivate={() => onActivateMatch(match.id)}
            onDeactivate={onClearActiveMatch}
            onPick={(teamId) => onPick(match, teamId)}
          />
        );
      })}
    </div>
  );
}

function ConnectorCell({ connector }: { connector: BracketConnectorLayout }) {
  return (
    <div
      className={clsx(
        "bracket-connector",
        `bracket-connector-${connector.side}`,
        `bracket-connector-${connector.kind}`,
      )}
      style={gridPlacement(connector)}
      data-side={connector.side}
      data-stage={connector.stage}
      data-target-slot={connector.targetMatchSlot}
      data-source-slots={connector.sourceMatchSlots.join(",")}
      data-target-match-id={connector.targetMatchId}
      data-source-match-ids={connector.sourceMatchIds.join(",")}
      aria-hidden="true"
    >
      {connector.kind === "merge" ? (
        <>
          <span className="connector-segment connector-source-top" />
          <span className="connector-segment connector-source-bottom" />
          <span className="connector-segment connector-vertical" />
          <span className="connector-segment connector-output" />
        </>
      ) : (
        <span className="connector-segment connector-single-line" />
      )}
    </div>
  );
}

function CircularConnectorPath({
  connector,
}: {
  connector: BracketCircularConnectorLayout;
}) {
  const [firstSource, secondSource] = connector.sourcePoints;
  const path =
    connector.kind === "single" && connector.targetPoints
      ? [
          `M ${firstSource.x} ${firstSource.y}`,
          `L ${connector.targetPoints[0].x} ${connector.targetPoints[0].y}`,
          `M ${secondSource.x} ${secondSource.y}`,
          `L ${connector.targetPoints[1].x} ${connector.targetPoints[1].y}`,
        ].join(" ")
      : [
          `M ${firstSource.x} ${firstSource.y}`,
          `L ${connector.jointPoint.x} ${connector.jointPoint.y}`,
          `L ${connector.targetPoint.x} ${connector.targetPoint.y}`,
          `M ${secondSource.x} ${secondSource.y}`,
          `L ${connector.jointPoint.x} ${connector.jointPoint.y}`,
        ].join(" ");

  return (
    <path
      className="circular-bracket-connector-path"
      d={path}
      data-kind={connector.kind}
      data-stage={connector.stage}
      data-target-slot={connector.targetMatchSlot}
      data-source-slots={connector.sourceMatchSlots.join(",")}
      data-target-match-id={connector.targetMatchId}
      data-source-match-ids={connector.sourceMatchIds.join(",")}
    />
  );
}

function TerminalNode({
  match,
  layout,
  selectedTeamId,
  comparisonSide,
  comparisonOtherPick,
  interactionMode,
  isActive,
  onActivate,
  onDeactivate,
  onPick,
}: {
  match: DisplayMatch;
  layout: BracketNodeLayout;
  selectedTeamId: string | null;
  comparisonSide?: ComparisonSide;
  comparisonOtherPick?: string | null;
  interactionMode: BracketInteractionMode;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onPick: (teamId: string) => void;
}) {
  const predictionTeamId = selectedTeamId;
  const displayedSelection = predictionTeamId ?? match.winnerTeamId;
  const matchupNode = (
    <MatchupNode
      match={match}
      predictionTeamId={predictionTeamId}
      selectedTeamId={displayedSelection}
      comparisonSide={comparisonSide}
      comparisonOtherPick={comparisonOtherPick}
      interactionMode={interactionMode}
      onPick={onPick}
    />
  );

  return (
    <div
      className={clsx(
        "terminal-node",
        `terminal-node-${layout.kind}`,
        `terminal-node-${layout.side}`,
        isActive && "terminal-node-active",
      )}
      style={gridPlacement(layout)}
      data-round={layout.round}
      data-slot={layout.slot}
      data-local-slot={layout.localSlot}
      data-match-id={match.id}
      data-match-number={match.matchNumber}
      onMouseEnter={onActivate}
      onPointerEnter={onActivate}
      onMouseMove={onActivate}
      onPointerMove={onActivate}
      onMouseLeave={onDeactivate}
      onPointerLeave={onDeactivate}
      onFocus={onActivate}
      onClick={onActivate}
    >
      {layout.kind === "final" ? (
        <GridFinalMatchup
          match={match}
          predictionTeamId={predictionTeamId}
          selectedTeamId={displayedSelection}
          comparisonSide={comparisonSide}
          comparisonOtherPick={comparisonOtherPick}
          interactionMode={interactionMode}
          onPick={onPick}
        />
      ) : (
        matchupNode
      )}
    </div>
  );
}

function CircularTerminalNode({
  match,
  layout,
  selectedTeamId,
  comparisonSide,
  comparisonOtherPick,
  interactionMode,
  isActive,
  onActivate,
  onDeactivate,
  onPick,
}: {
  match: DisplayMatch;
  layout: BracketCircularNodeLayout;
  selectedTeamId: string | null;
  comparisonSide?: ComparisonSide;
  comparisonOtherPick?: string | null;
  interactionMode: BracketInteractionMode;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onPick: (teamId: string) => void;
}) {
  const predictionTeamId = selectedTeamId;
  const displayedSelection = predictionTeamId ?? match.winnerTeamId;
  const matchupNode = (
    <MatchupNode
      match={match}
      predictionTeamId={predictionTeamId}
      selectedTeamId={displayedSelection}
      comparisonSide={comparisonSide}
      comparisonOtherPick={comparisonOtherPick}
      interactionMode={interactionMode}
      onPick={onPick}
    />
  );

  return (
    <div
      className={clsx(
        "terminal-node",
        "terminal-node-circular",
        `terminal-node-${layout.kind}`,
        `terminal-node-${layout.side}`,
        isActive && "terminal-node-active",
      )}
      style={circularPlacement(layout)}
      data-round={layout.round}
      data-slot={layout.slot}
      data-local-slot={layout.localSlot}
      data-match-id={match.id}
      data-match-number={match.matchNumber}
      data-angle={layout.angle}
      data-radius={layout.radius}
      onMouseEnter={onActivate}
      onPointerEnter={onActivate}
      onMouseMove={onActivate}
      onPointerMove={onActivate}
      onMouseLeave={onDeactivate}
      onPointerLeave={onDeactivate}
      onFocus={onActivate}
      onClick={onActivate}
    >
      {layout.kind === "final" ? (
        <GridFinalMatchup
          match={match}
          predictionTeamId={predictionTeamId}
          selectedTeamId={displayedSelection}
          comparisonSide={comparisonSide}
          comparisonOtherPick={comparisonOtherPick}
          interactionMode={interactionMode}
          teamSides={layout.finalTeamSides}
          onPick={onPick}
        />
      ) : (
        matchupNode
      )}
    </div>
  );
}

function FinalStack({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("final-stack", className)}>
      <span className="final-emblem" aria-hidden="true">
        <Trophy strokeWidth={1.45} />
      </span>
      {children}
    </div>
  );
}

function GridFinalMatchup({
  match,
  predictionTeamId,
  selectedTeamId,
  comparisonSide,
  comparisonOtherPick,
  interactionMode,
  teamSides = ["home", "away"],
  onPick,
}: {
  match: DisplayMatch;
  predictionTeamId: string | null;
  selectedTeamId: string | null;
  comparisonSide?: ComparisonSide;
  comparisonOtherPick?: string | null;
  interactionMode: BracketInteractionMode;
  teamSides?: [BracketMatchSide, BracketMatchSide];
  onPick: (teamId: string) => void;
}) {
  const [leftTeamSide, rightTeamSide] = teamSides;

  return (
    <div className="grid-final-matchup" aria-label={`${match.roundName} match ${match.slot}`}>
      <div className="grid-final-team grid-final-team-home">
        <TeamPickButton
          match={match}
          team={getMatchupTeam(match, leftTeamSide)}
          side={leftTeamSide}
          predictionTeamId={predictionTeamId}
          selectedTeamId={selectedTeamId}
          comparisonSide={comparisonSide}
          comparisonOtherPick={comparisonOtherPick}
          interactionMode={interactionMode}
          locked={match.isLocked}
          onPick={onPick}
        />
      </div>
      <FinalStack />
      <div className="grid-final-team grid-final-team-away">
        <TeamPickButton
          match={match}
          team={getMatchupTeam(match, rightTeamSide)}
          side={rightTeamSide}
          predictionTeamId={predictionTeamId}
          selectedTeamId={selectedTeamId}
          comparisonSide={comparisonSide}
          comparisonOtherPick={comparisonOtherPick}
          interactionMode={interactionMode}
          locked={match.isLocked}
          onPick={onPick}
        />
      </div>
    </div>
  );
}

function getMatchupTeam(match: DisplayMatch, side: BracketMatchSide) {
  return side === "home" ? match.displayHomeTeam : match.displayAwayTeam;
}

function MatchupNode({
  match,
  predictionTeamId,
  selectedTeamId,
  comparisonSide,
  comparisonOtherPick,
  interactionMode,
  onPick,
}: {
  match: DisplayMatch;
  predictionTeamId: string | null;
  selectedTeamId: string | null;
  comparisonSide?: ComparisonSide;
  comparisonOtherPick?: string | null;
  interactionMode: BracketInteractionMode;
  onPick: (teamId: string) => void;
}) {
  return (
    <div className="outer-match" aria-label={`${match.roundName} match ${match.slot}`}>
      <TeamPickButton
        match={match}
        team={match.displayHomeTeam}
        side="home"
        predictionTeamId={predictionTeamId}
        selectedTeamId={selectedTeamId}
        comparisonSide={comparisonSide}
        comparisonOtherPick={comparisonOtherPick}
        interactionMode={interactionMode}
        locked={match.isLocked}
        onPick={onPick}
      />
      <TeamPickButton
        match={match}
        team={match.displayAwayTeam}
        side="away"
        predictionTeamId={predictionTeamId}
        selectedTeamId={selectedTeamId}
        comparisonSide={comparisonSide}
        comparisonOtherPick={comparisonOtherPick}
        interactionMode={interactionMode}
        locked={match.isLocked}
        onPick={onPick}
      />
    </div>
  );
}

function TeamPickButton({
  match,
  team,
  side,
  predictionTeamId,
  selectedTeamId,
  comparisonSide,
  comparisonOtherPick,
  interactionMode,
  locked,
  onPick,
}: {
  match: DisplayMatch;
  team: Team | null;
  side: "home" | "away";
  predictionTeamId: string | null;
  selectedTeamId: string | null;
  comparisonSide?: ComparisonSide;
  comparisonOtherPick?: string | null;
  interactionMode: BracketInteractionMode;
  locked: boolean;
  onPick: (teamId: string) => void;
}) {
  const sourceATeamId = comparisonSide === "b" ? comparisonOtherPick : predictionTeamId;
  const sourceBTeamId = comparisonSide === "a" ? comparisonOtherPick : predictionTeamId;
  const comparisonRole =
    team?.id === predictionTeamId
      ? getComparisonPickRole({
          teamId: team.id,
          sourceATeamId,
          sourceBTeamId,
        })
      : "none";
  const outcome = getTeamPredictionOutcome({
    status: match.status,
    teamId: team?.id,
    predictionTeamId,
    winnerTeamId: match.winnerTeamId,
  });
  const score = formatTeamScore(match, side);
  const teamLabel = team ? [team.name, score ? `score ${score}` : null, outcome.label].filter(Boolean).join(", ") : "Unknown team";

  return (
    <button
      type="button"
      className={clsx(
        "team-token-button",
        !team && "team-token-placeholder",
        team?.id === selectedTeamId && "team-token-selected",
        outcome.classNames,
        getComparisonClassNames(comparisonRole),
      )}
      disabled={!team}
      aria-disabled={!team || locked || interactionMode === "visual"}
      tabIndex={interactionMode === "interactive" ? undefined : -1}
      onClick={() => {
        if (team && !locked && interactionMode === "interactive") onPick(team.id);
      }}
      aria-label={teamLabel}
      title={teamLabel}
    >
      {team ? <TeamToken team={team} score={score} /> : <span className="unknown-token" aria-hidden="true" />}
    </button>
  );
}

function TeamToken({ team, score }: { team: Team; score: string | null }) {
  return (
    <span className="team-token">
      <span className="team-token-flag" aria-hidden="true">
        {team.flagEmoji ?? "🏳"}
      </span>
      <span className="team-token-code">{team.shortName}</span>
      {score ? <span className="team-token-score">{score}</span> : null}
    </span>
  );
}

function gridPlacement(layout: Pick<BracketNodeLayout | BracketConnectorLayout, "column" | "rowStart" | "rowSpan">) {
  return {
    gridColumn: layout.column,
    gridRow: `${layout.rowStart} / span ${layout.rowSpan}`,
  } satisfies CSSProperties;
}

function circularPlacement(layout: BracketCircularNodeLayout) {
  return {
    left: `${layout.x}%`,
    top: `${layout.y}%`,
  } satisfies CSSProperties;
}
