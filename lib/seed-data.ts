import type { BracketData, BracketRound, Match, MatchStatus, Team } from "@/lib/types";
import { makeTeam } from "@/lib/teams";

const ROUND_NAMES: Record<BracketRound, string> = {
  "round-of-32": "Round of 32",
  "round-of-16": "Round of 16",
  quarterfinals: "Quarterfinals",
  semifinals: "Semifinals",
  final: "Final",
};

type TeamInput = Pick<Team, "id" | "name" | "shortName" | "countryCode">;

const TEAM_INPUTS: TeamInput[] = [
  { id: "algeria", name: "Algeria", shortName: "ALG", countryCode: "DZ" },
  { id: "argentina", name: "Argentina", shortName: "ARG", countryCode: "AR" },
  { id: "australia", name: "Australia", shortName: "AUS", countryCode: "AU" },
  { id: "austria", name: "Austria", shortName: "AUT", countryCode: "AT" },
  { id: "belgium", name: "Belgium", shortName: "BEL", countryCode: "BE" },
  { id: "bosnia-and-herzegovina", name: "Bosnia and Herzegovina", shortName: "BIH", countryCode: "BA" },
  { id: "brazil", name: "Brazil", shortName: "BRA", countryCode: "BR" },
  { id: "cabo-verde", name: "Cabo Verde", shortName: "CPV", countryCode: "CV" },
  { id: "canada", name: "Canada", shortName: "CAN", countryCode: "CA" },
  { id: "colombia", name: "Colombia", shortName: "COL", countryCode: "CO" },
  { id: "croatia", name: "Croatia", shortName: "CRO", countryCode: "HR" },
  { id: "dr-congo", name: "DR Congo", shortName: "COD", countryCode: "CD" },
  { id: "ecuador", name: "Ecuador", shortName: "ECU", countryCode: "EC" },
  { id: "egypt", name: "Egypt", shortName: "EGY", countryCode: "EG" },
  { id: "england", name: "England", shortName: "ENG", countryCode: "GB" },
  { id: "france", name: "France", shortName: "FRA", countryCode: "FR" },
  { id: "germany", name: "Germany", shortName: "GER", countryCode: "DE" },
  { id: "ghana", name: "Ghana", shortName: "GHA", countryCode: "GH" },
  { id: "ivory-coast", name: "Ivory Coast", shortName: "CIV", countryCode: "CI" },
  { id: "japan", name: "Japan", shortName: "JPN", countryCode: "JP" },
  { id: "mexico", name: "Mexico", shortName: "MEX", countryCode: "MX" },
  { id: "morocco", name: "Morocco", shortName: "MAR", countryCode: "MA" },
  { id: "netherlands", name: "Netherlands", shortName: "NED", countryCode: "NL" },
  { id: "norway", name: "Norway", shortName: "NOR", countryCode: "NO" },
  { id: "paraguay", name: "Paraguay", shortName: "PAR", countryCode: "PY" },
  { id: "portugal", name: "Portugal", shortName: "POR", countryCode: "PT" },
  { id: "senegal", name: "Senegal", shortName: "SEN", countryCode: "SN" },
  { id: "south-africa", name: "South Africa", shortName: "RSA", countryCode: "ZA" },
  { id: "spain", name: "Spain", shortName: "ESP", countryCode: "ES" },
  { id: "sweden", name: "Sweden", shortName: "SWE", countryCode: "SE" },
  { id: "switzerland", name: "Switzerland", shortName: "SUI", countryCode: "CH" },
  { id: "united-states", name: "United States", shortName: "USA", countryCode: "US" },
];

const TEAMS = new Map(TEAM_INPUTS.map((team) => [team.id, makeTeam(team)]));

type MatchSpec = {
  number: number;
  round: BracketRound;
  slot: number;
  visualSlot: number;
  kickoffTime: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeSourceMatchId?: string;
  awaySourceMatchId?: string;
  homeSourceLabel?: string;
  awaySourceLabel?: string;
  status?: MatchStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  winnerTeamId?: string | null;
};

