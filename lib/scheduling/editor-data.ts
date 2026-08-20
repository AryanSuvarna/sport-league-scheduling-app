import { createClient } from "@/lib/supabase/server";
import {
  getScheduleIssues,
  type EditorAvailability,
  type EditorMatch,
  type EditorPermit,
  type EditorTeam,
  type ScheduleIssue,
  type ValidationContext,
  validSlotCount,
} from "./editor";

export type EditorField = { id: string; label: string; venue_name: string };
export type EditorRun = {
  id: string;
  solver_status: string;
  schedule_status: "draft" | "published" | "archived";
  objective_value: number | null;
  created_at: string;
  parent_schedule_run_id: string | null;
  input_snapshot: { settings?: { min_rest_hours?: number; max_matches_per_team_per_week?: number } } | null;
};

export type ScheduleEditorData = {
  league: {
    id: string;
    name: string;
    sport: string;
    season_start_date: string;
    season_end_date: string;
    match_duration_minutes: number;
    max_matches_per_team_per_week: number;
    teams: EditorTeam[];
  };
  run: EditorRun | null;
  matches: EditorMatch[];
  fields: EditorField[];
  permits: EditorPermit[];
  issues: ScheduleIssue[];
  validSlotCounts: Record<string, number>;
};

type LeagueRow = Omit<ScheduleEditorData["league"], "teams"> & { league_teams: EditorTeam[] };

export async function loadScheduleEditorData(leagueId: string): Promise<ScheduleEditorData | null> {
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, sport, season_start_date, season_end_date, match_duration_minutes, max_matches_per_team_per_week, league_teams(id, name)")
    .eq("id", leagueId)
    .maybeSingle<LeagueRow>();
  if (!league) return null;

  const { data: activeRuns } = await supabase
    .from("league_schedule_runs")
    .select("id, solver_status, schedule_status, objective_value, created_at, parent_schedule_run_id, input_snapshot")
    .eq("league_id", leagueId)
    .in("schedule_status", ["draft", "published"])
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<EditorRun[]>();
  const run = activeRuns?.[0] ?? null;

  const [matchesResult, permitsResult, availabilityResult] = await Promise.all([
    run ? supabase.from("league_matches").select("id, home_team_id, away_team_id, field_id, venue_availability_id, starts_at, ends_at, match_status, is_locked").eq("schedule_run_id", run.id).order("starts_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    supabase.from("venue_availability").select("id, field_id, permit_date, permit_start_time, permit_end_time, capacity").eq("league_id", leagueId).gte("permit_date", league.season_start_date).lte("permit_date", league.season_end_date).order("permit_date", { ascending: true }).order("permit_start_time", { ascending: true }),
    league.league_teams.length ? supabase.from("team_availability_submissions").select("team_id, available_start_date, available_end_date, available_dates, blackout_dates, has_day_preference, preferred_days_of_week, has_time_preference, preferred_times_of_day, created_at").in("team_id", league.league_teams.map((team) => team.id)).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  const rawMatches = matchesResult.data ?? [];
  const fieldIds = [...new Set([...rawMatches.map((match) => match.field_id), ...(permitsResult.data ?? []).map((permit) => permit.field_id)].filter((id): id is string => Boolean(id)))];
  const { data: rawFields } = fieldIds.length ? await supabase.from("fields").select("id, label, venues(name)").in("id", fieldIds) : { data: [] };
  const fields = ((rawFields ?? []) as unknown as Array<{ id: string; label: string; venues: { name: string } | null }>).map((field) => ({ id: field.id, label: field.label, venue_name: field.venues?.name ?? "Venue" }));
  const teams = new Map(league.league_teams.map((team) => [team.id, team.name]));
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const matches: EditorMatch[] = rawMatches.map((match) => {
    const field = match.field_id ? fieldsById.get(match.field_id) : null;
    return { ...match, field_id: match.field_id ?? null, venue_availability_id: match.venue_availability_id ?? null, starts_at: match.starts_at ?? null, ends_at: match.ends_at ?? null, is_locked: Boolean(match.is_locked), home_team_name: teams.get(match.home_team_id) ?? "Unknown team", away_team_name: teams.get(match.away_team_id) ?? "Unknown team", field_label: field?.label ?? null, venue_name: field?.venue_name ?? null } as EditorMatch;
  });
  const latestAvailability = new Map<string, EditorAvailability>();
  for (const row of (availabilityResult.data ?? []) as EditorAvailability[]) if (!latestAvailability.has(row.team_id)) latestAvailability.set(row.team_id, row);
  const context: ValidationContext = { matches, permits: (permitsResult.data ?? []) as EditorPermit[], availabilityByTeamId: latestAvailability, matchDurationMinutes: league.match_duration_minutes, maxMatchesPerTeamPerWeek: run?.input_snapshot?.settings?.max_matches_per_team_per_week ?? league.max_matches_per_team_per_week, minRestHours: run?.input_snapshot?.settings?.min_rest_hours ?? 0 };
  const issues = getScheduleIssues(matches, context);
  const validSlotCounts = Object.fromEntries(matches.filter((match) => !match.starts_at || !match.field_id).map((match) => [match.id, validSlotCount(match, context)]));
  return { league: { ...league, teams: league.league_teams }, run: run ?? null, matches, fields, permits: (permitsResult.data ?? []) as EditorPermit[], issues, validSlotCounts };
}
