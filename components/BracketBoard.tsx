"use client";

import clsx from "clsx";
import type { CSSProperties } from "react";
import {
  buildBracketGridLayout,
  type BracketConnectorLayout,
  type BracketNodeLayout,
} from "@/lib/bracket-layout";
import type { DisplayMatch, PredictionPicks, Team } from "@/lib/types";

type BracketBoardProps = {
  matches: DisplayMatch[];
  picks: PredictionPicks;
  viewOnly?: boolean;
  activeMatchId: string | null;
  onActivateMatch: (matchId: string) => void;
  onClearActiveMatch: () => void;
  onPick: (match: DisplayMatch, teamId: string) => void;
};

export function BracketBoard({
  matches,
  picks,
  viewOnly = false,
  activeMatchId,
  onActivateMatch,
  onClearActiveMatch,
  onPick,
}: BracketBoardProps) {
  const layout = buildBracketGridLayout(matches);
  const matchesById = new Map(matches.map((match) => [match.id, match]));

  return (
    <div
      className="terminal-bracket"
      tabIndex={0}
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
            viewOnly={viewOnly}
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
  viewOnly,
  isActive,
  onActivate,
  onDeactivate,
  onPick,
}: {
  match: DisplayMatch;
  layout: BracketNodeLayout;
  selectedTeamId: string | null;
  viewOnly: boolean;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onPick: (teamId: string) => void;
}) {
  const displayedSelection = selectedTeamId ?? match.winnerTeamId;
  const matchupNode = (
    <MatchupNode
      match={match}
      selectedTeamId={displayedSelection}
      viewOnly={viewOnly}
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
  selectedTeamId,
  viewOnly,
  onPick,
}: {
  match: DisplayMatch;
  selectedTeamId: string | null;
  viewOnly: boolean;
  onPick: (teamId: string) => void;
}) {
  return (
    <div className="outer-match" aria-label={`${match.roundName} match ${match.slot}`}>
      <TeamPickButton
        team={match.displayHomeTeam}
        selectedTeamId={selectedTeamId}
        locked={match.isLocked}
        viewOnly={viewOnly}
        onPick={onPick}
      />
      <TeamPickButton
        team={match.displayAwayTeam}
        selectedTeamId={selectedTeamId}
        locked={match.isLocked}
        viewOnly={viewOnly}
        onPick={onPick}
      />
    </div>
  );
}

function TeamPickButton({
  team,
  selectedTeamId,
  locked,
  viewOnly,
  onPick,
}: {
  team: Team | null;
  selectedTeamId: string | null;
  locked: boolean;
  viewOnly: boolean;
  onPick: (teamId: string) => void;
}) {
  return (
    <button
      type="button"
      className={clsx("team-token-button", team?.id === selectedTeamId && "team-token-selected")}
      disabled={!team || viewOnly}
      aria-disabled={!team || locked || viewOnly}
      onClick={() => {
        if (team && !locked && !viewOnly) onPick(team.id);
      }}
      aria-label={team ? team.name : "Unknown team"}
      title={team?.name}
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
