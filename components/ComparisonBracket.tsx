"use client";

import clsx from "clsx";
import type { CSSProperties, PointerEvent } from "react";
import { BracketBoard } from "@/components/BracketBoard";
import { deriveDisplayMatches } from "@/lib/bracket";
import type { BracketLayoutMode } from "@/lib/bracket-layout-mode";
import {
  clampComparisonSplit,
  type ComparisonMode,
  type PredictionSource,
} from "@/lib/comparison";
import type { Match } from "@/lib/types";

type ComparisonBracketProps = {
  matches: Match[];
  sourceA: PredictionSource;
  sourceB: PredictionSource;
  mode: ComparisonMode;
  layoutMode?: BracketLayoutMode;
  split: number;
  now?: Date;
  activeMatchId: string | null;
  onSplitChange: (split: number) => void;
  onActivateMatch: (matchId: string) => void;
  onClearActiveMatch: () => void;
};

export function ComparisonBracket({
  matches,
  sourceA,
  sourceB,
  mode,
  layoutMode = "symmetric",
  split,
  now,
  activeMatchId,
  onSplitChange,
  onActivateMatch,
  onClearActiveMatch,
}: ComparisonBracketProps) {
  const displayMatchesA = deriveDisplayMatches(matches, sourceA.picks, now);
  const displayMatchesB = deriveDisplayMatches(matches, sourceB.picks, now);
  const safeSplit = clampComparisonSplit(split);

  function handlePointerSplit(event: PointerEvent<HTMLDivElement>) {
    if (mode !== "slider") return;

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;

    const nextSplit = ((event.clientX - rect.left) / rect.width) * 100;
    onSplitChange(clampComparisonSplit(nextSplit));
  }

  return (
    <div
      className={clsx("comparison-bracket", `comparison-bracket-${mode}`)}
      style={{ "--comparison-split": `${safeSplit}%` } as CSSProperties}
      data-source-a={sourceA.id}
      data-source-b={sourceB.id}
      onPointerDown={handlePointerSplit}
      onPointerMove={handlePointerSplit}
    >
      <div className="comparison-layer comparison-layer-b" aria-hidden="true">
        <BracketBoard
          className="comparison-visual-board comparison-visual-board-b"
          interactionMode="visual"
          layoutMode={layoutMode}
          comparison={mode === "overlay" ? { side: "b", otherPicks: sourceA.picks } : undefined}
          matches={displayMatchesB}
          picks={sourceB.picks}
          activeMatchId={activeMatchId}
          onActivateMatch={onActivateMatch}
          onClearActiveMatch={onClearActiveMatch}
          onPick={() => undefined}
        />
      </div>

      <div
        className={clsx(
          "comparison-layer comparison-layer-a",
          mode === "slider" && "comparison-slider-clip",
        )}
        aria-hidden="true"
      >
        <BracketBoard
          className="comparison-visual-board comparison-visual-board-a"
          interactionMode="visual"
          layoutMode={layoutMode}
          comparison={mode === "overlay" ? { side: "a", otherPicks: sourceB.picks } : undefined}
          matches={displayMatchesA}
          picks={sourceA.picks}
          activeMatchId={activeMatchId}
          onActivateMatch={onActivateMatch}
          onClearActiveMatch={onClearActiveMatch}
          onPick={() => undefined}
        />
      </div>

      {mode === "slider" ? (
        <div className="comparison-slider-divider" aria-hidden="true">
          <span />
        </div>
      ) : null}

      <div className="comparison-hit-layer">
        <BracketBoard
          className="comparison-hit-board"
          interactionMode="visual"
          layoutMode={layoutMode}
          matches={displayMatchesA}
          picks={sourceA.picks}
          activeMatchId={activeMatchId}
          onActivateMatch={onActivateMatch}
          onClearActiveMatch={onClearActiveMatch}
          onPick={() => undefined}
        />
      </div>
    </div>
  );
}
