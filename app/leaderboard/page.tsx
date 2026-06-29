import Link from "next/link";
import { getBracketData, getPredictionRows } from "@/lib/bracket-store";
import { computeLeaderboard } from "@/lib/bracket";
import { Trophy } from "lucide-react";

export default async function LeaderboardPage() {
  const [bracket, predictions] = await Promise.all([getBracketData(), getPredictionRows()]);
  const leaderboard = computeLeaderboard(bracket.matches, predictions);

  return (
    <main className="leaderboard-page">
      <section className="page-shell leaderboard-shell">
        <div className="page-heading">
          <p className="eyebrow">Fantasy table</p>
          <h1>Leaderboard</h1>
        </div>

        {leaderboard.length === 0 ? (
          <div className="empty-state">
            <Trophy aria-hidden="true" />
            <h2>No submitted brackets yet</h2>
            <Link href="/" className="primary-link">
              Make picks
            </Link>
          </div>
        ) : (
          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Points</th>
                  <th>Correct</th>
                  <th>Champion</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.userId}>
                    <td>#{entry.rank}</td>
                    <td>{entry.displayName}</td>
                    <td>{entry.points}</td>
                    <td>
                      {entry.correctPicks}
                      {entry.possiblePoints > 0 ? ` / ${entry.possiblePoints}` : ""}
                    </td>
                    <td>{entry.championPick?.name ?? "Pending"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
