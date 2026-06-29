"use client";

import dynamic from "next/dynamic";
import type { FormEvent } from "react";
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
const EMPTY_PICKS: PredictionPicks = {};

type LocalPrediction = {
  displayName?: string;
  picks?: PredictionPicks;
  started?: boolean;
};

type PublicPrediction = {
  id: string;
  displayName: string;
  picks: PredictionPicks;
  updatedAt: string;
};

type PendingPick = {
  matchId: string;
  teamId: string;
};

const OWN_PREDICTION_ID = "self";
const CURRENT_STANDINGS_ID = "current-standings";

export function HomeDashboard({ initialBracket }: { initialBracket: BracketData }) {
  const [picks, setPicks] = useState<PredictionPicks>({});
  const [displayName, setDisplayName] = useState("");
  const [hasStartedPrediction, setHasStartedPrediction] = useState(false);
  const [isNamePromptOpen, setIsNamePromptOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [pendingPick, setPendingPick] = useState<PendingPick | null>(null);
  const [publicPredictions, setPublicPredictions] = useState<PublicPrediction[]>([]);
  const [selectedPredictionId, setSelectedPredictionId] = useState(CURRENT_STANDINGS_ID);
  const [predictionLoaded, setPredictionLoaded] = useState(false);
  const [remotePersistenceAvailable, setRemotePersistenceAvailable] = useState(isSupabaseConfigured);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const predictionNow = initialBracket.source === "seeded" ? SEEDED_DEMO_NOW : undefined;
  const isViewingCurrentStandings = selectedPredictionId === CURRENT_STANDINGS_ID;
  const selectedPublicPrediction =
    selectedPredictionId === OWN_PREDICTION_ID || isViewingCurrentStandings
      ? null
      : publicPredictions.find((prediction) => prediction.id === selectedPredictionId) ?? null;
  const visiblePicks = isViewingCurrentStandings ? EMPTY_PICKS : selectedPublicPrediction?.picks ?? picks;
  const isViewingPublicPrediction = Boolean(selectedPublicPrediction);
  const isReadOnlyView = isViewingCurrentStandings || isViewingPublicPrediction;

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
      const localDisplayName = normalizeDisplayName(local?.displayName);
      if (localDisplayName) {
        setDisplayName(localDisplayName);
        setHasStartedPrediction(true);
      } else if (local?.started) {
        setHasStartedPrediction(true);
      }
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
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) {
          if (!cancelled) setRemotePersistenceAvailable(false);
          return;
        }
        if (!session) {
          return;
        }

        const response = await fetch("/api/predictions", { cache: "no-store" });
        if (!cancelled && response.ok) {
          const payload = (await response.json()) as {
            prediction?: LocalPrediction | null;
          };
          const remoteDisplayName = normalizeDisplayName(payload.prediction?.displayName);
          if (remoteDisplayName) {
            setDisplayName(remoteDisplayName);
            setHasStartedPrediction(true);
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

    const cleanDisplayName = normalizeDisplayName(displayName);
    const prediction = { displayName: cleanDisplayName ?? undefined, picks, started: hasStartedPrediction };
    writeLocalPrediction(prediction);

    if (!hasStartedPrediction || !cleanDisplayName) return undefined;
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
  }, [displayName, hasStartedPrediction, picks, predictionLoaded, remotePersistenceAvailable]);

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
    if (!hasStartedPrediction || !normalizeDisplayName(displayName)) {
      openNamePrompt({ matchId: match.id, teamId });
      return;
    }

    setPicks((current) => applyPick(initialBracket.matches, current, match.id, teamId, predictionNow));
  }

  function handleStartPrediction() {
    openNamePrompt(null);
  }

  function openNamePrompt(nextPendingPick: PendingPick | null) {
    setPendingPick(nextPendingPick);
    setSelectedPredictionId(OWN_PREDICTION_ID);
    setNameDraft(normalizeDisplayName(displayName) ?? "");
    setIsNamePromptOpen(true);
  }

  function submitNamePrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDisplayName = normalizeDisplayName(nameDraft);
    if (!nextDisplayName) return;

    setDisplayName(nextDisplayName);
    setHasStartedPrediction(true);
    setIsNamePromptOpen(false);
    setSelectedPredictionId(OWN_PREDICTION_ID);

    if (pendingPick) {
      const { matchId, teamId } = pendingPick;
      setPicks((current) => applyPick(initialBracket.matches, current, matchId, teamId, predictionNow));
      setPendingPick(null);
    }
  }

  function cancelNamePrompt() {
    setIsNamePromptOpen(false);
    setPendingPick(null);
  }

  return (
    <main className="home-page">
      <LiveFavicon active={hasLiveMatch} />
      <WorldCupScene activeMatch={activeMatch} />
      <section className="dashboard-shell">
        <div className="prediction-toolbar">
          <PredictionViewerCombobox
            predictions={publicPredictions}
            selectedId={selectedPredictionId}
            onSelect={setSelectedPredictionId}
          />
          <div className="prediction-edit-cluster">
            {hasStartedPrediction ? (
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
            ) : (
              <button
                type="button"
                className="prediction-start-button"
                aria-label="Start making picks"
                title="Start making picks"
                onClick={handleStartPrediction}
              >
                +
              </button>
            )}
            {isNamePromptOpen ? (
              <form className="prediction-name-prompt" onSubmit={submitNamePrompt}>
                <label>
                  <span>name</span>
                  <input
                    type="text"
                    value={nameDraft}
                    maxLength={48}
                    required
                    autoFocus
                    aria-label="Prediction name"
                    spellCheck={false}
                    onChange={(event) => setNameDraft(event.target.value)}
                  />
                </label>
                <button type="submit">ok</button>
                <button type="button" aria-label="Cancel name entry" onClick={cancelNamePrompt}>
                  x
                </button>
              </form>
            ) : null}
          </div>
        </div>
        <BracketBoard
          matches={displayMatches}
          picks={visiblePicks}
          viewOnly={isReadOnlyView}
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
  const selectedLabel =
    selectedId === CURRENT_STANDINGS_ID
      ? "current standings"
      : selectedPrediction?.displayName ?? "my bracket";
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
            <PredictionComboboxItem
              id={CURRENT_STANDINGS_ID}
              label="current standings"
              selected={selectedId === CURRENT_STANDINGS_ID}
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

function normalizeDisplayName(value: string | null | undefined) {
  const trimmed = value?.trim().slice(0, 48) ?? "";
  return trimmed || null;
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
