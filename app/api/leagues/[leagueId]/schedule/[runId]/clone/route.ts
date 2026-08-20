import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SourceMatch = { id: string; parent_match_id: string | null; fixture_type: "regular" | "makeup"; home_team_id: string; away_team_id: string; field_id: string | null; venue_availability_id: string | null; starts_at: string | null; ends_at: string | null; match_status: string; is_locked: boolean };

export async function POST(_request: Request, context: RouteContext<"/api/leagues/[leagueId]/schedule/[runId]/clone">) {
  const { leagueId, runId } = await context.params;
  const supabase = await createClient();
  const { data: source, error: sourceError } = await supabase.from("league_schedule_runs").select("id, league_id, solver_status, input_snapshot, objective_value").eq("id", runId).eq("league_id", leagueId).maybeSingle();
  if (sourceError || !source) return NextResponse.json({ error: sourceError?.message ?? "Schedule run not found." }, { status: 404 });
  const { data: draft, error: draftError } = await supabase.from("league_schedule_runs").insert({ league_id: leagueId, solver_status: source.solver_status, schedule_status: "draft", input_snapshot: source.input_snapshot, objective_value: source.objective_value, parent_schedule_run_id: source.id }).select("id").single<{ id: string }>();
  if (draftError || !draft) return NextResponse.json({ error: draftError?.message ?? "Could not create draft." }, { status: 500 });
  const { data: matches, error: matchesError } = await supabase.from("league_matches").select("id, parent_match_id, fixture_type, home_team_id, away_team_id, field_id, venue_availability_id, starts_at, ends_at, match_status, is_locked").eq("schedule_run_id", source.id).returns<SourceMatch[]>();
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 });
  const copiedIds = new Map<string, string>();
  const matchesToCopy = [
    ...(matches ?? []).filter((match) => match.fixture_type === "regular"),
    ...(matches ?? []).filter((match) => match.fixture_type === "makeup"),
  ];
  for (const match of matchesToCopy) {
    const { data: copied, error } = await supabase.from("league_matches").insert({ schedule_run_id: draft.id, parent_match_id: match.parent_match_id ? copiedIds.get(match.parent_match_id) ?? null : null, fixture_type: match.fixture_type, home_team_id: match.home_team_id, away_team_id: match.away_team_id, field_id: match.field_id, venue_availability_id: match.venue_availability_id, starts_at: match.starts_at, ends_at: match.ends_at, match_status: match.match_status, is_locked: match.is_locked }).select("id").single<{ id: string }>();
    if (error || !copied) return NextResponse.json({ error: error?.message ?? "Could not copy schedule fixtures." }, { status: 500 });
    copiedIds.set(match.id, copied.id);
  }
  return NextResponse.json({ schedule_run_id: draft.id, schedule_status: "draft" }, { status: 201 });
}
