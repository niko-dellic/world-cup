import Link from "next/link";
import { getBracketData, getPredictionRows } from "@/lib/bracket-store";
import { computeLeaderboard } from "@/lib/bracket";

export default async function LeaderboardPage() {
  const [bracket, predictions] = await Promise.all([getBracketData(), getPredictionRows()]);
  const leaderboard = computeLeaderboard(bracket.matches, predictions);

  return (
    <main className="leaderboard-page">
      <section className="page-shell leaderboard-shell">
        <div className="leaderboard-topline">
          <h1 className="leaderboard-title">Leaderboard</h1>
          <Link href="/" className="make-picks-button" aria-label="Make picks" title="Make picks">
            +
          </Link>
        </div>

        {leaderboard.length === 0 ? (
          <div className="leaderboard-empty">
            <span>no submitted brackets</span>
          </div>
        ) : (
          <ol className="lofi-leaderboard" aria-label="Leaderboard standings">
            {leaderboard.map((entry) => (
              <li key={entry.userId} className="lofi-entry">
                <span className="lofi-rank">#{entry.rank.toString().padStart(2, "0")}</span>
                <div className="lofi-entry-body">
                  <div className="lofi-scoreline">
                    <span className="lofi-name">{entry.displayName}</span>
                    <span className="lofi-ellipsis" aria-hidden="true" />
                    <span className="lofi-score">{entry.points}</span>
                  </div>
                  <div className="lofi-entry-meta">
                    <span>
                      correct {entry.correctPicks}
                      {entry.possiblePoints > 0 ? `/${entry.possiblePoints}` : ""}
                    </span>
                    <span>{entry.championPick?.name ?? "champion pending"}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
