import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ leagueId: string; runId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { leagueId, runId } = await context.params;
  const supabase = await createClient();
  const { data: run, error } = await supabase
    .from("league_schedule_runs")
    .update({ schedule_status: "archived" })
    .eq("id", runId)
    .eq("league_id", leagueId)
    .in("schedule_status", ["draft", "published"])
    .select("id, schedule_status")
    .maybeSingle<{ id: string; schedule_status: string }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!run) {
    return NextResponse.json({ error: "Schedule run not found or already archived." }, { status: 404 });
  }

  return NextResponse.json({ schedule_run_id: run.id, schedule_status: "archived" });
}
