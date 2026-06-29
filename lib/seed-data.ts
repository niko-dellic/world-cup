import type { BracketData, BracketRound, Match, Team } from "@/lib/types";
import { makeTeam } from "@/lib/teams";

const ROUND_NAMES: Record<BracketRound, string> = {
  "round-of-32": "Round of 32",
  "round-of-16": "Round of 16",
  quarterfinals: "Quarterfinals",
  semifinals: "Semifinals",
  final: "Final",
};

const DEMO_TEAM_INPUTS: Array<Pick<Team, "id" | "name" | "shortName" | "countryCode">> = [
  { id: "argentina", name: "Argentina", shortName: "ARG", countryCode: "AR" },
  { id: "mexico", name: "Mexico", shortName: "MEX", countryCode: "MX" },
  { id: "france", name: "France", shortName: "FRA", countryCode: "FR" },
  { id: "japan", name: "Japan", shortName: "JPN", countryCode: "JP" },
  { id: "brazil", name: "Brazil", shortName: "BRA", countryCode: "BR" },
  { id: "senegal", name: "Senegal", shortName: "SEN", countryCode: "SN" },
  { id: "spain", name: "Spain", shortName: "ESP", countryCode: "ES" },
  { id: "usa", name: "United States", shortName: "USA", countryCode: "US" },
  { id: "england", name: "England", shortName: "ENG", countryCode: "GB" },
  { id: "colombia", name: "Colombia", shortName: "COL", countryCode: "CO" },
  { id: "germany", name: "Germany", shortName: "GER", countryCode: "DE" },
  { id: "morocco", name: "Morocco", shortName: "MAR", countryCode: "MA" },
  { id: "portugal", name: "Portugal", shortName: "POR", countryCode: "PT" },
  { id: "uruguay", name: "Uruguay", shortName: "URU", countryCode: "UY" },
  { id: "netherlands", name: "Netherlands", shortName: "NED", countryCode: "NL" },
  { id: "ghana", name: "Ghana", shortName: "GHA", countryCode: "GH" },
  { id: "italy", name: "Italy", shortName: "ITA", countryCode: "IT" },
  { id: "canada", name: "Canada", shortName: "CAN", countryCode: "CA" },
  { id: "croatia", name: "Croatia", shortName: "CRO", countryCode: "HR" },
  { id: "australia", name: "Australia", shortName: "AUS", countryCode: "AU" },
  { id: "belgium", name: "Belgium", shortName: "BEL", countryCode: "BE" },
  { id: "south-korea", name: "South Korea", shortName: "KOR", countryCode: "KR" },
  { id: "switzerland", name: "Switzerland", shortName: "SUI", countryCode: "CH" },
  { id: "egypt", name: "Egypt", shortName: "EGY", countryCode: "EG" },
  { id: "denmark", name: "Denmark", shortName: "DEN", countryCode: "DK" },
  { id: "nigeria", name: "Nigeria", shortName: "NGA", countryCode: "NG" },
  { id: "chile", name: "Chile", shortName: "CHI", countryCode: "CL" },
  { id: "qatar", name: "Qatar", shortName: "QAT", countryCode: "QA" },
  { id: "sweden", name: "Sweden", shortName: "SWE", countryCode: "SE" },
  { id: "costa-rica", name: "Costa Rica", shortName: "CRC", countryCode: "CR" },
  { id: "poland", name: "Poland", shortName: "POL", countryCode: "PL" },
  { id: "cameroon", name: "Cameroon", shortName: "CMR", countryCode: "CM" },
];

const DEMO_TEAMS: Team[] = DEMO_TEAM_INPUTS.map((team) => makeTeam(team));

const ROUND_SPECS: Array<{
  round: BracketRound;
  count: number;
  firstKickoff: string;
  hourStep: number;
}> = [
  { round: "round-of-32", count: 16, firstKickoff: "2026-06-28T16:00:00.000Z", hourStep: 5 },
  { round: "round-of-16", count: 8, firstKickoff: "2026-07-04T16:00:00.000Z", hourStep: 6 },
  { round: "quarterfinals", count: 4, firstKickoff: "2026-07-09T19:00:00.000Z", hourStep: 24 },
  { round: "semifinals", count: 2, firstKickoff: "2026-07-14T19:00:00.000Z", hourStep: 24 },
  { round: "final", count: 1, firstKickoff: "2026-07-19T19:00:00.000Z", hourStep: 0 },
];

function kickoffAt(firstKickoff: string, slot: number, hourStep: number) {
  const date = new Date(firstKickoff);
  date.setUTCHours(date.getUTCHours() + (slot - 1) * hourStep);
  return date.toISOString();
}

export function createSeedBracket(refreshedAt = new Date().toISOString()): BracketData {
  const matches: Match[] = [];

  for (const spec of ROUND_SPECS) {
    for (let slot = 1; slot <= spec.count; slot += 1) {
      const isOpeningRound = spec.round === "round-of-32";
      const homeTeam = isOpeningRound ? DEMO_TEAMS[(slot - 1) * 2] : null;
      const awayTeam = isOpeningRound ? DEMO_TEAMS[(slot - 1) * 2 + 1] : null;

      matches.push({
        id: `${spec.round}-${slot}`,
        round: spec.round,
        roundName: ROUND_NAMES[spec.round],
        slot,
        kickoffTime: kickoffAt(spec.firstKickoff, slot, spec.hourStep),
        status: "scheduled",
        homeTeam,
        awayTeam,
        homeScore: null,
        awayScore: null,
        winnerTeamId: null,
        providerData: { seeded: true },
      });
    }
  }

  return {
    source: "seeded",
    refreshedAt,
    matches,
  };
}
