import { NextResponse } from "next/server";
import { loadScheduleEditorData } from "@/lib/scheduling/editor-data";
import { assignmentEnd, validateMatchAssignment, type ValidationContext } from "@/lib/scheduling/editor";
import { createClient } from "@/lib/supabase/server";

const matchStatuses = ["scheduled", "confirmed", "played", "cancelled"] as const;
type MatchStatus = (typeof matchStatuses)[number];
type UpdateBody = { matchStatus?: MatchStatus; startsAt?: string | null; fieldId?: string | null; isLocked?: boolean };

export async function PATCH(request: Request, context: RouteContext<"/api/leagues/[leagueId]/schedule/matches/[matchId]">) {
  const { leagueId, matchId } = await context.params;
  let body: UpdateBody;
  try { body = await request.json() as UpdateBody; } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (body.matchStatus !== undefined && !matchStatuses.includes(body.matchStatus)) return NextResponse.json({ error: "Invalid match status." }, { status: 400 });
  if (body.startsAt !== undefined && body.startsAt !== null && Number.isNaN(new Date(body.startsAt).getTime())) return NextResponse.json({ error: "Invalid start time." }, { status: 400 });
  const editor = await loadScheduleEditorData(leagueId);
  if (!editor?.run) return NextResponse.json({ error: "Schedule run not found." }, { status: 404 });
  if (editor.run.schedule_status !== "draft") return NextResponse.json({ error: "Published schedules are read-only. Create an editable draft first." }, { status: 409 });
  const match = editor.matches.find((item) => item.id === matchId);
  if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  const isAssignmentUpdate = body.startsAt !== undefined || body.fieldId !== undefined;
  const candidate = { startsAt: body.startsAt === undefined ? match.starts_at : body.startsAt, fieldId: body.fieldId === undefined ? match.field_id : body.fieldId };
  const supabase = await createClient();
  const { data: availabilityRows } = await supabase.from("team_availability_submissions").select("team_id, available_start_date, available_end_date, available_dates, blackout_dates, has_day_preference, preferred_days_of_week, has_time_preference, preferred_times_of_day, created_at").in("team_id", editor.league.teams.map((team) => team.id)).order("created_at", { ascending: false });
  const availabilityByTeamId = new Map();
  for (const row of availabilityRows ?? []) if (!availabilityByTeamId.has(row.team_id)) availabilityByTeamId.set(row.team_id, row);
  const validationContext: ValidationContext = { matches: editor.matches, permits: editor.permits, availabilityByTeamId, matchDurationMinutes: editor.league.match_duration_minutes, maxMatchesPerTeamPerWeek: editor.league.max_matches_per_team_per_week, minRestHours: editor.run.input_snapshot?.settings?.min_rest_hours ?? 0 };
  const validation = isAssignmentUpdate ? validateMatchAssignment(match, candidate, validationContext) : [];
  const hardIssues = validation.filter((item) => item.severity === "conflict");
  if (hardIssues.length) return NextResponse.json({ error: "This assignment has hard scheduling conflicts.", issues: hardIssues }, { status: 422 });
  const before = { starts_at: match.starts_at, ends_at: match.ends_at, field_id: match.field_id, venue_availability_id: match.venue_availability_id, is_locked: match.is_locked, match_status: match.match_status };
  const update: Record<string, unknown> = {};
  if (body.matchStatus !== undefined) update.match_status = body.matchStatus;
  if (body.isLocked !== undefined) update.is_locked = body.isLocked;
  if (isAssignmentUpdate) {
    update.starts_at = candidate.startsAt;
    update.field_id = candidate.fieldId;
    update.ends_at = candidate.startsAt ? assignmentEnd(candidate.startsAt, editor.league.match_duration_minutes) : null;
    const permit = candidate.startsAt && candidate.fieldId ? editor.permits.find((item) => item.field_id === candidate.fieldId && item.permit_date === candidate.startsAt!.slice(0, 10) && item.permit_start_time.slice(0, 5) <= candidate.startsAt!.slice(11, 16) && item.permit_end_time.slice(0, 5) >= (update.ends_at as string).slice(11, 16)) : null;
    update.venue_availability_id = permit?.id ?? null;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "No changes supplied." }, { status: 400 });
  const { data: updated, error } = await supabase.from("league_matches").update(update).eq("id", matchId).select("id").single();
  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Could not save match." }, { status: 500 });
  await supabase.from("league_schedule_edit_log").insert({ schedule_run_id: editor.run.id, match_id: matchId, operation_type: isAssignmentUpdate ? "assignment_updated" : body.isLocked !== undefined ? "lock_updated" : "status_updated", before_state: before, after_state: { ...before, ...update } });
  const refreshed = await loadScheduleEditorData(leagueId);
  return NextResponse.json({ match: refreshed?.matches.find((item) => item.id === matchId), issues: refreshed?.issues.filter((item) => item.matchId === matchId) ?? [] });
}
