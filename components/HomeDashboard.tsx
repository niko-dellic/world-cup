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

type PublicPrediction = {
  id: string;
  displayName: string;
  picks: PredictionPicks;
  updatedAt: string;
};

const OWN_PREDICTION_ID = "self";

export function HomeDashboard({ initialBracket }: { initialBracket: BracketData }) {
  const [picks, setPicks] = useState<PredictionPicks>({});
  const [displayName, setDisplayName] = useState("Anonymous");
  const [publicPredictions, setPublicPredictions] = useState<PublicPrediction[]>([]);
  const [selectedPredictionId, setSelectedPredictionId] = useState(OWN_PREDICTION_ID);
  const [predictionLoaded, setPredictionLoaded] = useState(false);
  const [remotePersistenceAvailable, setRemotePersistenceAvailable] = useState(isSupabaseConfigured);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const predictionNow = initialBracket.source === "seeded" ? SEEDED_DEMO_NOW : undefined;
  const selectedPublicPrediction =
    selectedPredictionId === OWN_PREDICTION_ID
      ? null
      : publicPredictions.find((prediction) => prediction.id === selectedPredictionId) ?? null;
  const visiblePicks = selectedPublicPrediction?.picks ?? picks;
  const isViewingPublicPrediction = Boolean(selectedPublicPrediction);

  const displayMatches = useMemo(
    () => deriveDisplayMatches(initialBracket.matches, visiblePicks, predictionNow),
    [initialBracket.matches, visiblePicks, predictionNow],
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

  useEffect(() => {
    let cancelled = false;

    async function loadPublicPredictions() {
      try {
        const response = await fetch("/api/predictions/public", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          predictions?: PublicPrediction[];
        };
        if (!cancelled) {
          setPublicPredictions(
            (payload.predictions ?? []).filter(
              (prediction) => prediction.id && prediction.displayName && prediction.picks,
            ),
          );
        }
      } catch {
        // The local bracket should stay usable when the shared prediction list is unavailable.
      }
    }

    void loadPublicPredictions();

    return () => {
      cancelled = true;
    };
  }, []);

  function handlePick(match: DisplayMatch, teamId: string) {
    setPicks((current) => applyPick(initialBracket.matches, current, match.id, teamId, predictionNow));
  }

  return (
    <main className="home-page">
      <LiveFavicon active={hasLiveMatch} />
      <WorldCupScene activeMatch={activeMatch} />
      <section className="dashboard-shell">
        <div className="prediction-toolbar">
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
          <PredictionViewerCombobox
            predictions={publicPredictions}
            selectedId={selectedPredictionId}
            onSelect={setSelectedPredictionId}
          />
        </div>
        <BracketBoard
          matches={displayMatches}
          picks={visiblePicks}
          viewOnly={isViewingPublicPrediction}
          activeMatchId={activeMatch?.id ?? null}
          onActivateMatch={setActiveMatchId}
          onClearActiveMatch={() => setActiveMatchId(null)}
          onPick={handlePick}
        />
      </section>
    </main>
  );
}

function PredictionViewerCombobox({
  predictions,
  selectedId,
  onSelect,
}: {
  predictions: PublicPrediction[];
  selectedId: string;
  onSelect: (predictionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedPrediction = predictions.find((prediction) => prediction.id === selectedId);
  const selectedLabel = selectedPrediction?.displayName ?? "my bracket";
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPredictions = normalizedQuery
    ? predictions.filter((prediction) => prediction.displayName.toLowerCase().includes(normalizedQuery))
    : predictions;

  function selectPrediction(predictionId: string) {
    onSelect(predictionId);
    setQuery("");
    setOpen(false);
  }

  return (
    <div
      className="prediction-viewer-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="prediction-combobox-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="View saved prediction"
        onClick={() => setOpen((current) => !current)}
      >
        <span>view</span>
        <strong>{selectedLabel}</strong>
        <span aria-hidden="true">v</span>
      </button>

      {open ? (
        <div className="prediction-combobox-content">
          <input
            type="text"
            className="prediction-combobox-input"
            value={query}
            role="combobox"
            aria-expanded={open}
            aria-controls="prediction-combobox-list"
            aria-label="Search saved predictions"
            placeholder="search"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div id="prediction-combobox-list" className="prediction-combobox-list" role="listbox">
            <PredictionComboboxItem
              id={OWN_PREDICTION_ID}
              label="my bracket"
              selected={selectedId === OWN_PREDICTION_ID}
              onSelect={selectPrediction}
            />
            {filteredPredictions.length > 0 ? (
              filteredPredictions.map((prediction) => (
                <PredictionComboboxItem
                  key={prediction.id}
                  id={prediction.id}
                  label={prediction.displayName}
                  selected={prediction.id === selectedId}
                  onSelect={selectPrediction}
                />
              ))
            ) : (
              <div className="prediction-combobox-empty">no saved brackets</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PredictionComboboxItem({
  id,
  label,
  selected,
  onSelect,
}: {
  id: string;
  label: string;
  selected: boolean;
  onSelect: (predictionId: string) => void;
}) {
  return (
    <button
      type="button"
      className="prediction-combobox-item"
      role="option"
      aria-selected={selected}
      onClick={() => onSelect(id)}
    >
      <span>{label}</span>
      {selected ? <span aria-hidden="true">*</span> : null}
    </button>
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
