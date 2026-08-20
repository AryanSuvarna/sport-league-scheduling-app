import { NextResponse } from "next/server";
import { getSuggestedSlots, type EditorAvailability, type ValidationContext } from "@/lib/scheduling/editor";
import { loadScheduleEditorData } from "@/lib/scheduling/editor-data";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: RouteContext<"/api/leagues/[leagueId]/schedule/matches/[matchId]/suggestions">) {
  const { leagueId, matchId } = await context.params;
  const editor = await loadScheduleEditorData(leagueId);
  const match = editor?.matches.find((item) => item.id === matchId);
  if (!editor || !match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("team_availability_submissions").select("team_id, available_start_date, available_end_date, available_dates, blackout_dates, has_day_preference, preferred_days_of_week, has_time_preference, preferred_times_of_day, created_at").in("team_id", editor.league.teams.map((team) => team.id)).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const availabilityByTeamId = new Map<string, EditorAvailability>();
  for (const row of (rows ?? []) as EditorAvailability[]) if (!availabilityByTeamId.has(row.team_id)) availabilityByTeamId.set(row.team_id, row);
  const validationContext: ValidationContext = { matches: editor.matches, permits: editor.permits, availabilityByTeamId, matchDurationMinutes: editor.league.match_duration_minutes, maxMatchesPerTeamPerWeek: editor.run?.input_snapshot?.settings?.max_matches_per_team_per_week ?? editor.league.max_matches_per_team_per_week, minRestHours: editor.run?.input_snapshot?.settings?.min_rest_hours ?? 0 };
  const fields = new Map(editor.fields.map((field) => [field.id, field]));
  return NextResponse.json({ suggestions: getSuggestedSlots(match, validationContext).map((slot) => ({ ...slot, field: fields.get(slot.fieldId) ?? null })) });
}
