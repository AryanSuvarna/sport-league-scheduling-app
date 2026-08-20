import { notFound } from "next/navigation";
import { LeagueDetailClient } from "./LeagueDetailClient";
import type { League } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";

type LeaguePageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { leagueId } = await params;
  const supabase = await createClient();
  const { data: league, error } = await supabase
    .from("leagues")
    .select(
      `
        id,
        name,
        sport,
        season_start_date,
        season_end_date,
        match_duration_minutes,
        max_matches_per_team_per_week,
        scheduler_rules,
        league_teams (
          id,
          name,
          captain_name,
          captain_phone,
          captain_email
        )
      `,
    )
    .eq("id", leagueId)
    .single()
    .returns<League>();

  if (error || !league) {
    notFound();
  }

  const { data: availabilitySubmissions } = await supabase
    .from("team_availability_submissions")
    .select("team_id")
    .in("team_id", league.league_teams.map((team) => team.id));
  const submittedTeamIds = new Set((availabilitySubmissions ?? []).map((submission) => submission.team_id));
  const leagueWithAvailability = {
    ...league,
    league_teams: league.league_teams.map((team) => ({
      ...team,
      has_submitted_availability: submittedTeamIds.has(team.id),
    })),
  };

  return <LeagueDetailClient league={leagueWithAvailability} />;
}
