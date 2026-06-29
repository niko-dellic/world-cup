import { describe, expect, it } from "vitest";
import { getTeamPredictionOutcome } from "@/lib/prediction-outcome";

describe("prediction outcome styling", () => {
  it("marks correct completed picks", () => {
    expect(
      getTeamPredictionOutcome({
        status: "completed",
        teamId: "canada",
        predictionTeamId: "canada",
        winnerTeamId: "canada",
      }),
    ).toEqual({
      classNames: ["team-token-prediction-correct"],
      label: "correct prediction",
    });
  });

  it("marks wrong completed picks", () => {
    expect(
      getTeamPredictionOutcome({
        status: "completed",
        teamId: "south-africa",
        predictionTeamId: "south-africa",
        winnerTeamId: "canada",
      }),
    ).toEqual({
      classNames: ["team-token-prediction-wrong"],
      label: "wrong prediction",
    });
  });

  it("reveals the actual winner when a completed pick was wrong", () => {
    expect(
      getTeamPredictionOutcome({
        status: "completed",
        teamId: "canada",
        predictionTeamId: "south-africa",
        winnerTeamId: "canada",
      }),
    ).toEqual({
      classNames: ["team-token-actual-winner"],
      label: "actual winner",
    });
  });

  it("does not grade current standings when there is no prediction", () => {
    expect(
      getTeamPredictionOutcome({
        status: "completed",
        teamId: "canada",
        predictionTeamId: null,
        winnerTeamId: "canada",
      }),
    ).toEqual({
      classNames: [],
      label: null,
    });
  });
});
