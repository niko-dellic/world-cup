"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { BracketBoard } from "@/components/BracketBoard";
import { LiveFavicon } from "@/components/LiveFavicon";
import type { BracketData, DisplayMatch, PredictionPicks } from "@/lib/types";
import { applyPick, deriveDisplayMatches, sanitizePicks } from "@/lib/bracket";
import {
  getBrowserSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const WorldCupScene = dynamic(
  () => import("@/components/WorldCupScene").then((module) => module.WorldCupScene),
  { ssr: false },
);

const LOCAL_STORAGE_KEY = "world-cup-bracket-prediction-v2";
const SEEDED_DEMO_NOW = new Date("2026-06-27T12:00:00.000Z");

type LocalPrediction = {
  displayName?: string;
  picks?: PredictionPicks;
};

export function HomeDashboard({ initialBracket }: { initialBracket: BracketData }) {
  const [picks, setPicks] = useState<PredictionPicks>({});
  const [displayName, setDisplayName] = useState("Anonymous");
  const [predictionLoaded, setPredictionLoaded] = useState(false);
  const [remotePersistenceAvailable, setRemotePersistenceAvailable] = useState(isSupabaseConfigured);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const predictionNow = initialBracket.source === "seeded" ? SEEDED_DEMO_NOW : undefined;

  const displayMatches = useMemo(
    () => deriveDisplayMatches(initialBracket.matches, picks, predictionNow),
    [initialBracket.matches, picks, predictionNow],
  );

  const activeMatch = displayMatches.find((match) => match.id === activeMatchId) ?? null;
  const hasLiveMatch = displayMatches.some((match) => match.status === "live");

  useEffect(() => {
    let cancelled = false;

    async function loadPrediction() {
      const local = readLocalPrediction();
      if (local?.displayName) setDisplayName(local.displayName);
      if (local?.picks) {
        setPicks(sanitizePicks(initialBracket.matches, local.picks, predictionNow));
      }

      if (!isSupabaseConfigured()) {
        if (!cancelled) setRemotePersistenceAvailable(false);
        if (!cancelled) setPredictionLoaded(true);
        return;
      }

      const supabase = getBrowserSupabaseClient();
      if (!supabase) {
        if (!cancelled) setRemotePersistenceAvailable(false);
        if (!cancelled) setPredictionLoaded(true);
        return;
      }

      try {
        const hasSession = await ensureAnonymousSession(supabase);
        if (!hasSession) {
          if (!cancelled) setRemotePersistenceAvailable(false);
          return;
        }

        const response = await fetch("/api/predictions", { cache: "no-store" });
        if (!cancelled && response.ok) {
          const payload = (await response.json()) as {
            prediction?: LocalPrediction | null;
          };
          if (payload.prediction?.displayName) {
            setDisplayName(payload.prediction.displayName);
          }
          if (payload.prediction?.picks) {
            setPicks(sanitizePicks(initialBracket.matches, payload.prediction.picks, predictionNow));
          }
        }
      } catch {
        // Local picks are enough when remote fantasy persistence is unavailable.
      } finally {
        if (!cancelled) {
          setPredictionLoaded(true);
        }
      }
    }

    void loadPrediction();

    return () => {
      cancelled = true;
    };
  }, [initialBracket.matches, predictionNow]);

  useEffect(() => {
    if (!predictionLoaded) return undefined;

    const prediction = { displayName, picks };
    writeLocalPrediction(prediction);

    if (!remotePersistenceAvailable) return undefined;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void saveRemotePrediction(prediction).then((saved) => {
        if (!saved && !cancelled) {
          setRemotePersistenceAvailable(false);
        }
      });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [displayName, picks, predictionLoaded, remotePersistenceAvailable]);

  function handlePick(match: DisplayMatch, teamId: string) {
    setPicks((current) => applyPick(initialBracket.matches, current, match.id, teamId, predictionNow));
  }

  return (
    <main className="home-page">
      <LiveFavicon active={hasLiveMatch} />
      <WorldCupScene activeMatch={activeMatch} />
      <section className="dashboard-shell">
        <label className="prediction-name-row">
          <span>name</span>
          <input
            type="text"
            value={displayName}
            maxLength={48}
            aria-label="Leaderboard name"
            spellCheck={false}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
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

async function saveRemotePrediction(prediction: LocalPrediction) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return false;

  try {
    const hasSession = await ensureAnonymousSession(supabase);
    if (!hasSession) return false;

    const response = await fetch("/api/predictions", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(prediction),
    });

    return response.ok;
  } catch {
    // Local picks remain saved even when remote fantasy persistence is unavailable.
    return false;
  }
}

async function ensureAnonymousSession(supabase: NonNullable<ReturnType<typeof getBrowserSupabaseClient>>) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) return false;
  if (session) return true;

  const { error } = await supabase.auth.signInAnonymously();
  return !error;
}
