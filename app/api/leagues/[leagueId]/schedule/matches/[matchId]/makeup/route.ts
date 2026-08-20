import { NextResponse } from "next/server";
import { loadScheduleEditorData } from "@/lib/scheduling/editor-data";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ leagueId: string; matchId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { leagueId, matchId } = await context.params;
  const editor = await loadScheduleEditorData(leagueId);
  if (!editor?.run) return NextResponse.json({ error: "Schedule run not found." }, { status: 404 });
  if (editor.run.schedule_status !== "draft") return NextResponse.json({ error: "Create an editable draft before scheduling a make-up match." }, { status: 409 });

  const cancelledMatch = editor.matches.find((match) => match.id === matchId);
  if (!cancelledMatch) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (cancelledMatch.fixture_type !== "regular" || cancelledMatch.match_status !== "cancelled") {
    return NextResponse.json({ error: "Only a cancelled regular fixture can receive a make-up match." }, { status: 409 });
  }
  if (editor.matches.some((match) => match.parent_match_id === cancelledMatch.id && match.fixture_type === "makeup" && match.match_status !== "cancelled")) {
    return NextResponse.json({ error: "This cancelled match already has an active make-up fixture." }, { status: 409 });
  }

  const supabase = await createClient();
  const { data: makeUpMatch, error } = await supabase
    .from("league_matches")
    .insert({
      schedule_run_id: editor.run.id,
      parent_match_id: cancelledMatch.id,
      fixture_type: "makeup",
      home_team_id: cancelledMatch.home_team_id,
      away_team_id: cancelledMatch.away_team_id,
      field_id: null,
      venue_availability_id: null,
      starts_at: null,
      ends_at: null,
      match_status: "scheduled",
      is_locked: false,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !makeUpMatch) return NextResponse.json({ error: error?.message ?? "Could not create make-up fixture." }, { status: 500 });

  return NextResponse.json({ match: makeUpMatch }, { status: 201 });
}
