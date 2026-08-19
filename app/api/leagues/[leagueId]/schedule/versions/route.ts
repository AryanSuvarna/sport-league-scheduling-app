import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type VersionRow = {
  id: string;
  created_at: string;
  solver_status: "optimal" | "feasible";
  objective_value: number | null;
};

export async function GET(_request: Request, context: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await context.params;
  const supabase = await createClient();
  const { data: runs, error: runsError } = await supabase
    .from("league_schedule_runs")
    .select("id, created_at, solver_status, objective_value")
    .eq("league_id", leagueId)
    .eq("schedule_status", "archived")
    .order("created_at", { ascending: false })
    .returns<VersionRow[]>();
  if (runsError) return NextResponse.json({ error: runsError.message }, { status: 500 });
  const runIds = (runs ?? []).map((run) => run.id);
  const { data: matches, error: matchesError } = runIds.length
    ? await supabase.from("league_matches").select("schedule_run_id").in("schedule_run_id", runIds)
    : { data: [], error: null };
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 });
  const fixtureCounts = new Map<string, number>();
  for (const match of matches ?? []) fixtureCounts.set(match.schedule_run_id, (fixtureCounts.get(match.schedule_run_id) ?? 0) + 1);
  return NextResponse.json({ versions: (runs ?? []).map((run) => ({ ...run, fixture_count: fixtureCounts.get(run.id) ?? 0 })) });
}
