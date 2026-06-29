import "server-only";

import type { BracketData, Match, PredictionBracket, Team } from "@/lib/types";
import { createSeedBracket } from "@/lib/seed-data";
import { fetchWorldCupBracket } from "@/lib/providers/fotmob";
import { createSupabaseAdminClient, createSupabaseReadClient } from "@/lib/supabase/server";

type TeamRow = {
  id: string;
  provider_id: string | null;
  name: string;
  short_name: string;
  country_code: string | null;
  flag_emoji: string | null;
  colors: string[] | null;
};

type MatchRow = {
  id: string;
  provider_id: string | null;
  round: Match["round"];
  round_name: string;
  slot: number;
  kickoff_time: string | null;
  status: Match["status"];
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: string | null;
  provider_data: Record<string, unknown> | null;
};

type PredictionRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  picks: Record<string, string | null | undefined>;
  updated_at: string;
};

export async function getBracketData(): Promise<BracketData> {
  const supabase = createSupabaseReadClient();
  if (!supabase) return createSeedBracket();

  const [{ data: teams, error: teamsError }, { data: matches, error: matchesError }] =
    await Promise.all([
      supabase.from("teams").select("*"),
      supabase.from("matches").select("*").order("slot", { ascending: true }),
    ]);

  if (teamsError || matchesError || !matches?.length) {
    return createSeedBracket();
  }

  const teamById = new Map((teams as TeamRow[]).map((team) => [team.id, rowToTeam(team)]));
  const normalizedMatches = (matches as MatchRow[])
    .map((match) => rowToMatch(match, teamById))
    .sort((a, b) => {
      if (a.round === b.round) return a.slot - b.slot;
      return roundSort(a.round) - roundSort(b.round);
    });

  return {
    source: "supabase",
    refreshedAt: new Date().toISOString(),
    matches: normalizedMatches,
  };
}

export async function refreshAndPersistBracket() {
  const bracket = await fetchWorldCupBracket();
  await persistBracketData(bracket);
  return bracket;
}

export async function persistBracketData(bracket: BracketData) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { persisted: false };

  const teams = collectTeams(bracket.matches);
  if (teams.length > 0) {
    const { error } = await supabase.from("teams").upsert(
      teams.map((team) => ({
        id: team.id,
        provider_id: team.providerId ?? null,
        name: team.name,
        short_name: team.shortName,
        country_code: team.countryCode ?? null,
        flag_emoji: team.flagEmoji ?? null,
        colors: team.colors,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "id" },
    );

    if (error) throw error;
  }

  const { error: matchError } = await supabase.from("matches").upsert(
    bracket.matches.map((match) => ({
      id: match.id,
      provider_id: match.providerId ?? null,
      round: match.round,
      round_name: match.roundName,
      slot: match.slot,
      kickoff_time: match.kickoffTime,
      status: match.status,
      home_team_id: match.homeTeam?.id ?? null,
      away_team_id: match.awayTeam?.id ?? null,
      home_score: match.homeScore,
      away_score: match.awayScore,
      winner_team_id: match.winnerTeamId,
      provider_data: match.providerData ?? {},
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "id" },
  );

  if (matchError) throw matchError;

  await supabase.from("bracket_refreshes").insert({
    source: bracket.source,
    match_count: bracket.matches.length,
    refreshed_at: bracket.refreshedAt,
  });

  return { persisted: true };
}

export async function getPredictionRows(): Promise<PredictionBracket[]> {
  const supabase = createSupabaseReadClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("prediction_brackets")
    .select("id,user_id,display_name,picks,updated_at")
    .order("updated_at", { ascending: true });

  if (error || !data) return [];

  return (data as PredictionRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name?.trim() || "Anonymous",
    picks: row.picks ?? {},
    updatedAt: row.updated_at,
  }));
}

function collectTeams(matches: Match[]): Team[] {
  const teamById = new Map<string, Team>();
  for (const match of matches) {
    if (match.homeTeam) teamById.set(match.homeTeam.id, match.homeTeam);
    if (match.awayTeam) teamById.set(match.awayTeam.id, match.awayTeam);
  }
  return [...teamById.values()];
}

function rowToTeam(row: TeamRow): Team {
  const colors = row.colors;
  return {
    id: row.id,
    providerId: row.provider_id ?? undefined,
    name: row.name,
    shortName: row.short_name,
    countryCode: row.country_code ?? undefined,
    flagEmoji: row.flag_emoji ?? undefined,
    colors:
      colors && colors.length >= 2
        ? [colors[0], colors[1]]
        : ["#0ea5e9", "#f97316"],
  };
}

function rowToMatch(row: MatchRow, teamById: Map<string, Team>): Match {
  return {
    id: row.id,
    providerId: row.provider_id ?? undefined,
    round: row.round,
    roundName: row.round_name,
    slot: row.slot,
    kickoffTime: row.kickoff_time,
    status: row.status,
    homeTeam: row.home_team_id ? teamById.get(row.home_team_id) ?? null : null,
    awayTeam: row.away_team_id ? teamById.get(row.away_team_id) ?? null : null,
    homeScore: row.home_score,
    awayScore: row.away_score,
    winnerTeamId: row.winner_team_id,
    providerData: row.provider_data ?? undefined,
  };
}

function roundSort(round: Match["round"]) {
  return {
    "round-of-32": 0,
    "round-of-16": 1,
    quarterfinals: 2,
    semifinals: 3,
    final: 4,
  }[round];
}
