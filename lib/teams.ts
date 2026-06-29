import type { Team } from "@/lib/types";

const COLOR_PALETTE: Array<[string, string]> = [
  ["#e11d48", "#facc15"],
  ["#0ea5e9", "#22c55e"],
  ["#f97316", "#14b8a6"],
  ["#a855f7", "#f43f5e"],
  ["#84cc16", "#06b6d4"],
  ["#f59e0b", "#ef4444"],
  ["#10b981", "#fde047"],
  ["#38bdf8", "#fb7185"],
];

const TEAM_COLOR_OVERRIDES: Record<string, [string, string]> = {
  arg: ["#74acdf", "#ffffff"],
  bra: ["#009c3b", "#ffdf00"],
  eng: ["#ffffff", "#cf142b"],
  esp: ["#aa151b", "#f1bf00"],
  fra: ["#0055a4", "#ef4135"],
  ger: ["#000000", "#dd0000"],
  ita: ["#008c45", "#cd212a"],
  mex: ["#006847", "#ce1126"],
  ned: ["#ff7f00", "#21468b"],
  por: ["#006600", "#ff0000"],
  usa: ["#3c3b6e", "#b22234"],
};

export function countryCodeToFlagEmoji(countryCode?: string): string | undefined {
  if (!countryCode || countryCode.length !== 2) return undefined;

  const upper = countryCode.toUpperCase();
  const chars = [...upper].map((char) => {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) return "";
    return String.fromCodePoint(127397 + code);
  });

  return chars.every(Boolean) ? chars.join("") : undefined;
}

export function slugifyTeamId(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function initialsFor(name: string): string {
  const tokens = name
    .replace(/\(.+?\)/g, "")
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return "TBD";
  if (tokens.length === 1) return tokens[0].slice(0, 3).toUpperCase();
  return tokens
    .slice(0, 3)
    .map((token) => token[0])
    .join("")
    .toUpperCase();
}

export function colorsForTeam(seed: string): [string, string] {
  const override = TEAM_COLOR_OVERRIDES[seed.toLowerCase()];
  if (override) return override;

  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}

export function makeTeam(input: {
  id?: string;
  name: string;
  shortName?: string;
  countryCode?: string;
  providerId?: string;
}): Team {
  const id = input.id ?? slugifyTeamId(input.providerId ?? input.name);
  const shortName = input.shortName ?? initialsFor(input.name);
  return {
    id,
    name: input.name,
    shortName,
    countryCode: input.countryCode?.toUpperCase(),
    flagEmoji: countryCodeToFlagEmoji(input.countryCode),
    colors: colorsForTeam(input.countryCode ?? id),
    providerId: input.providerId,
  };
}

export function placeholderTeam(label: string, slot: string): Team {
  const id = `placeholder-${slugifyTeamId(slot)}`;
  return {
    id,
    name: label,
    shortName: "TBD",
    flagEmoji: "🏆",
    colors: colorsForTeam(id),
  };
}
