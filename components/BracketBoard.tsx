"use client";

import clsx from "clsx";
import type { CSSProperties } from "react";
import { getSelectableTeams } from "@/lib/bracket";
import {
  buildBracketGridLayout,
  type BracketConnectorLayout,
  type BracketNodeLayout,
} from "@/lib/bracket-layout";
import type { DisplayMatch, PredictionPicks, Team } from "@/lib/types";

type BracketBoardProps = {
  matches: DisplayMatch[];
  picks: PredictionPicks;
  activeMatchId: string | null;
  onActivateMatch: (matchId: string) => void;
  onClearActiveMatch: () => void;
  onPick: (match: DisplayMatch, teamId: string) => void;
};

export function BracketBoard({
  matches,
  picks,
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
  isActive,
  onActivate,
  onDeactivate,
  onPick,
}: {
  match: DisplayMatch;
  layout: BracketNodeLayout;
  selectedTeamId: string | null;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
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

  const winnerButton = (
    <button
      type="button"
      className={clsx("winner-node", winner && "winner-node-picked")}
      aria-disabled={!canPick}
      onClick={cyclePick}
      aria-label={`${match.roundName} match ${match.slot}`}
    >
      {winner ? <TeamToken team={winner} /> : <span className="tbd-token">TBD</span>}
    </button>
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
      onMouseEnter={onActivate}
      onPointerEnter={onActivate}
      onMouseMove={onActivate}
      onPointerMove={onActivate}
      onMouseLeave={onDeactivate}
      onPointerLeave={onDeactivate}
      onFocus={onActivate}
      onClick={onActivate}
    >
      {layout.kind === "outer" ? (
        <OuterMatchNode match={match} selectedTeamId={selectedTeamId} onPick={onPick} />
      ) : layout.kind === "final" ? (
        <div className="final-stack">
          <span className="final-label" aria-hidden="true">
            Final
          </span>
          {winnerButton}
        </div>
      ) : (
        winnerButton
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
      disabled={!team}
      aria-disabled={!team || locked}
      onClick={() => {
        if (team && !locked) onPick(team.id);
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
