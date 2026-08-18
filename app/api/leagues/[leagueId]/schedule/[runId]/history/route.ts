import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type EditState = { starts_at?: string | null; ends_at?: string | null; field_id?: string | null; venue_availability_id?: string | null; is_locked?: boolean; match_status?: string };

export async function POST(request: Request, context: RouteContext<"/api/leagues/[leagueId]/schedule/[runId]/history">) {
  const { leagueId, runId } = await context.params;
  const body = await request.json().catch(() => null) as { action?: "undo" | "redo" } | null;
  if (!body || (body.action !== "undo" && body.action !== "redo")) return NextResponse.json({ error: "action must be undo or redo." }, { status: 400 });
  const supabase = await createClient();
  const { data: run, error: runError } = await supabase.from("league_schedule_runs").select("id, schedule_status").eq("id", runId).eq("league_id", leagueId).maybeSingle<{ id: string; schedule_status: string }>();
  if (runError || !run) return NextResponse.json({ error: runError?.message ?? "Schedule run not found." }, { status: 404 });
  if (run.schedule_status !== "draft") return NextResponse.json({ error: "Only draft schedules can be changed." }, { status: 409 });
  const { data: edit, error: editError } = await supabase.from("league_schedule_edit_log").select("id, match_id, before_state, after_state, is_undone").eq("schedule_run_id", runId).eq("is_undone", body.action === "redo").order("created_at", { ascending: false }).limit(1).maybeSingle<{ id: string; match_id: string; before_state: EditState; after_state: EditState; is_undone: boolean }>();
  if (editError) return NextResponse.json({ error: editError.message }, { status: 500 });
  if (!edit) return NextResponse.json({ error: body.action === "undo" ? "Nothing to undo." : "Nothing to redo." }, { status: 409 });
  const state = body.action === "undo" ? edit.before_state : edit.after_state;
  const { error: updateMatchError } = await supabase.from("league_matches").update(state).eq("id", edit.match_id).eq("schedule_run_id", runId);
  if (updateMatchError) return NextResponse.json({ error: updateMatchError.message }, { status: 500 });
  const { error: updateLogError } = await supabase.from("league_schedule_edit_log").update({ is_undone: body.action === "undo" }).eq("id", edit.id);
  if (updateLogError) return NextResponse.json({ error: updateLogError.message }, { status: 500 });
  return NextResponse.json({ action: body.action, match_id: edit.match_id });
}
