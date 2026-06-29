import type { MatchStatus } from "@/lib/types";

export type TeamPredictionOutcome = {
  classNames: string[];
  label: string | null;
};

export function getTeamPredictionOutcome({
  status,
  teamId,
  predictionTeamId,
  winnerTeamId,
}: {
  status: MatchStatus;
  teamId: string | null | undefined;
  predictionTeamId: string | null | undefined;
  winnerTeamId: string | null | undefined;
}): TeamPredictionOutcome {
  const isCompleted = status === "completed" && Boolean(winnerTeamId);
  const isPredictedTeam = Boolean(teamId && predictionTeamId && teamId === predictionTeamId);
  const isActualWinner = Boolean(teamId && winnerTeamId && teamId === winnerTeamId);
  const isCorrectPrediction = isCompleted && isPredictedTeam && isActualWinner;
  const isWrongPrediction = isCompleted && isPredictedTeam && !isActualWinner;
  const isRevealedWinner = isCompleted && Boolean(predictionTeamId) && isActualWinner && !isPredictedTeam;

  if (isCorrectPrediction) {
    return {
      classNames: ["team-token-prediction-correct"],
      label: "correct prediction",
    };
  }

  if (isWrongPrediction) {
    return {
      classNames: ["team-token-prediction-wrong"],
      label: "wrong prediction",
    };
  }

  if (isRevealedWinner) {
    return {
      classNames: ["team-token-actual-winner"],
      label: "actual winner",
    };
  }

  return {
    classNames: [],
    label: null,
  };
}
