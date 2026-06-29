export type BracketLayoutMode = "symmetric" | "circular" | "team-circular";

export const DEFAULT_BRACKET_LAYOUT_MODE: BracketLayoutMode = "symmetric";

export const BRACKET_LAYOUT_MODES: BracketLayoutMode[] = [
  "symmetric",
  "circular",
  "team-circular",
];

export function getNextBracketLayoutMode(
  layoutMode: BracketLayoutMode,
): BracketLayoutMode {
  const currentIndex = BRACKET_LAYOUT_MODES.indexOf(layoutMode);
  return BRACKET_LAYOUT_MODES[
    (currentIndex + 1) % BRACKET_LAYOUT_MODES.length
  ];
}

export function isBracketLayoutMode(value: string | null): value is BracketLayoutMode {
  return BRACKET_LAYOUT_MODES.includes(value as BracketLayoutMode);
}
