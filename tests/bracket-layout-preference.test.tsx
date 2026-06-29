import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BracketBoard } from "@/components/BracketBoard";
import {
  BracketLayoutPreferenceProvider,
  useBracketLayoutPreference,
} from "@/components/BracketLayoutPreference";
import { deriveDisplayMatches } from "@/lib/bracket";
import { createSeedBracket } from "@/lib/seed-data";

const STORAGE_KEY = "world-cup-bracket-layout-v1";

describe("bracket layout preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("toggles and stores the selected layout mode", () => {
    render(
      createElement(
        BracketLayoutPreferenceProvider,
        null,
        createElement(PreferenceProbe),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "symmetric" }));

    expect(screen.getByRole("button", { name: "circular" })).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("circular");
  });

  it("reads the stored layout mode", async () => {
    window.localStorage.setItem(STORAGE_KEY, "circular");

    render(
      createElement(
        BracketLayoutPreferenceProvider,
        null,
        createElement(PreferenceProbe),
      ),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "circular" })).toBeInTheDocument();
    });
  });
});

describe("BracketBoard layout modes", () => {
  it("renders circular mode when requested", () => {
    const matches = deriveDisplayMatches(createSeedBracket().matches, {});

    render(
      createElement(BracketBoard, {
        matches,
        picks: {},
        layoutMode: "circular",
        activeMatchId: null,
        onActivateMatch: vi.fn(),
        onClearActiveMatch: vi.fn(),
        onPick: vi.fn(),
      }),
    );

    const board = screen.getByLabelText("World Cup knockout bracket");

    expect(board).toHaveAttribute("data-layout-mode", "circular");
    expect(board.querySelector(".circular-bracket-connectors")).toBeInTheDocument();
  });
});

function PreferenceProbe() {
  const { layoutMode, toggleLayoutMode } = useBracketLayoutPreference();

  return createElement(
    "button",
    {
      type: "button",
      onClick: toggleLayoutMode,
    },
    layoutMode,
  );
}