const MATCH_SPECS: MatchSpec[] = [
  {
    number: 73,
    round: "round-of-32",
    slot: 1,
    visualSlot: 3,
    kickoffTime: "2026-06-28T16:00:00.000Z",
    homeTeamId: "canada",
    awayTeamId: "south-africa",
    status: "completed",
    homeScore: 1,
    awayScore: 0,
    winnerTeamId: "canada",
  },
  {
    number: 74,
    round: "round-of-32",
    slot: 2,
    visualSlot: 1,
    kickoffTime: "2026-06-30T16:00:00.000Z",
    homeTeamId: "germany",
    awayTeamId: "paraguay",
  },
  {
    number: 75,
    round: "round-of-32",
    slot: 3,
    visualSlot: 4,
    kickoffTime: "2026-06-30T19:00:00.000Z",
    homeTeamId: "netherlands",
    awayTeamId: "morocco",
  },
  {
    number: 76,
    round: "round-of-32",
    slot: 4,
    visualSlot: 9,
    kickoffTime: "2026-06-30T22:00:00.000Z",
    homeTeamId: "brazil",
    awayTeamId: "japan",
  },
  {
    number: 77,
    round: "round-of-32",
    slot: 5,
    visualSlot: 2,
    kickoffTime: "2026-07-01T16:00:00.000Z",
    homeTeamId: "france",
    awayTeamId: "sweden",
  },
  {
    number: 78,
    round: "round-of-32",
    slot: 6,
    visualSlot: 10,
    kickoffTime: "2026-07-01T19:00:00.000Z",
    homeTeamId: "ivory-coast",
    awayTeamId: "norway",
  },
  {
    number: 79,
    round: "round-of-32",
    slot: 7,
    visualSlot: 11,
    kickoffTime: "2026-07-01T22:00:00.000Z",
    homeTeamId: "mexico",
    awayTeamId: "ecuador",
  },
  {
    number: 80,
    round: "round-of-32",
    slot: 8,
    visualSlot: 12,
    kickoffTime: "2026-07-02T16:00:00.000Z",
    homeTeamId: "england",
    awayTeamId: "dr-congo",
  },
  {
    number: 81,
    round: "round-of-32",
    slot: 9,
    visualSlot: 7,
    kickoffTime: "2026-07-02T19:00:00.000Z",
    homeTeamId: "united-states",
    awayTeamId: "bosnia-and-herzegovina",
  },
  {
    number: 82,
    round: "round-of-32",
    slot: 10,
    visualSlot: 8,
    kickoffTime: "2026-07-02T22:00:00.000Z",
    homeTeamId: "belgium",
    awayTeamId: "senegal",
  },
  {
    number: 83,
    round: "round-of-32",
    slot: 11,
    visualSlot: 5,
    kickoffTime: "2026-07-03T16:00:00.000Z",
    homeTeamId: "portugal",
    awayTeamId: "croatia",
  },
  {
    number: 84,
    round: "round-of-32",
    slot: 12,
    visualSlot: 6,
    kickoffTime: "2026-07-03T19:00:00.000Z",
    homeTeamId: "spain",
    awayTeamId: "austria",
  },
  {
    number: 85,
    round: "round-of-32",
    slot: 13,
    visualSlot: 15,
    kickoffTime: "2026-07-03T22:00:00.000Z",
    homeTeamId: "switzerland",
    awayTeamId: "algeria",
  },
  {
    number: 86,
    round: "round-of-32",
    slot: 14,
    visualSlot: 13,
    kickoffTime: "2026-07-04T16:00:00.000Z",
    homeTeamId: "argentina",
    awayTeamId: "cabo-verde",
  },
  {
    number: 87,
    round: "round-of-32",
    slot: 15,
    visualSlot: 16,
    kickoffTime: "2026-07-04T19:00:00.000Z",
    homeTeamId: "colombia",
    awayTeamId: "ghana",
  },
  {
    number: 88,
    round: "round-of-32",
    slot: 16,
    visualSlot: 14,
    kickoffTime: "2026-07-04T22:00:00.000Z",
    homeTeamId: "australia",
    awayTeamId: "egypt",
  },
  {
    number: 89,
    round: "round-of-16",
    slot: 1,
    visualSlot: 1,
    kickoffTime: "2026-07-06T16:00:00.000Z",
    homeSourceMatchId: "m74",
    awaySourceMatchId: "m77",
  },
  {
    number: 90,
    round: "round-of-16",
    slot: 2,
    visualSlot: 2,
    kickoffTime: "2026-07-06T20:00:00.000Z",
    homeSourceMatchId: "m73",
    awaySourceMatchId: "m75",
  },
  {
    number: 91,
    round: "round-of-16",
    slot: 3,
    visualSlot: 5,
    kickoffTime: "2026-07-07T00:00:00.000Z",
    homeSourceMatchId: "m76",
    awaySourceMatchId: "m78",
  },
  {
    number: 92,
    round: "round-of-16",
    slot: 4,
    visualSlot: 6,
    kickoffTime: "2026-07-07T16:00:00.000Z",
    homeSourceMatchId: "m79",
    awaySourceMatchId: "m80",
  },
  {
    number: 93,
    round: "round-of-16",
    slot: 5,
    visualSlot: 3,
    kickoffTime: "2026-07-07T20:00:00.000Z",
    homeSourceMatchId: "m83",
    awaySourceMatchId: "m84",
  },
  {
    number: 94,
    round: "round-of-16",
    slot: 6,
    visualSlot: 4,
    kickoffTime: "2026-07-08T00:00:00.000Z",
    homeSourceMatchId: "m81",
    awaySourceMatchId: "m82",
  },
  {
    number: 95,
    round: "round-of-16",
    slot: 7,
    visualSlot: 7,
    kickoffTime: "2026-07-08T16:00:00.000Z",
    homeSourceMatchId: "m86",
    awaySourceMatchId: "m88",
  },
  {
    number: 96,
    round: "round-of-16",
    slot: 8,
    visualSlot: 8,
    kickoffTime: "2026-07-08T20:00:00.000Z",
    homeSourceMatchId: "m85",
    awaySourceMatchId: "m87",
  },
  {
    number: 97,
    round: "quarterfinals",
    slot: 1,
    visualSlot: 1,
    kickoffTime: "2026-07-10T19:00:00.000Z",
    homeSourceMatchId: "m89",
    awaySourceMatchId: "m90",
  },
  {
    number: 98,
    round: "quarterfinals",
    slot: 2,
    visualSlot: 2,
    kickoffTime: "2026-07-11T19:00:00.000Z",
    homeSourceMatchId: "m93",
    awaySourceMatchId: "m94",
  },
  {
    number: 99,
    round: "quarterfinals",
    slot: 3,
    visualSlot: 3,
    kickoffTime: "2026-07-12T19:00:00.000Z",
    homeSourceMatchId: "m91",
    awaySourceMatchId: "m92",
  },
  {
    number: 100,
    round: "quarterfinals",
    slot: 4,
    visualSlot: 4,
    kickoffTime: "2026-07-13T19:00:00.000Z",
    homeSourceMatchId: "m95",
    awaySourceMatchId: "m96",
  },
  {
    number: 101,
    round: "semifinals",
    slot: 1,
    visualSlot: 1,
    kickoffTime: "2026-07-14T19:00:00.000Z",
    homeSourceMatchId: "m97",
    awaySourceMatchId: "m98",
  },
  {
    number: 102,
    round: "semifinals",
    slot: 2,
    visualSlot: 2,
    kickoffTime: "2026-07-15T19:00:00.000Z",
    homeSourceMatchId: "m99",
    awaySourceMatchId: "m100",
  },
  {
    number: 104,
    round: "final",
    slot: 1,
    visualSlot: 1,
    kickoffTime: "2026-07-19T19:00:00.000Z",
    homeSourceMatchId: "m101",
    awaySourceMatchId: "m102",
  },
];

