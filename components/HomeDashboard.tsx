"use client";

import dynamic from "next/dynamic";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { BracketBoard } from "@/components/BracketBoard";
import { ComparisonBracket } from "@/components/ComparisonBracket";
import { LiveFavicon } from "@/components/LiveFavicon";
import type { BracketData, DisplayMatch, PredictionPicks } from "@/lib/types";
import { applyPick, deriveDisplayMatches, sanitizePicks } from "@/lib/bracket";
import {
  CURRENT_STANDINGS_SOURCE_ID,
  OWN_PREDICTION_SOURCE_ID,
  buildPredictionSources,
  getDifferentSourceId,
  resolvePredictionSource,
  type ComparisonMode,
  type PredictionSource,
} from "@/lib/comparison";
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

type BracketViewMode = "current" | "predictions" | "compare";

export function HomeDashboard({ initialBracket }: { initialBracket: BracketData }) {
  const [picks, setPicks] = useState<PredictionPicks>({});
  const [displayName, setDisplayName] = useState("");
  const [hasStartedPrediction, setHasStartedPrediction] = useState(false);
  const [isNamePromptOpen, setIsNamePromptOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [pendingPick, setPendingPick] = useState<PendingPick | null>(null);
  const [publicPredictions, setPublicPredictions] = useState<PublicPrediction[]>([]);
  const [viewMode, setViewMode] = useState<BracketViewMode>("current");
  const [selectedPredictionId, setSelectedPredictionId] = useState(CURRENT_STANDINGS_SOURCE_ID);
  const [compareMode, setCompareMode] = useState<ComparisonMode>("slider");
  const [compareAId, setCompareAId] = useState(CURRENT_STANDINGS_SOURCE_ID);
  const [compareBId, setCompareBId] = useState(OWN_PREDICTION_SOURCE_ID);
  const [comparisonSplit, setComparisonSplit] = useState(50);
  const [predictionLoaded, setPredictionLoaded] = useState(false);
  const [remotePersistenceAvailable, setRemotePersistenceAvailable] = useState(isSupabaseConfigured);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const predictionNow = initialBracket.source === "seeded" ? SEEDED_DEMO_NOW : undefined;
  const predictionSources = useMemo(
    () => buildPredictionSources({ ownPicks: picks, publicPredictions }),
    [picks, publicPredictions],
  );
  const predictionOnlySources = useMemo(
    () => predictionSources.filter((source) => source.kind !== "current"),
    [predictionSources],
  );
  const currentStandingsSource = resolvePredictionSource(predictionSources, CURRENT_STANDINGS_SOURCE_ID);
  const selectedPredictionSource = resolvePredictionSource(predictionOnlySources, selectedPredictionId);
  const selectedSource = viewMode === "current" ? currentStandingsSource : selectedPredictionSource;
  const isCompareView = viewMode === "compare";
  const compareSourceA = resolvePredictionSource(predictionSources, compareAId);
  const compareSourceB = resolvePredictionSource(
    predictionSources,
    compareBId === compareSourceA.id ? getDifferentSourceId(predictionSources, compareSourceA.id) : compareBId,
  );
  const scenePicks = isCompareView ? compareSourceA.picks : selectedSource.picks;

  const displayMatches = useMemo(
    () => deriveDisplayMatches(initialBracket.matches, selectedSource.picks, predictionNow),
    [initialBracket.matches, selectedSource.picks, predictionNow],
  );

  const sceneDisplayMatches = useMemo(
    () => deriveDisplayMatches(initialBracket.matches, scenePicks, predictionNow),
    [initialBracket.matches, scenePicks, predictionNow],
  );

  const activeMatch = sceneDisplayMatches.find((match) => match.id === activeMatchId) ?? null;
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

  useEffect(() => {
    if (!isNamePromptOpen) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        cancelNamePrompt();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNamePromptOpen]);

  function handlePick(match: DisplayMatch, teamId: string) {
    setViewMode("predictions");
    setSelectedPredictionId(OWN_PREDICTION_SOURCE_ID);

    if (!hasStartedPrediction || !normalizeDisplayName(displayName)) {
      openNamePrompt({ matchId: match.id, teamId });
      return;
    }

    setPicks((current) => applyPick(initialBracket.matches, current, match.id, teamId, predictionNow));
  }

  function handleStartPrediction() {
    setViewMode("predictions");
    setSelectedPredictionId(OWN_PREDICTION_SOURCE_ID);
    openNamePrompt(null);
  }

  function openNamePrompt(nextPendingPick: PendingPick | null) {
    setPendingPick(nextPendingPick);
    setSelectedPredictionId(OWN_PREDICTION_SOURCE_ID);
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
    setSelectedPredictionId(OWN_PREDICTION_SOURCE_ID);

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

  function changeViewMode(nextMode: BracketViewMode) {
    if (nextMode === "predictions" && selectedPredictionId === CURRENT_STANDINGS_SOURCE_ID) {
      setSelectedPredictionId(OWN_PREDICTION_SOURCE_ID);
    }

    if (nextMode === "compare" && viewMode !== "compare") {
      const primarySource = viewMode === "current" ? currentStandingsSource : selectedPredictionSource;
      setCompareAId(primarySource.id);
      setCompareBId(getDifferentSourceId(predictionSources, primarySource.id));
      setComparisonSplit(50);
    }

    setViewMode(nextMode);
  }

  const predictionNameControl = (
    <div className="prediction-edit-cluster">
      {hasStartedPrediction ? (
        <button
          type="button"
          className="prediction-name-row"
          aria-label="Edit leaderboard name"
          onClick={() => openNamePrompt(null)}
        >
          <span>name</span>
          <strong>{normalizeDisplayName(displayName) ?? "add name"}</strong>
        </button>
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
    </div>
  );

  return (
    <main className="home-page">
      <LiveFavicon active={hasLiveMatch} />
      <WorldCupScene activeMatch={activeMatch} />
      <section className="dashboard-shell">
        <div className="prediction-toolbar">
          <div className="prediction-view-mode-control" aria-label="Bracket view">
            <span>view:</span>
            <button
              type="button"
              className={viewMode === "current" ? "prediction-view-mode-button-active" : undefined}
              aria-pressed={viewMode === "current"}
              onClick={() => changeViewMode("current")}
            >
              current standings
            </button>
            <button
              type="button"
              className={viewMode === "predictions" ? "prediction-view-mode-button-active" : undefined}
              aria-pressed={viewMode === "predictions"}
              onClick={() => changeViewMode("predictions")}
            >
              predictions
            </button>
            <button
              type="button"
              className={viewMode === "compare" ? "prediction-view-mode-button-active" : undefined}
              aria-pressed={viewMode === "compare"}
              onClick={() => changeViewMode("compare")}
            >
              compare
            </button>
          </div>

          <div className="prediction-toolbar-settings">
            {viewMode === "predictions" ? (
              <>
                <PredictionSourceSelector
                  label="prediction"
                  sources={predictionOnlySources}
                  selectedId={selectedPredictionSource.id}
                  onSelect={setSelectedPredictionId}
                />
                {predictionNameControl}
              </>
            ) : null}
            {viewMode === "compare" ? (
              <div className="prediction-comparison-controls">
                <PredictionSourceSelector
                  label="a"
                  sources={predictionSources}
                  selectedId={compareSourceA.id}
                  onSelect={(sourceId) => {
                    setCompareAId(sourceId);
                    if (sourceId === compareSourceB.id) {
                      setCompareBId(getDifferentSourceId(predictionSources, sourceId));
                    }
                  }}
                />
                <PredictionSourceSelector
                  label="b"
                  sources={predictionSources}
                  selectedId={compareSourceB.id}
                  onSelect={setCompareBId}
                />
                <div className="comparison-mode-toggle" aria-label="Comparison mode">
                  <button
                    type="button"
                    className={compareMode === "slider" ? "comparison-mode-button-active" : undefined}
                    aria-pressed={compareMode === "slider"}
                    onClick={() => setCompareMode("slider")}
                  >
                    slider
                  </button>
                  <button
                    type="button"
                    className={compareMode === "overlay" ? "comparison-mode-button-active" : undefined}
                    aria-pressed={compareMode === "overlay"}
                    onClick={() => setCompareMode("overlay")}
                  >
                    overlay
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {isNamePromptOpen ? (
          <div className="prediction-name-dialog-backdrop" role="presentation">
            <form
              className="prediction-name-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="prediction-name-dialog-title"
              onSubmit={submitNamePrompt}
            >
              <label className="prediction-name-dialog-field">
                <span id="prediction-name-dialog-title">Enter your name</span>
                <input
                  type="text"
                  value={nameDraft}
                  maxLength={48}
                  required
                  autoFocus
                  autoCapitalize="words"
                  autoComplete="name"
                  inputMode="text"
                  aria-label="Prediction name"
                  spellCheck={false}
                  onChange={(event) => setNameDraft(event.target.value)}
                />
              </label>
              <div className="prediction-name-dialog-actions">
                <button type="button" className="prediction-name-dialog-button" onClick={cancelNamePrompt}>
                  Cancel
                </button>
                <button type="submit" className="prediction-name-dialog-button prediction-name-dialog-primary">
                  OK
                </button>
              </div>
            </form>
          </div>
        ) : null}
        {isCompareView ? (
          <ComparisonBracket
            matches={initialBracket.matches}
            sourceA={compareSourceA}
            sourceB={compareSourceB}
            mode={compareMode}
            split={comparisonSplit}
            now={predictionNow}
            activeMatchId={activeMatch?.id ?? null}
            onSplitChange={setComparisonSplit}
            onActivateMatch={setActiveMatchId}
            onClearActiveMatch={() => setActiveMatchId(null)}
          />
        ) : (
          <BracketBoard
            matches={displayMatches}
            picks={selectedSource.picks}
            activeMatchId={activeMatch?.id ?? null}
            onActivateMatch={setActiveMatchId}
            onClearActiveMatch={() => setActiveMatchId(null)}
            onPick={handlePick}
          />
        )}
      </section>
    </main>
  );
}

function PredictionSourceSelector({
  label,
  sources,
  selectedId,
  onSelect,
}: {
  label: string;
  sources: PredictionSource[];
  selectedId: string;
  onSelect: (sourceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedSource = resolvePredictionSource(sources, selectedId);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSources = normalizedQuery
    ? sources.filter((source) => source.label.toLowerCase().includes(normalizedQuery))
    : sources;
  const listboxId = `prediction-source-${label}-list`;

  function selectSource(sourceId: string) {
    onSelect(sourceId);
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
        aria-label={`${label} prediction source`}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{label}</span>
        <strong>{selectedSource.label}</strong>
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
            aria-controls={listboxId}
            aria-label={`Search ${label} prediction source`}
            placeholder="search"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div id={listboxId} className="prediction-combobox-list" role="listbox">
            {filteredSources.length > 0 ? (
              filteredSources.map((source) => (
                <PredictionComboboxItem
                  key={source.id}
                  id={source.id}
                  label={source.label}
                  selected={source.id === selectedSource.id}
                  onSelect={selectSource}
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
