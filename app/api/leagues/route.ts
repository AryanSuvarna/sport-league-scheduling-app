import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CreateLeagueBody = {
  league?: {
    name?: string;
    sport?: string;
    seasonStartDate?: string;
    seasonEndDate?: string;
    matchDurationMinutes?: number;
    schedulerRules?: unknown[];
  };
  teams?: Array<{
    name?: string;
    captainName?: string;
    captainPhone?: string;
    captainEmail?: string | null;
  }>;
};

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreateLeagueBody | null;
  const league = body?.league;
  const teams = body?.teams;

  if (
    !league?.name?.trim() ||
    !league.sport?.trim() ||
    !league.seasonStartDate ||
    !league.seasonEndDate ||
    typeof league.matchDurationMinutes !== "number" ||
    !Number.isFinite(league.matchDurationMinutes) ||
    league.matchDurationMinutes <= 0 ||
    !Array.isArray(league.schedulerRules) ||
    !teams ||
    teams.length < 2 ||
    teams.some(
      (team) =>
        !team.name?.trim() || !team.captainName?.trim() || !team.captainPhone?.trim(),
    )
  ) {
    return NextResponse.json({ error: "Invalid league details." }, { status: 400 });
  }

  const supabase = await createClient();
  // The Clerk webhook normally creates this row. This idempotent fallback
  // handles a new user creating a league before their webhook is delivered.
  const { error: userError } = await supabase
    .from("profiles")
    .upsert({ clerk_user_id: userId }, { onConflict: "clerk_user_id", ignoreDuplicates: true });

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  const { data: createdLeague, error: leagueError } = await supabase
    .from("leagues")
    .insert({
      name: league.name.trim(),
      sport: league.sport.trim(),
      season_start_date: league.seasonStartDate,
      season_end_date: league.seasonEndDate,
      match_duration_minutes: league.matchDurationMinutes,
      scheduler_rules: league.schedulerRules,
      owner_clerk_user_id: userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (leagueError || !createdLeague) {
    return NextResponse.json(
      { error: leagueError?.message || "Could not create the league." },
      { status: 500 },
    );
  }

  const { error: teamsError } = await supabase.from("league_teams").insert(
    teams.map((team) => ({
      league_id: createdLeague.id,
      name: team.name!.trim(),
      captain_name: team.captainName!.trim(),
      captain_phone: team.captainPhone!.trim(),
      captain_email: team.captainEmail?.trim() || null,
    })),
  );

  if (teamsError) {
    await supabase.from("leagues").delete().eq("id", createdLeague.id);
    return NextResponse.json({ error: teamsError.message }, { status: 500 });
  }

  return NextResponse.json({ leagueId: createdLeague.id }, { status: 201 });
}
