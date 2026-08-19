import { NextResponse } from "next/server";
import { loadScheduleEditorData } from "@/lib/scheduling/editor-data";
import { createClient } from "@/lib/supabase/server";

type SolverSlot = { id: string; field_id: string; starts_at: string; ends_at: string; capacity: number };
type SolverTeam = { id: string; name: string; allowed_slot_ids: string[]; preferred_slot_ids: string[] };
type SolverPayload = { teams: SolverTeam[]; slots: SolverSlot[]; settings: Record<string, unknown> };
type SolverResponse = { status: "optimal" | "feasible" | "infeasible" | "unknown"; objective_value: number | null; matches: Array<{ home_team_id: string; away_team_id: string; slot_id: string; field_id: string; starts_at: string; ends_at: string }> };

function currentSlot(slot: SolverSlot, permits: Array<{ id: string; field_id: string; permit_date: string; permit_start_time: string; permit_end_time: string }>) {
  const permit = permits.find((item) => String(item.id) === slot.id.split(":")[0]);
  if (!permit || permit.field_id !== slot.field_id || slot.starts_at.slice(0, 10) !== permit.permit_date || slot.ends_at.slice(0, 10) !== permit.permit_date) return false;
  const startTime = slot.starts_at.slice(11, 19);
  const endTime = slot.ends_at.slice(11, 19);
  return startTime >= permit.permit_start_time.slice(0, 8) && endTime <= permit.permit_end_time.slice(0, 8);
}

export async function POST(_request: Request, context: RouteContext<"/api/leagues/[leagueId]/schedule/[runId]/optimize">) {
  const { leagueId, runId } = await context.params;
  const editor = await loadScheduleEditorData(leagueId);
  if (!editor?.run || editor.run.id !== runId) return NextResponse.json({ error: "Active draft not found." }, { status: 404 });
  if (editor.run.schedule_status !== "draft") return NextResponse.json({ error: "Only drafts can be optimized." }, { status: 409 });
  const lockedIssues = editor.issues.filter((issue) => editor.matches.find((match) => match.id === issue.matchId)?.is_locked && issue.severity === "conflict");
  if (lockedIssues.length) return NextResponse.json({ error: "Resolve conflicts on locked matches before optimizing.", issues: lockedIssues }, { status: 409 });
  const payload = editor.run.input_snapshot as SolverPayload | null;
  if (!payload?.slots || !payload.teams) return NextResponse.json({ error: "This draft does not have a reusable solver snapshot." }, { status: 409 });
  const slots = payload.slots.filter((slot) => currentSlot(slot, editor.permits));
  if (slots.length === 0) return NextResponse.json({ error: "No current venue permits contain a usable match slot. Add availability before optimizing." }, { status: 409 });
  const slotIds = new Set(slots.map((slot) => slot.id));
  const reusablePayload: SolverPayload = {
    ...payload,
    slots,
    teams: payload.teams.map((team) => ({
      ...team,
      allowed_slot_ids: team.allowed_slot_ids.filter((slotId) => slotIds.has(slotId)),
      preferred_slot_ids: team.preferred_slot_ids.filter((slotId) => slotIds.has(slotId)),
    })),
  };
  const fixed_matches = editor.matches.filter((match) => match.is_locked).map((match) => {
    const slot = slots.find((item) => item.field_id === match.field_id && item.starts_at.replace(/\.\d+Z?$/, "") === match.starts_at?.replace(/\.\d+Z?$/, ""));
    return slot ? { home_team_id: match.home_team_id, away_team_id: match.away_team_id, slot_id: slot.id } : null;
  });
  if (fixed_matches.some((match) => !match)) return NextResponse.json({ error: "A locked match is no longer in the available solver slots. Unlock it or restore its original permit." }, { status: 409 });
  const schedulerUrl = process.env.SCHEDULER_SERVICE_URL;
  if (!schedulerUrl) return NextResponse.json({ error: "SCHEDULER_SERVICE_URL is not configured." }, { status: 503 });
  let solver: SolverResponse;
  try {
    const response = await fetch(`${schedulerUrl.replace(/\/$/, "")}/v1/schedules:generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...reusablePayload, fixed_matches }) });
    solver = await response.json() as SolverResponse;
    if (!response.ok || solver.status === "infeasible" || solver.status === "unknown") return NextResponse.json({ error: "Could not optimize the unlocked matches.", detail: solver }, { status: 422 });
  } catch { return NextResponse.json({ error: "Scheduler service is unavailable." }, { status: 503 }); }
  const supabase = await createClient();
  const { data: run, error: runError } = await supabase.from("league_schedule_runs").insert({ league_id: leagueId, solver_status: solver.status, schedule_status: "draft", input_snapshot: reusablePayload, objective_value: solver.objective_value, parent_schedule_run_id: runId }).select("id").single<{ id: string }>();
  if (runError || !run) return NextResponse.json({ error: runError?.message ?? "Could not create optimized draft." }, { status: 500 });
  const permitIdBySlotId = new Map(slots.map((slot) => [slot.id, slot.id.split(":")[0]]));
  const { error: matchesError } = await supabase.from("league_matches").insert(solver.matches.map((match) => ({ schedule_run_id: run.id, home_team_id: match.home_team_id, away_team_id: match.away_team_id, field_id: match.field_id, venue_availability_id: permitIdBySlotId.get(match.slot_id) ?? null, starts_at: match.starts_at, ends_at: match.ends_at, match_status: "scheduled", is_locked: fixed_matches.some((fixed) => fixed?.home_team_id === match.home_team_id && fixed.away_team_id === match.away_team_id && fixed.slot_id === match.slot_id) })));
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 });
  return NextResponse.json({ schedule_run_id: run.id, matches: solver.matches.length }, { status: 201 });
}
