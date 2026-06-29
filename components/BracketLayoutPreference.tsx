"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_BRACKET_LAYOUT_MODE,
  getNextBracketLayoutMode,
  isBracketLayoutMode,
  type BracketLayoutMode,
} from "@/lib/bracket-layout-mode";

const STORAGE_KEY = "world-cup-bracket-layout-v1";

type BracketLayoutPreferenceValue = {
  layoutMode: BracketLayoutMode;
  setLayoutMode: (layoutMode: BracketLayoutMode) => void;
  toggleLayoutMode: () => void;
};

const BracketLayoutPreferenceContext =
  createContext<BracketLayoutPreferenceValue | null>(null);

export function BracketLayoutPreferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [layoutMode, setLayoutModeState] = useState<BracketLayoutMode>(
    DEFAULT_BRACKET_LAYOUT_MODE,
  );

  useEffect(() => {
    setLayoutModeState(readStoredLayoutMode());
  }, []);

  function setLayoutMode(nextLayoutMode: BracketLayoutMode) {
    setLayoutModeState(nextLayoutMode);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLayoutMode);
    } catch {
      // The in-memory preference still updates when storage is unavailable.
    }
  }

  const value = useMemo(
    () => ({
      layoutMode,
      setLayoutMode,
      toggleLayoutMode: () => {
        setLayoutMode(getNextBracketLayoutMode(layoutMode));
      },
    }),
    [layoutMode],
  );

  return (
    <BracketLayoutPreferenceContext.Provider value={value}>
      {children}
    </BracketLayoutPreferenceContext.Provider>
  );
}

export function useBracketLayoutPreference() {
  const context = useContext(BracketLayoutPreferenceContext);
  if (!context) {
    throw new Error(
      "useBracketLayoutPreference must be used inside BracketLayoutPreferenceProvider",
    );
  }

  return context;
}

function readStoredLayoutMode(): BracketLayoutMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isBracketLayoutMode(stored) ? stored : DEFAULT_BRACKET_LAYOUT_MODE;
  } catch {
    return DEFAULT_BRACKET_LAYOUT_MODE;
  }
}
