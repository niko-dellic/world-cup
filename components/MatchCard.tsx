"use client";

import clsx from "clsx";
import { Lock, Zap } from "lucide-react";
import type { DisplayMatch, Team } from "@/lib/types";
import { getSelectableTeams } from "@/lib/bracket";
import { formatTeamScore } from "@/lib/match-score";

type MatchCardProps = {
  match: DisplayMatch;
  selectedTeamId: string | null;
  isActive: boolean;
  onActivate: () => void;
  onPick: (teamId: string) => void;
};

export function MatchCard({
  match,
  selectedTeamId,
  isActive,
  onActivate,
  onPick,
}: MatchCardProps) {
  const teams = getSelectableTeams(match);
  const canPick = !match.isLocked && teams.length === 2;

  return (
    <article
      className={clsx(
        "match-card",
        isActive && "match-card-active",
        match.isLocked && "match-card-locked",
      )}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onActivate}
      tabIndex={0}
      aria-label={`${match.roundName} match ${match.slot}`}
    >
      <div className="match-meta">
        <span>M{match.slot}</span>
        <time>{formatKickoff(match.kickoffTime)}</time>
        {match.isLocked ? <Lock aria-label="Locked" /> : <Zap aria-hidden="true" />}
      </div>

      <div className="team-buttons">
        <TeamButton
          team={match.displayHomeTeam}
          score={formatTeamScore(match, "home")}
          isSelected={selectedTeamId === match.displayHomeTeam?.id}
          isWinner={match.winnerTeamId === match.displayHomeTeam?.id}
          disabled={!canPick || !match.displayHomeTeam}
          onPick={onPick}
        />
        <TeamButton
          team={match.displayAwayTeam}
          score={formatTeamScore(match, "away")}
          isSelected={selectedTeamId === match.displayAwayTeam?.id}
          isWinner={match.winnerTeamId === match.displayAwayTeam?.id}
          disabled={!canPick || !match.displayAwayTeam}
          onPick={onPick}
        />
      </div>
    </article>
  );
}

function TeamButton({
  team,
  score,
  isSelected,
  isWinner,
  disabled,
  onPick,
}: {
  team: Team | null;
  score: string | null;
  isSelected: boolean;
  isWinner: boolean;
  disabled: boolean;
  onPick: (teamId: string) => void;
}) {
  return (
    <button
      type="button"
      className={clsx("team-button", isSelected && "team-selected", isWinner && "team-winner")}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (team) onPick(team.id);
      }}
      style={
        team
          ? ({
              "--team-a": team.colors[0],
              "--team-b": team.colors[1],
            } as React.CSSProperties)
          : undefined
      }
    >
      <span className="team-flag" aria-hidden="true">
        {team?.flagEmoji ?? "TBD"}
      </span>
      <span className="team-name" data-short={team?.shortName ?? "TBD"}>
        {team?.name ?? "Winner pending"}
      </span>
      <span className="team-score">{score ?? ""}</span>
    </button>
  );
}

function formatKickoff(value: string | null) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
  }).format(new Date(value));
}