export function createWorldCup2026Bracket(refreshedAt = new Date().toISOString()): BracketData {
  return {
    source: "static",
    refreshedAt,
    matches: MATCH_SPECS.map(specToMatch),
  };
}

export function createSeedBracket(refreshedAt = new Date().toISOString()): BracketData {
  return createWorldCup2026Bracket(refreshedAt);
}

function specToMatch(spec: MatchSpec): Match {
  const homeTeam = spec.homeTeamId ? getTeam(spec.homeTeamId) : null;
  const awayTeam = spec.awayTeamId ? getTeam(spec.awayTeamId) : null;

  return {
    id: `m${spec.number}`,
    providerId: `fifa-${spec.number}`,
    matchNumber: spec.number,
    round: spec.round,
    roundName: ROUND_NAMES[spec.round],
    slot: spec.slot,
    visualSlot: spec.visualSlot,
    kickoffTime: spec.kickoffTime,
    status: spec.status ?? "scheduled",
    homeTeam,
    awayTeam,
    homeSourceMatchId: spec.homeSourceMatchId ?? null,
    awaySourceMatchId: spec.awaySourceMatchId ?? null,
    homeSourceLabel: spec.homeSourceLabel ?? sourceLabel(spec.homeSourceMatchId),
    awaySourceLabel: spec.awaySourceLabel ?? sourceLabel(spec.awaySourceMatchId),
    homeScore: spec.homeScore ?? null,
    awayScore: spec.awayScore ?? null,
    winnerTeamId: spec.winnerTeamId ?? null,
    providerData: { staticGraph: true },
  };
}

function getTeam(id: string): Team {
  const team = TEAMS.get(id);
  if (!team) throw new Error(`Unknown static World Cup team: ${id}`);
  return team;
}

function sourceLabel(sourceMatchId?: string) {
  if (!sourceMatchId) return null;
  return `Winner ${sourceMatchId.toUpperCase()}`;
}
