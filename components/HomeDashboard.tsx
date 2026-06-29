"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { BracketBoard } from "@/components/BracketBoard";
import type { BracketData, DisplayMatch, PredictionPicks } from "@/lib/types";
import { applyPick, deriveDisplayMatches, sanitizePicks } from "@/lib/bracket";

const WorldCupScene = dynamic(
  () => import("@/components/WorldCupScene").then((module) => module.WorldCupScene),
  { ssr: false },
);

const LOCAL_STORAGE_KEY = "world-cup-bracket-prediction";

type LocalPrediction = {
  picks?: PredictionPicks;
};

export function HomeDashboard({ initialBracket }: { initialBracket: BracketData }) {
  const [picks, setPicks] = useState<PredictionPicks>({});
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);

  const displayMatches = useMemo(
    () => deriveDisplayMatches(initialBracket.matches, picks),
    [initialBracket.matches, picks],
  );

  const activeMatch = displayMatches.find((match) => match.id === activeMatchId) ?? null;

  useEffect(() => {
    const local = readLocalPrediction();
    if (local?.picks) {
      setPicks(sanitizePicks(initialBracket.matches, local.picks));
    }
  }, [initialBracket.matches]);

  useEffect(() => {
    writeLocalPrediction({ picks });
  }, [picks]);

  function handlePick(match: DisplayMatch, teamId: string) {
    setPicks((current) => applyPick(initialBracket.matches, current, match.id, teamId));
  }

  return (
    <main className="home-page">
      <WorldCupScene activeMatch={activeMatch} />
      <section className="dashboard-shell">
        <BracketBoard
          matches={displayMatches}
          picks={picks}
          activeMatchId={activeMatch?.id ?? null}
          onActivateMatch={setActiveMatchId}
          onClearActiveMatch={() => setActiveMatchId(null)}
          onPick={handlePick}
        />
      </section>
    </main>
  );
}

function readLocalPrediction(): LocalPrediction | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalPrediction) : null;
  } catch {
    return null;
  }
}

function writeLocalPrediction(prediction: LocalPrediction) {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prediction));
}
