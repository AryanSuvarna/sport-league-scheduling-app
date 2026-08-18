import { NextResponse } from "next/server";
import { loadScheduleEditorData } from "@/lib/scheduling/editor-data";
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

  const editor = await loadScheduleEditorData(leagueId);
  if (!editor || editor.run?.id !== runId) {
    return NextResponse.json({ error: "This draft is not the active editable schedule." }, { status: 409 });
  }
  const hardIssues = editor.issues.filter((issue) => issue.severity === "conflict");
  const unscheduled = editor.matches.filter((match) => !match.starts_at || !match.field_id);
  if (hardIssues.length || unscheduled.length) {
    return NextResponse.json({ error: "Resolve all conflicts and unscheduled fixtures before publishing.", conflicts: hardIssues.length, unscheduled: unscheduled.length }, { status: 409 });
  }

  const { data: publishedRun, error: publishError } = await supabase
    .rpc("publish_schedule_run", { target_run_id: runId, target_league_id: leagueId })
    .single<{ id: string; schedule_status: string }>();

  if (publishError || !publishedRun) {
    return NextResponse.json(
      { error: publishError?.message ?? "Only draft schedules can be published." },
      { status: 409 },
    );
  }

  return NextResponse.json({ schedule_run_id: publishedRun.id, schedule_status: "published" });
}
