import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const matchStatuses = ["scheduled", "confirmed", "played", "cancelled"] as const;
type MatchStatus = (typeof matchStatuses)[number];
type RouteContext = { params: Promise<{ leagueId: string; matchId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { leagueId, matchId } = await context.params;
  let body: { matchStatus?: MatchStatus };

  try {
    body = (await request.json()) as { matchStatus?: MatchStatus };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.matchStatus || !matchStatuses.includes(body.matchStatus)) {
    return NextResponse.json(
      { error: `matchStatus must be one of: ${matchStatuses.join(", ")}.` },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: match, error: matchError } = await supabase
    .from("league_matches")
    .select("id, schedule_run_id")
    .eq("id", matchId)
    .maybeSingle<{ id: string; schedule_run_id: string }>();

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  }

  if (!match) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const { data: run, error: runError } = await supabase
    .from("league_schedule_runs")
    .select("id, league_id")
    .eq("id", match.schedule_run_id)
    .eq("league_id", leagueId)
    .maybeSingle<{ id: string; league_id: string }>();

  if (runError) {
    return NextResponse.json({ error: runError.message }, { status: 500 });
  }

  if (!run) {
    return NextResponse.json({ error: "Match does not belong to this league." }, { status: 404 });
  }

  const { data: updatedMatch, error: updateError } = await supabase
    .from("league_matches")
    .update({ match_status: body.matchStatus })
    .eq("id", matchId)
    .select("id, match_status")
    .single<{ id: string; match_status: MatchStatus }>();

  if (updateError || !updatedMatch) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not update match status." },
      { status: 500 },
    );
  }

  return NextResponse.json(updatedMatch);
}
