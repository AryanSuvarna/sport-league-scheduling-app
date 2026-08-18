import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, context: RouteContext<"/api/leagues/[leagueId]/schedule/[runId]/clone">) {
  const { leagueId, runId } = await context.params;
  const supabase = await createClient();
  const { data: source, error: sourceError } = await supabase.from("league_schedule_runs").select("id, league_id, solver_status, input_snapshot, objective_value").eq("id", runId).eq("league_id", leagueId).maybeSingle();
  if (sourceError || !source) return NextResponse.json({ error: sourceError?.message ?? "Schedule run not found." }, { status: 404 });
  const { data: draft, error: draftError } = await supabase.from("league_schedule_runs").insert({ league_id: leagueId, solver_status: source.solver_status, schedule_status: "draft", input_snapshot: source.input_snapshot, objective_value: source.objective_value, parent_schedule_run_id: source.id }).select("id").single<{ id: string }>();
  if (draftError || !draft) return NextResponse.json({ error: draftError?.message ?? "Could not create draft." }, { status: 500 });
  const { data: matches, error: matchesError } = await supabase.from("league_matches").select("home_team_id, away_team_id, field_id, venue_availability_id, starts_at, ends_at, match_status, is_locked").eq("schedule_run_id", source.id);
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 });
  if ((matches ?? []).length) {
    const { error } = await supabase.from("league_matches").insert(matches.map((match) => ({ ...match, schedule_run_id: draft.id })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ schedule_run_id: draft.id, schedule_status: "draft" }, { status: 201 });
}
