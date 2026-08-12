import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ leagueId: string; runId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { leagueId, runId } = await context.params;
  const supabase = await createClient();

  const { data: run, error: runError } = await supabase
    .from("league_schedule_runs")
    .select("id, league_id, schedule_status")
    .eq("id", runId)
    .eq("league_id", leagueId)
    .maybeSingle<{ id: string; league_id: string; schedule_status: string }>();

  if (runError) {
    return NextResponse.json({ error: runError.message }, { status: 500 });
  }

  if (!run) {
    return NextResponse.json({ error: "Schedule run not found." }, { status: 404 });
  }

  if (run.schedule_status === "published") {
    return NextResponse.json({ message: "Schedule is already published.", schedule_run_id: run.id });
  }

  // Archive the previous published version before publishing this run. The
  // partial unique index in schedules.sql guarantees that only one published
  // run can exist for a league.
  const { error: archiveError } = await supabase
    .from("league_schedule_runs")
    .update({ schedule_status: "archived" })
    .eq("league_id", leagueId)
    .eq("schedule_status", "published");

  if (archiveError) {
    return NextResponse.json({ error: archiveError.message }, { status: 500 });
  }

  const { data: publishedRun, error: publishError } = await supabase
    .from("league_schedule_runs")
    .update({ schedule_status: "published" })
    .eq("id", runId)
    .eq("league_id", leagueId)
    .eq("schedule_status", "draft")
    .select("id, schedule_status")
    .single<{ id: string; schedule_status: string }>();

  if (publishError || !publishedRun) {
    return NextResponse.json(
      { error: publishError?.message ?? "Only draft schedules can be published." },
      { status: 409 },
    );
  }

  return NextResponse.json({ schedule_run_id: publishedRun.id, schedule_status: "published" });
}
