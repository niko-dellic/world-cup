"use client";

import clsx from "clsx";
import type { CSSProperties } from "react";
import {
  buildBracketGridLayout,
  type BracketConnectorLayout,
  type BracketNodeLayout,
} from "@/lib/bracket-layout";
import {
  getComparisonClassNames,
  getComparisonPickRole,
  type ComparisonSide,
} from "@/lib/comparison";
import { getTeamPredictionOutcome } from "@/lib/prediction-outcome";
import type { DisplayMatch, PredictionPicks, Team } from "@/lib/types";

type BracketInteractionMode = "interactive" | "visual";

type BracketBoardProps = {
  matches: DisplayMatch[];
  picks: PredictionPicks;
  className?: string;
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
  interactionMode = "interactive",
  comparison,
  activeMatchId,
  onActivateMatch,
  onClearActiveMatch,
  onPick,
}: BracketBoardProps) {
  const layout = buildBracketGridLayout(matches);
  const matchesById = new Map(matches.map((match) => [match.id, match]));

  return (
    <div
      className={clsx("terminal-bracket", className, interactionMode === "visual" && "terminal-bracket-visual")}
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
        <div className="final-stack">
          <span className="final-label" aria-hidden="true">
            Final
          </span>
          {matchupNode}
        </div>
      ) : (
        matchupNode
      )}
    </div>
  );
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
  const teamLabel = team ? [team.name, outcome.label].filter(Boolean).join(", ") : "Unknown team";

  return (
    <button
      type="button"
      className={clsx(
        "team-token-button",
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

function gridPlacement(layout: Pick<BracketNodeLayout | BracketConnectorLayout, "column" | "rowStart" | "rowSpan">) {
  return {
    gridColumn: layout.column,
    gridRow: `${layout.rowStart} / span ${layout.rowSpan}`,
  } satisfies CSSProperties;
}
